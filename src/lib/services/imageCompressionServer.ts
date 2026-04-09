import sharp from 'sharp';

function stripDataUrl(dataUrlOrBase64: string): Buffer {
  const base64 = dataUrlOrBase64.includes(',')
    ? dataUrlOrBase64.split(',')[1]!
    : dataUrlOrBase64;
  return Buffer.from(base64, 'base64');
}

/**
 * Resize and JPEG-compress an image before embedding (OpenAI vision + embeddings).
 * Keeps largest side ≤ maxSide; does not upscale small images.
 */
export async function compressImageForClip(
  input: Buffer | string,
  maxSide = 512,
  jpegQuality = 82
): Promise<{ buffer: Buffer; dataUrl: string }> {
  const buf = typeof input === 'string' ? stripDataUrl(input) : input;
  const out = await sharp(buf)
    .rotate()
    .resize({
      width: maxSide,
      height: maxSide,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: jpegQuality, mozjpeg: true })
    .toBuffer();
  const dataUrl = `data:image/jpeg;base64,${out.toString('base64')}`;
  return { buffer: out, dataUrl };
}
