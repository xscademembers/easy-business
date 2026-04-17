import sharp from 'sharp';

function stripDataUrl(input: string): Buffer {
  const base64 = input.includes(',') ? input.split(',')[1]! : input;
  return Buffer.from(base64, 'base64');
}

export interface NormalizedImage {
  /** Square JPEG buffer at `size` × `size`, auto-oriented via EXIF. */
  buffer: Buffer;
  /** base64 JPEG data-URL of `buffer` (useful for storing as `image_url`). */
  dataUrl: string;
  /** Grayscale raw pixel buffer for hashing (size 9×8 = 72 bytes for dHash). */
  grayHash: Buffer;
}

/**
 * Produce a canonical representation of a product photo for all visual
 * matching paths (upload, similar-check, visual search).
 *
 * Guarantees:
 *  - EXIF orientation applied (phones tend to ship sideways JPEGs).
 *  - Aspect ratio preserved; image centred and padded to square so the
 *    embedding sees the same framing for portrait/landscape/square inputs.
 *  - Fixed output size (default 384 px, JPEG q55) for predictable latency
 *    and bandwidth to OpenAI.
 *
 * Default 384/q55 is chosen so the upload + vision + embedding round-trip
 * stays comfortably under the 2 s SLA on a typical network.
 */
export async function normalizeProductImage(
  input: Buffer | string,
  opts: { size?: number; quality?: number } = {}
): Promise<NormalizedImage> {
  const size = opts.size ?? 384;
  const quality = opts.quality ?? 55;

  const raw = typeof input === 'string' ? stripDataUrl(input) : input;

  const square = await sharp(raw)
    .rotate()
    .resize({
      width: size,
      height: size,
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 1 },
      withoutEnlargement: false,
    })
    .jpeg({ quality, mozjpeg: true, chromaSubsampling: '4:2:0' })
    .toBuffer();

  const grayHash = await sharp(square)
    .grayscale()
    .resize(9, 8, { fit: 'fill' })
    .raw()
    .toBuffer();

  const dataUrl = `data:image/jpeg;base64,${square.toString('base64')}`;
  return { buffer: square, dataUrl, grayHash };
}
