import { create } from 'qrcode';

/** Encode the server's opaque doctor reference without adding identity information. */
export function qrSvgDataUrl(payload: string): string {
  // The API uses character length, while QR capacity is based on UTF-8 bytes.
  if (!payload || Array.from(payload).length > 256) {
    throw new Error('Doctor reference is invalid.');
  }

  const qr = create([{ data: new TextEncoder().encode(payload), mode: 'byte' }], {
    errorCorrectionLevel: 'L',
  });
  const quiet = 4;
  const size = qr.modules.size + quiet * 2;
  const path: string[] = [];
  for (let y = 0; y < qr.modules.size; y++) {
    for (let x = 0; x < qr.modules.size; x++) {
      if (qr.modules.get(y, x)) path.push(`M${x + quiet},${y + quiet}h1v1h-1z`);
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="white"/><path d="${path.join('')}" fill="black"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
