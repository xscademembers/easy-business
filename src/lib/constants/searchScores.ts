/**
 * Atlas vector search scores are similarity-like (higher = closer match).
 * Tune via env if results are too strict or too loose.
 */
export function getVectorMatchMinScore(): number {
  const raw = process.env.VECTOR_MATCH_MIN_SCORE?.trim();
  if (!raw) return 0.75;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0.75;
}

/** Above this score, an upload may be treated as a duplicate of an existing product. */
export function getVectorDuplicateMinScore(): number {
  const raw = process.env.VECTOR_DUPLICATE_MIN_SCORE?.trim();
  if (!raw) return 0.88;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0.88;
}
