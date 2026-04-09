import type { Model } from 'mongoose';

const CODE_REGEX = /^\d{5,7}$/;

export function isValidProductCode(s: string): boolean {
  return CODE_REGEX.test(s.trim());
}

/**
 * Picks a random length in [5,7] and builds a numeric string (no leading zero).
 */
export function randomProductCode(): string {
  const len = 5 + Math.floor(Math.random() * 3);
  let digits = '';
  for (let i = 0; i < len; i++) {
    digits += i === 0 ? String(1 + Math.floor(Math.random() * 9)) : String(Math.floor(Math.random() * 10));
  }
  return digits;
}

export async function ensureUniqueProductCode(
  ProductModel: Model<{ productCode?: string }>,
  preferred?: string | null
): Promise<string> {
  const pref = typeof preferred === 'string' ? preferred.trim() : '';
  if (pref && isValidProductCode(pref)) {
    const taken = await ProductModel.exists({ productCode: pref });
    if (!taken) return pref;
  }
  for (let attempt = 0; attempt < 40; attempt++) {
    const candidate = randomProductCode();
    const taken = await ProductModel.exists({ productCode: candidate });
    if (!taken) return candidate;
  }
  throw new Error('Could not allocate a unique product code');
}
