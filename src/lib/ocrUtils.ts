import Tesseract from 'tesseract.js';

/**
 * Normalise OCR output: lowercase, collapse whitespace, strip non-alphanumeric (keep spaces).
 */
export function normalizeOcrText(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Preprocess the image for better OCR: grayscale + contrast boost.
 * Helps with rotated / zoomed / varied-background images.
 */
function preprocessForOcr(imageDataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        if (!w || !h) {
          resolve(imageDataUrl);
          return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(imageDataUrl);
          return;
        }

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, w, h);
        const d = imageData.data;

        for (let i = 0; i < d.length; i += 4) {
          const gray = d[i]! * 0.299 + d[i + 1]! * 0.587 + d[i + 2]! * 0.114;
          const contrasted = Math.min(255, Math.max(0, (gray - 128) * 1.6 + 128));
          d[i] = d[i + 1] = d[i + 2] = contrasted;
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(imageDataUrl);
      }
    };
    img.onerror = () => resolve(imageDataUrl);
    img.src = imageDataUrl;
  });
}

/**
 * Read visible text from a photo (in the browser). Used together with visual matching
 * for product lookup—not full object detection.
 */
export async function extractTextFromImage(
  imageDataUrl: string,
  onProgress?: (fraction: number) => void
): Promise<{ raw: string; normalized: string }> {
  try {
    const processed = await preprocessForOcr(imageDataUrl);
    onProgress?.(0.05);

    const result = await Tesseract.recognize(processed, 'eng', {
      logger: (m: { status?: string; progress?: number }) => {
        if (!onProgress) return;
        const s = (m.status || '').toLowerCase();
        if (s.includes('recognizing')) {
          const p = typeof m.progress === 'number' ? m.progress : 0;
          onProgress(0.12 + p * 0.88);
        } else if (s.includes('loading') || s.includes('initializ')) {
          onProgress(0.08);
        }
      },
    });

    onProgress?.(1);

    const raw = (result.data.text ?? '').trim();
    return { raw, normalized: normalizeOcrText(raw) };
  } catch (err) {
    console.warn('[ocrUtils] OCR failed:', err);
    return { raw: '', normalized: '' };
  }
}

/**
 * Levenshtein edit distance between two strings.
 */
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const m = a.length;
  const n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array<number>(n + 1);

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + cost);
    }
    [prev, curr] = [curr, prev];
  }

  return prev[n]!;
}

/**
 * Check if two words are a fuzzy match (handles OCR mis-reads like 0/O, 1/l/I).
 * Words match if edit distance is ≤ 1 for short words, ≤ 2 for longer words.
 */
function wordsMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen <= 2) return a === b;
  const threshold = maxLen <= 5 ? 1 : 2;
  return editDistance(a, b) <= threshold;
}

/**
 * Containment-based OCR similarity (0–100).
 *
 * Measures: "how many words from the shorter text are found (fuzzy) in the longer text?"
 * This is resilient to background noise words and partial scans.
 *
 * Example:
 *   stored  = "coca cola zero sugar 500ml"
 *   scanned = "coca cola zero sugar 500ml wooden table"
 *   → 5 of 5 stored words found in scan → 100%
 *
 *   stored  = "coca cola zero sugar 500ml"
 *   scanned = "coca cola sugar"
 *   → 3 of 5 stored words found in scan → 60%
 */
export function compareOcrTexts(stored: string, scanned: string): number {
  if (!stored || !scanned) return 0;
  if (stored === scanned) return 100;

  const storedWords = stored.split(' ').filter((w) => w.length > 0);
  const scannedWords = scanned.split(' ').filter((w) => w.length > 0);

  if (storedWords.length === 0 || scannedWords.length === 0) return 0;

  let storedInScanned = 0;
  for (const sw of storedWords) {
    if (scannedWords.some((w) => wordsMatch(sw, w))) storedInScanned++;
  }
  const coverageOfStored = storedInScanned / storedWords.length;

  let scannedInStored = 0;
  for (const sw of scannedWords) {
    if (storedWords.some((w) => wordsMatch(sw, w))) scannedInStored++;
  }
  const coverageOfScanned = scannedInStored / scannedWords.length;

  const score = Math.max(coverageOfStored, coverageOfScanned);

  return Math.round(score * 100);
}
