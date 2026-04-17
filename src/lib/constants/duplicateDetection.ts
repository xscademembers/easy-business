/**
 * Strict duplicate-detection rules used by the admin upload flow.
 * Tuned to avoid false positives on colour / pattern variants of the same
 * underlying product type. All values can be overridden via env vars.
 */

function clampUnit(n: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback;
  return Math.min(1, Math.max(0, n));
}

/** Vector cosine similarity required to even consider two items as "same". */
export function getSameProductMinScore(): number {
  const raw = process.env.SAME_PRODUCT_MIN_SCORE?.trim();
  if (!raw) return 0.97;
  return clampUnit(Number.parseFloat(raw), 0.97);
}

/**
 * Visual search floor for storefront results. Below this score we return nothing.
 * Kept separate from the duplicate-match floor so customer search can stay looser.
 */
export function getVisualSearchMinScore(): number {
  const raw = process.env.VISUAL_SEARCH_MIN_SCORE?.trim();
  if (!raw) return 0.82;
  return clampUnit(Number.parseFloat(raw), 0.82);
}

/** Defaults for Atlas $vectorSearch on hot paths (kept small for latency). */
export const FAST_VECTOR_LIMIT = 3;
export const FAST_VECTOR_NUM_CANDIDATES = 20;

/** Rotations we hash at upload to make hash lookup rotation-invariant. */
export const HASH_ROTATIONS_DEG = [0, 90, 180, 270] as const;

/** Keys present on the vision-attributes payload. Order is stable for hashing. */
export const ATTRIBUTE_KEYS = [
  'product_type',
  'brand',
  'primary_color',
  'secondary_color',
  'pattern',
  'shape',
  'logo_text',
  'unique_features',
] as const;

export type AttributeKey = (typeof ATTRIBUTE_KEYS)[number];
export type ProductAttributes = Record<AttributeKey, string>;

export function emptyAttributes(): ProductAttributes {
  return {
    product_type: '',
    brand: '',
    primary_color: '',
    secondary_color: '',
    pattern: '',
    shape: '',
    logo_text: '',
    unique_features: '',
  };
}

function normalizeAttr(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
}

export function coerceAttributes(input: unknown): ProductAttributes {
  const out = emptyAttributes();
  if (!input || typeof input !== 'object') return out;
  const src = input as Record<string, unknown>;
  for (const key of ATTRIBUTE_KEYS) {
    out[key] = normalizeAttr(src[key]);
  }
  return out;
}

/**
 * Attribute decision: "contradiction" means both values are present AND differ.
 * Missing values on either side are treated as "unknown" (not a contradiction),
 * so legacy products without stored attributes still get a sensible decision.
 */
function contradicts(a: string, b: string): boolean {
  if (!a || !b) return false;
  return a !== b;
}

export interface SameProductDecision {
  status: 'same' | 'new';
  confidence: number;
  reason: string;
}

/**
 * Core strict rule. Returns 'same' only when cosine ≥ threshold AND none of the
 * identity-defining attributes contradict each other.
 */
export function decideSameProduct(params: {
  vectorScore: number;
  candidate: ProductAttributes;
  query: ProductAttributes;
  threshold?: number;
}): SameProductDecision {
  const threshold = params.threshold ?? getSameProductMinScore();
  const score = Number.isFinite(params.vectorScore) ? params.vectorScore : 0;

  if (score < threshold) {
    return {
      status: 'new',
      confidence: score,
      reason: `vector ${score.toFixed(3)} < ${threshold.toFixed(3)}`,
    };
  }

  if (contradicts(params.candidate.product_type, params.query.product_type)) {
    return { status: 'new', confidence: score, reason: 'product_type differs' };
  }
  if (contradicts(params.candidate.primary_color, params.query.primary_color)) {
    return { status: 'new', confidence: score, reason: 'primary_color differs' };
  }
  if (contradicts(params.candidate.brand, params.query.brand)) {
    return { status: 'new', confidence: score, reason: 'brand differs' };
  }
  if (contradicts(params.candidate.pattern, params.query.pattern)) {
    return { status: 'new', confidence: score, reason: 'pattern differs' };
  }
  if (contradicts(params.candidate.logo_text, params.query.logo_text)) {
    return { status: 'new', confidence: score, reason: 'logo_text differs' };
  }

  return { status: 'same', confidence: score, reason: 'vector + attributes match' };
}
