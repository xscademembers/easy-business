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
 * Pipeline:
 *   1. Normalize image (sharp, ~50 ms).
 *   2. Kick off in parallel: dHash lookup, single-vision fingerprint, and
 *      OCR. Previously the hash lookup blocked the fingerprint call; racing
 *      them shaves ~1 vision call worth of wall time off the uncached path
 *      without changing the contract.
 *   3. If the hash hits, return `status: "same"` immediately — the
 *      in-flight fingerprint / OCR calls are discarded (cheap in JS; only
 *      the OpenAI tokens are wasted, which is an acceptable trade for the
 *      happy-path latency).
 *   4. Otherwise run ONE $vectorSearch, then apply the strict attribute
 *      gate (product_type / primary_color / brand / pattern / logo_text).
 *      Colour variants always fail the gate because the vision prompt now
 *      forces a dominant-colour choice from a fixed palette.
 *   5. `duplicateCandidate` is populated only when status === "same" so
 *      the admin popup never fires for variants.
 */
export async function POST(request: Request) {
  const t0 = Date.now();
  const timings: Record<string, number> = {};
  const mark = (label: string, start: number) => {
    timings[label] = Date.now() - start;
  };

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

    const tNorm = Date.now();
    const normalized = await normalizeProductImage(imageBase64);
    mark('normalize_ms', tNorm);

    const canonicalHash = dHashFromGrayscale9x8(normalized.grayHash);
    const threshold = getSameProductMinScore();

    // Fire off all three expensive tasks simultaneously. The hash lookup is
    // cheap (indexed) — if it wins we'll return before the others finish.
    const tHash = Date.now();
    const hashPromise = Product.findOne({ imageHashes: canonicalHash })
      .select(publicSelect)
      .lean()
      .then((res) => {
        mark('hash_lookup_ms', tHash);
        return res as PublicProduct | null;
      });

    const tFp = Date.now();
    const fingerprintPromise = buildImageFingerprint(normalized.buffer)
      .then((fp) => {
        mark('fingerprint_ms', tFp);
        return fp;
      })
      .catch((err: unknown) => {
        mark('fingerprint_ms', tFp);
        console.warn(
          'similar-check fingerprint failed:',
          err instanceof Error ? err.message : err
        );
        return null;
      });

    const tOcr = Date.now();
    const ocrPromise = (
      extractCodes
        ? extractDigitCodesFromJpegBuffer(normalized.buffer)
        : Promise.resolve<string[]>([])
    ).then((codes) => {
      mark('ocr_ms', tOcr);
      return codes;
    });

    // Stage 1 — exact hash match (rotation-invariant by construction since
    // products store all 4 rotation dHashes). Return fast, drop fingerprint.
    const hashMatch = await hashPromise;
    if (hashMatch) {
      const matched: PublicProduct & { similarityScore: number } = {
        ...hashMatch,
        similarityScore: 1,
      };
      // Still await OCR so the admin restock flow works on hash hits too.
      const ocrCodes = await ocrPromise.catch(() => [] as string[]);
      const codeMatch = await findCodeMatch(ocrCodes);
      timings.total_ms = Date.now() - t0;
      return NextResponse.json({
        status: 'same',
        confidence: 1,
        matchedProduct: matched,
        reason: 'hash exact match',
        duplicateCandidate: matched,
        nearestNeighbors: [],
        ocrCodes,
        codeMatch,
        duplicateThreshold: threshold,
        timings,
      });
    }

    // Stage 2 — wait for the vision fingerprint + OCR.
    const [fingerprint, ocrCodes] = await Promise.all([
      fingerprintPromise,
      ocrPromise,
    ]);

    if (!fingerprint) {
      timings.total_ms = Date.now() - t0;
      const codeMatch = await findCodeMatch(ocrCodes);
      return NextResponse.json({
        status: 'new',
        confidence: 0,
        matchedProduct: null,
        reason: 'vision fingerprint failed',
        duplicateCandidate: null,
        nearestNeighbors: [],
        ocrCodes,
        codeMatch,
        duplicateThreshold: threshold,
        timings,
      });
    }

    const tVec = Date.now();
    const hits = await findNearestProductsWithAttributes(
      fingerprint.embedding,
      FAST_VECTOR_LIMIT,
      FAST_VECTOR_NUM_CANDIDATES
    );
    mark('vector_search_ms', tVec);

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

    timings.total_ms = Date.now() - t0;

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
        attributes: h.attributes,
      })),
      ocrCodes,
      codeMatch,
      duplicateThreshold: threshold,
      timings,
    });
  } catch (error) {
    console.error('POST /api/products/similar-check error:', error);
    const message =
      error instanceof Error ? error.message : 'Similar check failed';
    return NextResponse.json({ error: message, timings }, { status: 500 });
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
