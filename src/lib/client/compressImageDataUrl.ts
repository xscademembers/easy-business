/**
 * Client-side resize + JPEG encode before upload (reduces payload and API latency).
 * Largest side is capped at maxSide; uses 8px-aligned dimensions where practical.
 */
export function compressImageDataUrl(
  dataUrl: string,
  maxSide = 512,
  quality = 0.82
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
        const scale = Math.min(1, maxSide / Math.max(w, h));
        const tw = Math.max(8, Math.round((w * scale) / 8) * 8);
        const th = Math.max(8, Math.round((h * scale) / 8) * 8);
        const canvas = document.createElement('canvas');
        canvas.width = tw;
        canvas.height = th;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, tw, th);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch (e) {
        reject(e instanceof Error ? e : new Error('compress failed'));
      }
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataUrl;
  });
}

/**
 * Tight preset used by visual-match flows (product upload, similar-check,
 * visual search). Matches the server-side canonicalisation: 384 px longest
 * side at JPEG quality 0.55 — small enough to hit the <2 s upload target
 * without noticeably hurting recognition accuracy.
 */
export function compressImageForVisualMatch(dataUrl: string): Promise<string> {
  return compressImageDataUrl(dataUrl, 384, 0.55);
}
