import { qrSvgDataUrl } from './qr-svg';

describe('qrSvgDataUrl', () => {
  it('encodes a 32-character opaque reference in a Model 2 QR SVG', () => {
    const encoded = qrSvgDataUrl('0123456789abcdef0123456789abcdef');
    const svg = decodeURIComponent(encoded.split(',')[1]);

    expect(encoded.startsWith('data:image/svg+xml,')).toBe(true);
    expect(svg).toContain('viewBox="0 0 33 33"');
    expect(svg).toContain('<path d="M');
    expect(svg).not.toContain('Synthetic ML60 Doctor');
  });

  it('supports QR references up to 100 characters and rejects invalid input', () => {
    expect(() => qrSvgDataUrl('R'.repeat(100))).not.toThrow();
    expect(() => qrSvgDataUrl('')).toThrow('Doctor reference is invalid.');
    expect(() => qrSvgDataUrl('R'.repeat(101))).toThrow('Doctor reference is invalid.');
  });
});
