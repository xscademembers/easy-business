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
  FAST_VECTOR_LIMIT,
  FAST_VECTOR_NUM_CANDIDATES,
  decideSameProduct,
  getSameProductMinScore,
  type SameProductDecision,
} from '@/lib/constants/duplicateDetection';

const publicSelect = PRODUCT_PUBLIC_FIELDS;

type PublicProduct = Record<string, unknown> & { _id: unknown };

/**
 * Duplicate detection endpoint.
 *
 * Latency budget (<3 s p95):
 *   1. Normalize image (sharp, ~50 ms).
 *   2. Canonical dHash lookup — O(index) exact match against the 4 rotation
 *      hashes stored on every product, so a re-upload (even rotated) returns
 *      instantly with **zero** OpenAI calls.
 *   3. Otherwise run ONE vision call + ONE embedding call + ONE $vectorSearch
 *      in parallel with OCR. Past experiments with 4-rotation vision fan-out
 *      triggered OpenAI org concurrency limits and stretched this endpoint to
 *      15–30 s, so we keep the fan-out tight here.
 *   4. Strict same-product gate: cosine ≥ threshold AND no identity-defining
 *      attribute contradictions (product_type, primary_color, brand, pattern,
 *      logo_text). Colour / pattern variants therefore stay "new".
 *   5. `duplicateCandidate` is only populated when status === "same" so the
 *      admin popup never fires for variants.
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

    // Stage 1 — exact hash match (rotation-invariant by construction because
    // products store all 4 rotation dHashes in `imageHashes`).
    const hashMatch = (await Product.findOne({ imageHashes: canonicalHash })
      .select(publicSelect)
      .lean()) as PublicProduct | null;

    if (hashMatch) {
      const matched: PublicProduct & { similarityScore: number } = {
        ...hashMatch,
        similarityScore: 1,
      };
      return NextResponse.json({
        status: 'same',
        confidence: 1,
        matchedProduct: matched,
        reason: 'hash exact match',
        duplicateCandidate: matched,
        nearestNeighbors: [],
        ocrCodes: [],
        codeMatch: null,
        duplicateThreshold: threshold,
      });
    }

    // Stage 2 — single vision + embedding + OCR, all concurrent.
    const ocrPromise = extractCodes
      ? extractDigitCodesFromJpegBuffer(normalized.buffer)
      : Promise.resolve<string[]>([]);

    const [fingerprint, ocrCodes] = await Promise.all([
      buildImageFingerprint(normalized.buffer),
      ocrPromise,
    ]);

    const hits = await findNearestProductsWithAttributes(
      fingerprint.embedding,
      FAST_VECTOR_LIMIT,
      FAST_VECTOR_NUM_CANDIDATES
    );

    const ranked = [...hits].sort((a, b) => b.score - a.score);
    const top = ranked[0];
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
      duplicateCandidate: matchedProduct,
      nearestNeighbors: ranked.slice(0, 3).map((h) => ({
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
