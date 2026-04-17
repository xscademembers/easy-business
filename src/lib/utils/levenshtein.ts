/**
 * Classic two-row Levenshtein distance.
 *
 * - O(m * n) time, O(min(m, n)) memory.
 * - Pure JavaScript numbers / arrays so it compiles cleanly under ES2017.
 * - Short-circuits when the length difference already exceeds `maxDistance`,
 *   which makes fuzzy product-code scans on a catalog cheap even without a
 *   trigram index in Mongo.
 *
 * Typical use for 4–8 digit product codes runs in microseconds.
 */
export function levenshtein(a: string, b: string, maxDistance?: number): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  if (typeof maxDistance === 'number' && Math.abs(m - n) > maxDistance) {
    return maxDistance + 1;
  }

  const short = m < n ? a : b;
  const long = m < n ? b : a;
  const s = short.length;
  const l = long.length;

  let prev = new Array<number>(s + 1);
  let curr = new Array<number>(s + 1);
  for (let j = 0; j <= s; j++) prev[j] = j;

  for (let i = 1; i <= l; i++) {
    curr[0] = i;
    let rowMin = curr[0]!;
    const longCharI = long.charCodeAt(i - 1);
    for (let j = 1; j <= s; j++) {
      const cost = longCharI === short.charCodeAt(j - 1) ? 0 : 1;
      const del = prev[j]! + 1;
      const ins = curr[j - 1]! + 1;
      const sub = prev[j - 1]! + cost;
      const v = del < ins ? (del < sub ? del : sub) : ins < sub ? ins : sub;
      curr[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (typeof maxDistance === 'number' && rowMin > maxDistance) {
      return maxDistance + 1;
    }
    const tmp = prev;
    prev = curr;
    curr = tmp;
  }

  return prev[s]!;
}

/**
 * Map an edit distance to a normalised 0..1 score used by hybrid ranking.
 *   0 (exact)  → 1.0
 *   1          → 0.8
 *   2          → 0.6
 *   ≥ 3        → 0.0
 */
export function codeScoreFromDistance(distance: number): number {
  if (distance <= 0) return 1;
  if (distance === 1) return 0.8;
  if (distance === 2) return 0.6;
  return 0;
}
