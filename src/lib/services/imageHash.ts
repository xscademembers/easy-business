import sharp from 'sharp';
import { HASH_ROTATIONS_DEG } from '@/lib/constants/duplicateDetection';

/**
 * Compute a 64-bit dHash from a pre-rendered 9×8 grayscale pixel buffer.
 * dHash is robust to brightness/contrast shifts and small crops, which makes
 * it a reliable "exact duplicate" fingerprint for re-uploads of the same
 * product photo (identical or near-identical pixels).
 *
 * Implemented byte-by-byte (no BigInt) so it compiles under ES2017.
 */
export function dHashFromGrayscale9x8(gray: Buffer): string {
  if (gray.length !== 72) {
    throw new Error(`dHash expects 9×8 grayscale (72 bytes), got ${gray.length}`);
  }
  let hex = '';
  for (let y = 0; y < 8; y++) {
    const row = y * 9;
    let byte = 0;
    for (let x = 0; x < 8; x++) {
      const left = gray[row + x]!;
      const right = gray[row + x + 1]!;
      byte = ((byte << 1) | (left < right ? 1 : 0)) & 0xff;
    }
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Build a rotation-invariant fingerprint set: dHash at 0°/90°/180°/270°.
 * Storing all four means we can match a rotated re-upload with a single
 * hash comparison (no vector search required).
 */
export async function dHashAllRotations(squareJpeg: Buffer): Promise<string[]> {
  const hashes = await Promise.all(
    HASH_ROTATIONS_DEG.map(async (deg) => {
      const gray = await sharp(squareJpeg)
        .rotate(deg)
        .grayscale()
        .resize(9, 8, { fit: 'fill' })
        .raw()
        .toBuffer();
      return dHashFromGrayscale9x8(gray);
    })
  );
  // Deduplicate in the (rare) case two rotations collide.
  return Array.from(new Set(hashes));
}

/**
 * Population-count (Hamming weight) of an 8-bit value.
 * Branch-free, ES5-compatible.
 */
function popcount8(v: number): number {
  let x = v & 0xff;
  x = x - ((x >> 1) & 0x55);
  x = (x & 0x33) + ((x >> 2) & 0x33);
  return (x + (x >> 4)) & 0x0f;
}

/** Hamming distance between two 16-hex-char dHash strings (0..64). */
export function hashDistance(a: string, b: string): number {
  if (a.length !== 16 || b.length !== 16) return 64;
  let count = 0;
  for (let i = 0; i < 16; i += 2) {
    const av = parseInt(a.slice(i, i + 2), 16);
    const bv = parseInt(b.slice(i, i + 2), 16);
    if (Number.isNaN(av) || Number.isNaN(bv)) return 64;
    count += popcount8(av ^ bv);
  }
  return count;
}
