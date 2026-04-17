import sharp from 'sharp';
import { HASH_ROTATIONS_DEG } from '@/lib/constants/duplicateDetection';

/**
 * Compute a 64-bit dHash from a pre-rendered 9×8 grayscale pixel buffer.
 * dHash is robust to brightness/contrast shifts and small crops, which makes
 * it a reliable "exact duplicate" fingerprint for re-uploads of the same
 * product photo (identical or near-identical pixels).
 */
export function dHashFromGrayscale9x8(gray: Buffer): string {
  if (gray.length !== 72) {
    throw new Error(`dHash expects 9×8 grayscale (72 bytes), got ${gray.length}`);
  }
  let hash = 0n;
  for (let y = 0; y < 8; y++) {
    const row = y * 9;
    for (let x = 0; x < 8; x++) {
      const left = gray[row + x]!;
      const right = gray[row + x + 1]!;
      hash = (hash << 1n) | (left < right ? 1n : 0n);
    }
  }
  return hash.toString(16).padStart(16, '0');
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

/** Hamming distance between two 16-hex-char dHash strings (0..64). */
export function hashDistance(a: string, b: string): number {
  if (a.length !== 16 || b.length !== 16) return 64;
  const x = BigInt('0x' + a) ^ BigInt('0x' + b);
  let v = x;
  let count = 0;
  while (v !== 0n) {
    v &= v - 1n;
    count++;
  }
  return count;
}
