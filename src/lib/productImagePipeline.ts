import { generatePerceptualHash } from './imageUtils';
import { PRODUCT_FEATURE_PIPELINE_VERSION } from './productFeatureConstants';

export type ProductImageProgress = (
  key: string,
  current: number,
  total: number
) => void;

export { PRODUCT_FEATURE_PIPELINE_VERSION };

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Crops to the bounding box of non-transparent pixels (foreground cutout).
 */
export function trimTransparentDataUrl(
  dataUrl: string,
  options: { minAlpha?: number; padding?: number } = {}
): Promise<string> {
  const minAlpha = options.minAlpha ?? 12;
  const padding = options.padding ?? 8;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        if (!w || !h) {
          resolve(dataUrl);
          return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, w, h);
        const pixels = imageData.data;

        let minX = w;
        let minY = h;
        let maxX = 0;
        let maxY = 0;
        let found = false;

        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            if ((pixels[i + 3] ?? 0) > minAlpha) {
              found = true;
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }

        if (!found) {
          resolve(dataUrl);
          return;
        }

        minX = Math.max(0, minX - padding);
        minY = Math.max(0, minY - padding);
        maxX = Math.min(w - 1, maxX + padding);
        maxY = Math.min(h - 1, maxY + padding);

        const tw = maxX - minX + 1;
        const th = maxY - minY + 1;
        if (tw < 4 || th < 4) {
          resolve(dataUrl);
          return;
        }

        const out = document.createElement('canvas');
        out.width = tw;
        out.height = th;
        const octx = out.getContext('2d');
        if (!octx) {
          resolve(dataUrl);
          return;
        }

        octx.drawImage(canvas, minX, minY, tw, th, 0, 0, tw, th);
        resolve(out.toDataURL('image/png'));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => reject(new Error('Failed to load image for trim'));
    img.src = dataUrl;
  });
}

/**
 * Fallback when background removal fails: center square crop so edge background matters less.
 */
export function centerCropDataUrl(
  dataUrl: string,
  ratio = 0.68
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        if (!w || !h) {
          resolve(dataUrl);
          return;
        }
        const side = Math.round(Math.min(w, h) * ratio);
        const sx = Math.round((w - side) / 2);
        const sy = Math.round((h - side) / 2);
        const canvas = document.createElement('canvas');
        canvas.width = side;
        canvas.height = side;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, sx, sy, side, side, 0, 0, side, side);
        resolve(canvas.toDataURL('image/jpeg', 0.92));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => reject(new Error('Failed to load image for crop'));
    img.src = dataUrl;
  });
}

/**
 * Removes background (in-browser), trims to foreground, then hashes.
 * Falls back to center crop + same hash if removal fails.
 */
export async function prepareProductImageForMatching(
  rawDataUrl: string,
  options?: { progress?: ProductImageProgress }
): Promise<string> {
  const progress = options?.progress;

  try {
    const { removeBackground } = await import('@imgly/background-removal');
    const blob = await removeBackground(rawDataUrl, {
      model: 'isnet_quint8',
      progress: progress
        ? (key: string, current: number, total: number) =>
            progress(key, current, total)
        : undefined,
      output: { format: 'image/png' },
    });
    const cutoutUrl = await blobToDataUrl(blob);
    return trimTransparentDataUrl(cutoutUrl);
  } catch {
    return centerCropDataUrl(rawDataUrl, 0.68);
  }
}

export async function generateProductFeatureCode(
  rawDataUrl: string,
  options?: { progress?: ProductImageProgress }
): Promise<string> {
  const prepared = await prepareProductImageForMatching(rawDataUrl, options);
  return generatePerceptualHash(prepared);
}
