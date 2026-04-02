export function generatePerceptualHash(imageDataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 8;
        canvas.height = 8;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(fallbackHash(imageDataUrl));
          return;
        }

        ctx.drawImage(img, 0, 0, 8, 8);
        const pixels = ctx.getImageData(0, 0, 8, 8).data;
        const grayPixels: number[] = [];

        for (let i = 0; i < pixels.length; i += 4) {
          grayPixels.push(
            pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114
          );
        }

        const avg =
          grayPixels.reduce((a, b) => a + b, 0) / grayPixels.length;
        let binaryStr = '';
        for (const pixel of grayPixels) {
          binaryStr += pixel >= avg ? '1' : '0';
        }

        let hexHash = '';
        for (let i = 0; i < binaryStr.length; i += 4) {
          hexHash += parseInt(binaryStr.substring(i, i + 4), 2).toString(16);
        }

        resolve(hexHash);
      } catch {
        resolve(fallbackHash(imageDataUrl));
      }
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = imageDataUrl;
  });
}

function fallbackHash(data: string): string {
  let hash = 0;
  const sample = data.substring(0, 10000);
  for (let i = 0; i < sample.length; i++) {
    const char = sample.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
}

export function compareHashes(hash1: string, hash2: string): number {
  if (!hash1 || !hash2) return 0;
  if (hash1 === hash2) return 100;

  const maxLen = Math.max(hash1.length, hash2.length);
  const minLen = Math.min(hash1.length, hash2.length);

  let distance = 0;
  for (let i = 0; i < minLen; i++) {
    const b1 = parseInt(hash1[i], 16) || 0;
    const b2 = parseInt(hash2[i], 16) || 0;
    let xor = b1 ^ b2;
    while (xor) {
      distance += xor & 1;
      xor >>= 1;
    }
  }
  distance += (maxLen - minLen) * 4;

  const totalBits = maxLen * 4;
  return Math.round(((totalBits - distance) / totalBits) * 100);
}
