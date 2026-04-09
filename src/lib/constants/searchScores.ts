/**
 * Atlas Vector Search: `vectorSearchScore` is higher for closer matches.
 * Scores are often clustered high for every document in small catalogs, so we use:
 * 1) an absolute minimum, 2) a margin below the *top* hit, 3) a max count.
 *
 * Tune with env vars if results are too strict or too loose.
 */

export function getVectorMatchMinScore(): number {
  const raw = process.env.VECTOR_MATCH_MIN_SCORE?.trim();
  /** Stricter default so random catalog items are not all "matches". */
  if (!raw) return 0.9;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0.9;
}

/**
 * A result must score at least (topScore - margin) to count as a match with the winner.
 * Stops the whole list from qualifying when scores are only slightly below the best.
 */
export function getVectorMatchRelativeMargin(): number {
  const raw = process.env.VECTOR_MATCH_RELATIVE_MARGIN?.trim();
  if (!raw) return 0.042;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? Math.min(0.5, Math.max(0, n)) : 0.042;
}

export function getVectorMatchMaxResults(): number {
  const raw = process.env.VECTOR_MATCH_MAX_RESULTS?.trim();
  if (!raw) return 3;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return 3;
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

  const sorted = [...hits].sort((a, b) => b.score - a.score);
  const topScore = sorted[0]!.score;
  const effectiveFloor = Math.max(absoluteMin, topScore - relativeMargin);

  const matchCandidates = sorted.filter((h) => h.score >= effectiveFloor);
  const matches = matchCandidates.slice(0, maxMatches);

  const matchIds = new Set(matches.map((m) => String(m._id)));
  const orderedRest = sorted.filter((h) => !matchIds.has(String(h._id)));

  return {
    matches,
    orderedRest,
    meta: {
      topScore,
      absoluteMin,
      relativeMargin,
      effectiveFloor,
      maxMatches,
    },
  };
}
