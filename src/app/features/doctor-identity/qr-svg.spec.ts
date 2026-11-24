import jsQR from 'jsqr';
import { qrSvgDataUrl } from './qr-svg';

function decodeSvg(dataUrl: string): string | undefined {
  const svg = decodeURIComponent(dataUrl.split(',')[1]);
  const size = Number(svg.match(/viewBox="0 0 (\d+) \d+"/)?.[1]);
  const scale = 8;
  const width = size * scale;
  const pixels = new Uint8ClampedArray(width * width * 4).fill(255);
  for (const match of svg.matchAll(/M(\d+),(\d+)h1v1h-1z/g)) {
    const x = Number(match[1]) * scale;
    const y = Number(match[2]) * scale;
    for (let row = y; row < y + scale; row++) {
      for (let col = x; col < x + scale; col++) {
        const offset = (row * width + col) * 4;
        pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = 0;
      }
    }
  }
  return jsQR(pixels, width, width)?.data;
}

describe('qrSvgDataUrl', () => {
  it.each([
    '0123456789abcdef0123456789abcdef',
    'R'.repeat(101),
    'R'.repeat(256),
    'é'.repeat(256),
    '😀'.repeat(200),
  ])('round trips an API-valid reference through an independent decoder', (reference) => {
    expect(decodeSvg(qrSvgDataUrl(reference))).toBe(reference);
  });

  it('generates a QR for 256 four-byte characters', () => {
    expect(qrSvgDataUrl('😀'.repeat(256))).toMatch(/^data:image\/svg\+xml,/);
  });

  it('rejects references outside the API character limit', () => {
    expect(() => qrSvgDataUrl('')).toThrow('Doctor reference is invalid.');
    expect(() => qrSvgDataUrl('R'.repeat(257))).toThrow('Doctor reference is invalid.');
    expect(() => qrSvgDataUrl('😀'.repeat(257))).toThrow('Doctor reference is invalid.');
  });
});
