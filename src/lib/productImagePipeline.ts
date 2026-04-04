import { generatePerceptualHash } from './imageUtils';
import { PRODUCT_FEATURE_PIPELINE_VERSION } from './productFeatureConstants';
import { extractTextFromImage, normalizeOcrText } from './ocrUtils';

/** Kept for API compatibility; prefer `ProcessProductImageOptions.onProgress` for UI. */
export type ProductImageProgress = (
  key: string,
  current: number,
  total: number
) => void;

export { PRODUCT_FEATURE_PIPELINE_VERSION };

export interface ProductImageResult {
  featureCode: string;
  ocrText: string;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsDataURL(blob);
  });
}

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

async function prepareProductImageForMatching(
  rawDataUrl: string,
  onPrepareFraction?: (fraction: number) => void
): Promise<string> {
  const bump = (current: number, total: number) => {
    const f = total > 0 ? Math.min(1, current / total) : 0;
    onPrepareFraction?.(f);
  };
  try {
    const { removeBackground } = await import('@imgly/background-removal');
    const blob = await removeBackground(rawDataUrl, {
      model: 'isnet_quint8',
      output: { format: 'image/png' },
      progress: onPrepareFraction
        ? (_key: string, current: number, total: number) => bump(current, total)
        : undefined,
    });
    onPrepareFraction?.(1);
    const cutoutUrl = await blobToDataUrl(blob);
    return trimTransparentDataUrl(cutoutUrl);
  } catch (err) {
    console.warn('[productImagePipeline] Background removal failed, using center crop:', err);
    onPrepareFraction?.(1);
    return centerCropDataUrl(rawDataUrl, 0.68);
  }
}

export interface ProcessProductImageOptions {
  /** 0–100, monotonic; combines background prep, visual pass, and text-reading pass running in parallel. */
  onProgress?: (percent: number) => void;
}

/**
 * Full pipeline: background removal + visual hash, and text read from the photo, in parallel.
 * Returns featureCode (visual similarity) and normalised text for catalog matching.
 */
export async function processProductImage(
  rawDataUrl: string,
  options?: ProcessProductImageOptions
): Promise<ProductImageResult> {
  const onProgress = options?.onProgress;
  let lastPct = 0;
  const report = (pct: number) => {
    const v = Math.max(lastPct, Math.min(100, Math.round(pct)));
    lastPct = v;
    onProgress?.(v);
  };

  let prepFrac = 0;
  let hashDone = false;
  let ocrFrac = 0;

  const emit = () => {
    const prepChain = Math.min(100, prepFrac * 90 + (hashDone ? 10 : 0));
    const ocrChain = Math.min(100, ocrFrac * 100);
    report(0.5 * prepChain + 0.5 * ocrChain);
  };

  report(2);

  const [featureCode, ocr] = await Promise.all([
    (async () => {
      const prepared = await prepareProductImageForMatching(rawDataUrl, (f) => {
        prepFrac = f;
        emit();
      });
      const h = await generatePerceptualHash(prepared);
      hashDone = true;
      emit();
      return h;
    })(),
    (async () => {
      const result = await extractTextFromImage(rawDataUrl, (f) => {
        ocrFrac = f;
        emit();
      });
      ocrFrac = 1;
      emit();
      return result.normalized;
    })(),
  ]);

  report(100);
  return { featureCode, ocrText: ocr };
}

/** @deprecated Use processProductImage instead. Kept for backward compatibility. */
export async function generateProductFeatureCode(
  rawDataUrl: string,
  options?: { progress?: ProductImageProgress; onProgress?: (percent: number) => void }
): Promise<string> {
  void options?.progress;
  const result = await processProductImage(rawDataUrl, {
    onProgress: options?.onProgress,
  });
  return result.featureCode;
}

export { normalizeOcrText };
