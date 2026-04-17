import sharp from 'sharp';
import {
  ATTRIBUTE_KEYS,
  HASH_ROTATIONS_DEG,
  coerceAttributes,
  emptyAttributes,
  type ProductAttributes,
} from '@/lib/constants/duplicateDetection';
import { EMBEDDING_DIMENSION } from '@/lib/constants/vectorSearch';
import { extractVisionInfoFromJpegBuffer } from '@/lib/services/visionAttributes';
import { embedDescriptionsBatch } from '@/lib/services/openaiImageEmbedding';

export interface MultiRotationFingerprint {
  /** Representative vector: L2-normalised average of all rotation embeddings. */
  embedding: number[];
  /** Individual rotation embeddings (index-aligned with {@link HASH_ROTATIONS_DEG}). */
  rotationEmbeddings: number[][];
  /** Description text chosen as the primary (longest / most informative). */
  description: string;
  /** Attributes merged across rotations (first non-empty value wins per key). */
  attributes: ProductAttributes;
}

function normalizeInPlace(vec: number[]): number[] {
  let sq = 0;
  for (let i = 0; i < vec.length; i++) {
    const v = vec[i]!;
    sq += v * v;
  }
  const norm = Math.sqrt(sq);
  if (!Number.isFinite(norm) || norm === 0) return vec;
  for (let i = 0; i < vec.length; i++) vec[i] = vec[i]! / norm;
  return vec;
}

function averageEmbeddings(vectors: number[][]): number[] {
  if (!vectors.length) {
    throw new Error('averageEmbeddings called with empty input');
  }
  const dim = vectors[0]!.length;
  if (dim !== EMBEDDING_DIMENSION) {
    throw new Error(
      `averageEmbeddings expected dim=${EMBEDDING_DIMENSION}, got ${dim}`
    );
  }
  const avg = new Array<number>(dim).fill(0);
  for (const v of vectors) {
    if (v.length !== dim) {
      throw new Error(`All vectors must have dim=${dim}`);
    }
    for (let i = 0; i < dim; i++) avg[i] = avg[i]! + v[i]!;
  }
  for (let i = 0; i < dim; i++) avg[i] = avg[i]! / vectors.length;
  return normalizeInPlace(avg);
}

function mergeAttributes(attrs: ProductAttributes[]): ProductAttributes {
  const merged = emptyAttributes();
  for (const key of ATTRIBUTE_KEYS) {
    for (const a of attrs) {
      const v = a[key];
      if (v) {
        merged[key] = v;
        break;
      }
    }
  }
  return merged;
}

async function rotateJpeg(squareJpeg: Buffer, deg: number): Promise<Buffer> {
  if (deg === 0) return squareJpeg;
  return sharp(squareJpeg)
    .rotate(deg)
    .jpeg({ quality: 55, mozjpeg: true, chromaSubsampling: '4:2:0' })
    .toBuffer();
}

/**
 * Build a rotation-robust visual fingerprint for a product photo.
 *
 * Pipeline:
 *  1. Render the image at 0°/90°/180°/270° (sharp, in-memory, microseconds).
 *  2. Run the four strict-JSON vision calls in parallel.
 *  3. Embed all four descriptions in a single batched OpenAI call.
 *  4. Return the normalised average embedding (for storage / "best" query
 *     vector) plus the individual rotation vectors (so the caller can also
 *     run a max-similarity search if desired) and merged attributes.
 *
 * The batched embeddings request means the four-way pipeline costs
 * ~ one vision-call latency (calls run in parallel) + one embedding call.
 */
export async function buildMultiRotationFingerprint(
  squareJpeg: Buffer
): Promise<MultiRotationFingerprint> {
  const rotatedBuffers = await Promise.all(
    HASH_ROTATIONS_DEG.map((deg) => rotateJpeg(squareJpeg, deg))
  );

  const visionResults = await Promise.all(
    rotatedBuffers.map((buf) => extractVisionInfoFromJpegBuffer(buf))
  );

  const descriptions = visionResults.map((v) => v.description.trim());

  // If the model failed on a rotation and returned empty, fall back to the
  // first non-empty description so every embedding input stays valid.
  const fallback = descriptions.find((d) => d.length > 0);
  if (!fallback) {
    throw new Error('Vision returned empty descriptions for all rotations');
  }
  const safeDescriptions = descriptions.map((d) => (d ? d : fallback));

  const rotationEmbeddings = await embedDescriptionsBatch(safeDescriptions);

  const avgEmbedding = averageEmbeddings(rotationEmbeddings);
  const attributes = mergeAttributes(
    visionResults.map((v) => coerceAttributes(v.attributes))
  );

  // Primary description = longest (most informative) of the four.
  const primary = safeDescriptions.reduce(
    (best, curr) => (curr.length > best.length ? curr : best),
    ''
  );

  return {
    embedding: avgEmbedding,
    rotationEmbeddings,
    description: primary,
    attributes,
  };
}

/**
 * Lightweight variant for QUERY paths (similar-check / search): we only need
 * the individual rotation vectors + merged attributes. Same cost as the
 * upload pipeline, but clearer intent at call sites.
 */
export async function buildRotationQueryVectors(
  squareJpeg: Buffer
): Promise<{ rotationEmbeddings: number[][]; attributes: ProductAttributes }> {
  const fp = await buildMultiRotationFingerprint(squareJpeg);
  return {
    rotationEmbeddings: fp.rotationEmbeddings,
    attributes: fp.attributes,
  };
}
