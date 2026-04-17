import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Product from '@/lib/models/Product';
import { normalizeProductImage } from '@/lib/services/imageNormalize';
import { extractProductCodesForScan } from '@/lib/services/extractDigitCodesFromImage';
import { getImageEmbeddingFromJpegBuffer } from '@/lib/services/openaiImageEmbedding';
import { findNearestProductsByEmbedding } from '@/lib/services/vectorSearch';
import { PRODUCT_PUBLIC_FIELDS } from '@/lib/constants/productFields';
import { FAST_VECTOR_LIMIT, FAST_VECTOR_NUM_CANDIDATES } from '@/lib/constants/duplicateDetection';
import { codeScoreFromDistance, levenshtein } from '@/lib/utils/levenshtein';

const publicSelect = PRODUCT_PUBLIC_FIELDS;

/** Edit-distance ceiling for a code to still count as a fuzzy match. */
const MAX_CODE_EDIT_DISTANCE = 2;

/** Hybrid ranking: how much we trust the OCR vs the visual embedding. */
const CODE_WEIGHT = 0.6;
const VISUAL_WEIGHT = 0.4;

type PublicProduct = Record<string, unknown> & {
  _id: unknown;
  productCode?: string;
};

interface FuzzyCandidate {
  _id: unknown;
  productCode: string;
  distance: number;
  matchedAgainst: string;
}

type MatchType = 'exact_code' | 'fuzzy_code' | 'visual' | 'none';

/**
 * POST /api/products/scan-by-code
 *
 * Identify a product from a photo that contains either:
 *   - a printed/handwritten product code (on a tag / sticker / paper), and/or
 *   - the product itself.
 *
 * Pipeline (designed for a <3 s p95, <2 s when an exact code hits):
 *   1. Normalise the uploaded image (sharp: auto-orient + 384² + q55).
 *   2. Run OCR (digit-focused vision) and the visual embedding in parallel —
 *      one call each, reusing the same normalised buffer. Never issue two
 *      vision calls for OCR.
 *   3. EXACT code match → return immediately. Visual work that is already in
 *      flight simply gets discarded; this keeps the happy path fast.
 *   4. No exact hit → FUZZY code match (Levenshtein ≤ 2) across stored
 *      productCodes, plus vector search against the catalog.
 *   5. Combine scores: hybrid = 0.6·codeScore + 0.4·visualScore. If a product
 *      appears in both sets, its combined score wins; code-only and
 *      visual-only candidates still get considered with their single signal.
 *   6. If nothing clears the combined bar, fall back to the top visual hit.
 */
export async function POST(request: Request) {
  try {
    await connectDB();
    const body = await request.json().catch(() => null);
    const imageBase64 =
      body && typeof (body as { imageBase64?: unknown }).imageBase64 === 'string'
        ? (body as { imageBase64: string }).imageBase64
        : '';

    if (!imageBase64) {
      return NextResponse.json(
        { error: 'imageBase64 is required' },
        { status: 400 }
      );
    }

    const normalized = await normalizeProductImage(imageBase64);

    // Stage 1: OCR + visual embedding IN PARALLEL, each called exactly once.
    const codesPromise = extractProductCodesForScan(normalized.buffer);
    const embeddingPromise = getImageEmbeddingFromJpegBuffer(normalized.buffer)
      // Swallow background rejection if we return early on an exact match.
      .catch((err: unknown) => {
        console.warn(
          'scan-by-code embedding failed:',
          err instanceof Error ? err.message : err
        );
        return null;
      });

    const rawCodes = await codesPromise;
    const detectedCodes = normalizeCodes(rawCodes);

    // Stage 2: exact code match — fastest path, no embedding required.
    if (detectedCodes.length > 0) {
      const exact = (await Product.findOne({
        productCode: { $in: detectedCodes },
      })
        .select(publicSelect)
        .lean()) as PublicProduct | null;

      if (exact) {
        return NextResponse.json({
          detectedCodes,
          matchedProduct: exact,
          matchType: 'exact_code' satisfies MatchType,
          confidence: 1,
          reason: `exact productCode match (${exact.productCode})`,
          alternativeMatches: [],
        });
      }
    }

    // Stage 3: we will need the embedding for either fuzzy-score combining
    // or a pure visual fallback, so wait for it now.
    const embedding = await embeddingPromise;

    // Fuzzy candidates: scan all stored productCodes once and keep only those
    // within `MAX_CODE_EDIT_DISTANCE` of any detected code. Cheap in JS for
    // typical catalog sizes; move to a specialised index if this ever gets
    // into the hundreds of thousands.
    const fuzzyCandidates =
      detectedCodes.length > 0
        ? await findFuzzyCodeCandidates(detectedCodes)
        : [];

    // Visual candidates: top-N cosine neighbours from Atlas vector search.
    const visualHits = embedding
      ? await findNearestProductsByEmbedding(
          embedding,
          FAST_VECTOR_LIMIT,
          FAST_VECTOR_NUM_CANDIDATES
        )
      : [];

    const combined = combineCandidates(fuzzyCandidates, visualHits);

    if (combined.length === 0) {
      return NextResponse.json({
        detectedCodes,
        matchedProduct: null,
        matchType: 'none' satisfies MatchType,
        confidence: 0,
        reason:
          detectedCodes.length === 0
            ? 'no code detected and no visual match'
            : 'no fuzzy or visual candidate',
        alternativeMatches: [],
      });
    }

    const top = combined[0]!;
    const full = (await Product.findById(top._id)
      .select(publicSelect)
      .lean()) as PublicProduct | null;

    const matchType: MatchType = top.hasCodeMatch ? 'fuzzy_code' : 'visual';
    const reason = top.hasCodeMatch
      ? `fuzzy code match distance ${top.codeDistance} (${top.matchedAgainst} ~ ${top.productCode})`
      : `visual similarity ${top.visualScore.toFixed(3)}`;

    return NextResponse.json({
      detectedCodes,
      matchedProduct: full,
      matchType,
      confidence: Number(top.combinedScore.toFixed(4)),
      reason,
      alternativeMatches: combined.slice(1, 4).map((c) => ({
        _id: c._id,
        productCode: c.productCode ?? null,
        combinedScore: Number(c.combinedScore.toFixed(4)),
        codeDistance: c.codeDistance,
        visualScore: Number(c.visualScore.toFixed(4)),
        matchType: (c.hasCodeMatch ? 'fuzzy_code' : 'visual') satisfies MatchType,
      })),
    });
  } catch (error) {
    console.error('POST /api/products/scan-by-code error:', error);
    const message =
      error instanceof Error ? error.message : 'scan-by-code failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Post-process raw OCR output: strip non-digits and keep 4–8 digit strings.
 * The vision extractor already does this, but we re-validate defensively.
 */
function normalizeCodes(raw: string[]): string[] {
  const out = new Set<string>();
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const digits = item.replace(/\D/g, '');
    if (digits.length >= 4 && digits.length <= 8) out.add(digits);
  }
  return [...out];
}

/**
 * Scan stored productCodes once, compute Levenshtein distance to each
 * detected candidate, and return the best distance per product (capped at
 * {@link MAX_CODE_EDIT_DISTANCE}).
 */
async function findFuzzyCodeCandidates(
  detectedCodes: string[]
): Promise<FuzzyCandidate[]> {
  type Row = { _id: unknown; productCode?: string };
  const rows = (await Product.find(
    { productCode: { $exists: true, $nin: [null, ''] } },
    { _id: 1, productCode: 1 }
  ).lean()) as Row[];

  const out: FuzzyCandidate[] = [];
  for (const row of rows) {
    const pc = typeof row.productCode === 'string' ? row.productCode : '';
    if (!pc) continue;

    let best = MAX_CODE_EDIT_DISTANCE + 1;
    let bestAgainst = '';
    for (const candidate of detectedCodes) {
      const d = levenshtein(candidate, pc, MAX_CODE_EDIT_DISTANCE);
      if (d < best) {
        best = d;
        bestAgainst = candidate;
        if (d === 0) break;
      }
    }

    if (best <= MAX_CODE_EDIT_DISTANCE) {
      out.push({
        _id: row._id,
        productCode: pc,
        distance: best,
        matchedAgainst: bestAgainst,
      });
    }
  }

  out.sort((a, b) => a.distance - b.distance);
  return out;
}

interface RankedCandidate {
  _id: unknown;
  productCode: string | null;
  hasCodeMatch: boolean;
  codeDistance: number;
  matchedAgainst: string;
  codeScore: number;
  visualScore: number;
  combinedScore: number;
}

/**
 * Merge fuzzy-code and visual candidates by product id.
 *
 * - If a product appears in both sets: combinedScore = 0.6·codeScore + 0.4·visualScore.
 * - If code-only: visualScore = 0 → combinedScore = 0.6·codeScore.
 * - If visual-only: codeScore = 0 → combinedScore = 0.4·visualScore.
 *
 * Sorted descending by combinedScore.
 */
function combineCandidates(
  fuzzy: FuzzyCandidate[],
  visual: Array<{ _id: unknown; score: number }>
): RankedCandidate[] {
  const map = new Map<string, RankedCandidate>();

  for (const f of fuzzy) {
    const key = String(f._id);
    const codeScore = codeScoreFromDistance(f.distance);
    map.set(key, {
      _id: f._id,
      productCode: f.productCode,
      hasCodeMatch: true,
      codeDistance: f.distance,
      matchedAgainst: f.matchedAgainst,
      codeScore,
      visualScore: 0,
      combinedScore: CODE_WEIGHT * codeScore,
    });
  }

  for (const v of visual) {
    const key = String(v._id);
    const vs = Number.isFinite(v.score) ? Math.max(0, Math.min(1, v.score)) : 0;
    const existing = map.get(key);
    if (existing) {
      existing.visualScore = vs;
      existing.combinedScore =
        CODE_WEIGHT * existing.codeScore + VISUAL_WEIGHT * vs;
    } else {
      map.set(key, {
        _id: v._id,
        productCode: null,
        hasCodeMatch: false,
        codeDistance: MAX_CODE_EDIT_DISTANCE + 1,
        matchedAgainst: '',
        codeScore: 0,
        visualScore: vs,
        combinedScore: VISUAL_WEIGHT * vs,
      });
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => b.combinedScore - a.combinedScore
  );
}
