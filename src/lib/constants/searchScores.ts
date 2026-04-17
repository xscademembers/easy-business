/**
 * Atlas Vector Search: `vectorSearchScore` is higher for closer matches.
 * Scores are often clustered high for every document in small catalogs, so we use:
 * 1) an absolute minimum, 2) a margin below the *top* hit, 3) a max count.
 *
 * Tune with env vars if results are too strict or too loose.
 */

export function getVectorMatchMinScore(): number {
  const raw = process.env.VECTOR_MATCH_MIN_SCORE?.trim();
  /**
   * Customer-facing visual search floor. Lowered to 0.85 so rotated /
   * different-angle photos still surface results — the UI ranks by score
   * so lower-confidence matches naturally appear after strong ones.
   */
  if (!raw) return 0.85;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0.85;
}

/**
 * MongoDB `vectorSearchScore` is usually 0–1 but can be on other scales.
 * Normalize to 0–1 for threshold checks (e.g. 92 → 0.92).
 */
export function normalizeVectorMatchScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  if (score > 1) return Math.min(1, score / 100);
  return Math.min(1, Math.max(0, score));
}

/**
 * A result must score at least (topNorm - margin) as well as the absolute min.
 * Default margin 0 = only the strongest tier (≥ max(0.9, top)) — avoids listing the whole catalog.
 */
export function getVectorMatchRelativeMargin(): number {
  const raw = process.env.VECTOR_MATCH_RELATIVE_MARGIN?.trim();
  if (!raw) return 0;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? Math.min(0.5, Math.max(0, n)) : 0;
}

export function getVectorMatchMaxResults(): number {
  const raw = process.env.VECTOR_MATCH_MAX_RESULTS?.trim();
  if (!raw) return 1;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(20, n);
}

/** Above this score, an upload may be treated as a duplicate of an existing product. */
export function getVectorDuplicateMinScore(): number {
  const raw = process.env.VECTOR_DUPLICATE_MIN_SCORE?.trim();
  if (!raw) return 0.88;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0.88;
}

/**
 * Threshold for similar-check on admin upload (re-photos of the same item).
 * Lower than {@link getVectorDuplicateMinScore} so re-uploads are caught before creating a duplicate row.
 */
export function getVectorUploadDuplicateMinScore(): number {
  const raw = process.env.VECTOR_UPLOAD_DUPLICATE_MIN_SCORE?.trim();
  if (!raw) return 0.78;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0.78;
}

export interface VectorMatchMeta {
  topScore: number;
  absoluteMin: number;
  relativeMargin: number;
  /** Scores must be >= this to appear in "matches" */
  effectiveFloor: number;
  maxMatches: number;
}

/**
 * Split vector hits into strict matches vs the rest (for "similar" suggestions).
 */
export function selectStrictVectorMatches<T extends { _id: unknown; score: number }>(
  hits: T[]
): { matches: T[]; orderedRest: T[]; meta: VectorMatchMeta } {
  const absoluteMin = getVectorMatchMinScore();
  const relativeMargin = getVectorMatchRelativeMargin();
  const maxMatches = getVectorMatchMaxResults();

  if (!hits.length) {
    return {
      matches: [],
      orderedRest: [],
      meta: {
        topScore: 0,
        absoluteMin,
        relativeMargin,
        effectiveFloor: absoluteMin,
        maxMatches,
      },
    };
  }

  const sorted = [...hits].sort(
    (a, b) => normalizeVectorMatchScore(b.score) - normalizeVectorMatchScore(a.score)
  );
  const topNorm = normalizeVectorMatchScore(sorted[0]!.score);
  const effectiveFloor = Math.max(absoluteMin, topNorm - relativeMargin);

  const matchCandidates = sorted.filter(
    (h) => normalizeVectorMatchScore(h.score) >= effectiveFloor - 1e-9
  );
  const matches = matchCandidates.slice(0, maxMatches);

  const matchIds = new Set(matches.map((m) => String(m._id)));
  const orderedRest = sorted.filter((h) => !matchIds.has(String(h._id)));

  return {
    matches,
    orderedRest,
    meta: {
      topScore: topNorm,
      absoluteMin,
      relativeMargin,
      effectiveFloor,
      maxMatches,
    },
  };
}
