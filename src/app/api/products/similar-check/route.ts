import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Product from '@/lib/models/Product';
import { normalizeProductImage } from '@/lib/services/imageNormalize';
import { dHashFromGrayscale9x8 } from '@/lib/services/imageHash';
import { buildImageFingerprint } from '@/lib/services/openaiImageEmbedding';
import { findNearestProductsWithAttributes } from '@/lib/services/vectorSearch';
import { extractDigitCodesFromJpegBuffer } from '@/lib/services/extractDigitCodesFromImage';
import { PRODUCT_PUBLIC_FIELDS } from '@/lib/constants/productFields';
import {
  coerceAttributes,
  decideSameProduct,
  getSameProductMinScore,
  type ProductAttributes,
  type SameProductDecision,
} from '@/lib/constants/duplicateDetection';

const publicSelect = PRODUCT_PUBLIC_FIELDS;

type PublicProduct = Record<string, unknown> & { _id: unknown };

/**
 * Duplicate detection endpoint.
 *
 * Pipeline (designed to hit <2 s p95):
 *   1. Normalize the image (auto-orient + 384² letterbox + q55).
 *   2. Compute canonical dHash. If any existing product stores the same
 *      hash (at any of its 4 rotations) we have a byte-level duplicate:
 *      return status="same" with confidence 1.0 — no vision/vector calls.
 *   3. Otherwise run the vision fingerprint + Atlas vector search + OCR
 *      codes in parallel.
 *   4. Apply the strict same-product rule (cosine ≥ 0.97 AND matching
 *      product_type/primary_color/brand/pattern/logo_text).
 *   5. `duplicateCandidate` is populated **only** when status="same",
 *      which is the signal the admin UI uses to show the popup. Variants
 *      and different products therefore never trigger the popup.
 */
export async function POST(request: Request) {
  try {
    await connectDB();
    const body = await request.json();
    const { imageBase64, extractCodes = true } = body as {
      imageBase64?: string;
      extractCodes?: boolean;
    };

    if (typeof imageBase64 !== 'string' || !imageBase64.length) {
      return NextResponse.json(
        { error: 'imageBase64 is required' },
        { status: 400 }
      );
    }

    const normalized = await normalizeProductImage(imageBase64);
    const canonicalHash = dHashFromGrayscale9x8(normalized.grayHash);
    const threshold = getSameProductMinScore();

    // Stage 1 — exact hash match (rotation-invariant by construction).
    const hashMatch = (await Product.findOne({ imageHashes: canonicalHash })
      .select(publicSelect)
      .lean()) as PublicProduct | null;

    if (hashMatch) {
      // We already have a confident match; OCR + vision would only add latency
      // without changing the decision, so we skip them on this fast path.
      const matched: PublicProduct & { similarityScore: number } = {
        ...hashMatch,
        similarityScore: 1,
      };
      return NextResponse.json({
        status: 'same',
        confidence: 1,
        matchedProduct: matched,
        reason: 'hash exact match',
        // Legacy fields — kept so existing UI code works unchanged.
        duplicateCandidate: matched,
        nearestNeighbors: [],
        ocrCodes: [],
        codeMatch: null,
        duplicateThreshold: threshold,
      });
    }

    // Stage 2 — run vision + OCR in parallel. The vision call computes the
    // embedding internally after receiving the description; OCR is
    // independent and runs concurrently.
    const ocrPromise = extractCodes
      ? extractDigitCodesFromJpegBuffer(normalized.buffer)
      : Promise.resolve<string[]>([]);

    const [fingerprint, ocrCodes] = await Promise.all([
      buildImageFingerprint(normalized.buffer),
      ocrPromise,
    ]);

    const hits = await findNearestProductsWithAttributes(fingerprint.embedding);
    const top = hits[0];
    const codeMatch = await findCodeMatch(ocrCodes);

    let decision: SameProductDecision = {
      status: 'new',
      confidence: 0,
      reason: 'no neighbors',
    };
    let matchedProduct: (PublicProduct & { similarityScore: number }) | null =
      null;

    if (top) {
      decision = decideSameProduct({
        vectorScore: top.score,
        candidate: top.attributes,
        query: fingerprint.attributes,
        threshold,
      });

      if (decision.status === 'same') {
        const full = (await Product.findById(top._id)
          .select(publicSelect)
          .lean()) as PublicProduct | null;
        if (full) {
          matchedProduct = { ...full, similarityScore: top.score };
        }
      }
    }

    return NextResponse.json({
      status: decision.status,
      confidence: decision.confidence,
      matchedProduct,
      reason: decision.reason,
      queryAttributes: fingerprint.attributes,
      // Legacy fields — only expose `duplicateCandidate` when we're truly
      // confident, so the admin popup stays strict.
      duplicateCandidate: matchedProduct,
      nearestNeighbors: hits.map((h) => ({
        _id: h._id,
        name: h.name,
        price: h.price,
        image_url: h.image_url,
        score: h.score,
      })),
      ocrCodes,
      codeMatch,
      duplicateThreshold: threshold,
    });
  } catch (error) {
    console.error('POST /api/products/similar-check error:', error);
    const message =
      error instanceof Error ? error.message : 'Similar check failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function findCodeMatch(
  ocrCodes: string[]
): Promise<{ productCode: string; product: PublicProduct } | null> {
  for (const code of ocrCodes) {
    const found = (await Product.findOne({ productCode: code })
      .select(publicSelect)
      .lean()) as PublicProduct | null;
    if (found) {
      return { productCode: code, product: found };
    }
  }
  return null;
}

// Re-export for tests / tooling — intentionally unused.
export type { ProductAttributes };
