/** Small QR Code Model 2 byte-mode encoder (L error correction), versions 1–5. */
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
let x = 1;
for (let i = 0; i < 255; i++) {
  EXP[i] = x;
  LOG[x] = i;
  x <<= 1;
  if (x & 0x100) x ^= 0x11d;
}
for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];

const multiply = (a: number, b: number): number => (a && b ? EXP[LOG[a] + LOG[b]] : 0);

function polynomialMultiply(a: number[], b: number[]): number[] {
  const out = Array(a.length + b.length - 1).fill(0) as number[];
  a.forEach((av, ai) => b.forEach((bv, bi) => (out[ai + bi] ^= multiply(av, bv))));
  return out;
}

function errorCorrection(data: number[], count: number): number[] {
  let generator = [1];
  for (let i = 0; i < count; i++) generator = polynomialMultiply(generator, [1, EXP[i]]);
  const message = [...data, ...Array(count).fill(0)];
  for (let i = 0; i < data.length; i++) {
    const factor = message[i];
    if (factor)
      for (let j = 0; j < generator.length; j++) message[i + j] ^= multiply(generator[j], factor);
  }
  return message.slice(data.length);
}

function formatBits(mask: number): number {
  const data = (1 << 3) | mask;
  let remainder = data << 10;
  for (let bit = 14; bit >= 10; bit--)
    if ((remainder >>> bit) & 1) remainder ^= 0x537 << (bit - 10);
  return ((data << 10) | remainder) ^ 0x5412;
}

function makeMatrix(payload: string, version: number): boolean[][] {
  const bytes = Array.from(new TextEncoder().encode(payload));
  const capacities = [0, 19, 34, 55, 80, 108];
  const eccCounts = [0, 7, 10, 15, 20, 26];
  const capacity = capacities[version];
  if (bytes.length > capacity || bytes.length >= 256)
    throw new Error('Doctor reference is too long for a QR code.');
  const bits: number[] = [];
  const push = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };
  push(4, 4);
  push(bytes.length, 8);
  bytes.forEach((byte) => push(byte, 8));
  const maxBits = capacity * 8;
  for (let i = 0; i < Math.min(4, maxBits - bits.length); i++) bits.push(0);
  while (bits.length % 8) bits.push(0);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8)
    data.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
  for (let pad = 0; data.length < capacity; pad++) data.push(pad % 2 ? 0x11 : 0xec);
  const all = [...data, ...errorCorrection(data, eccCounts[version])];
  const size = 17 + version * 4;
  const matrix = Array.from({ length: size }, () => Array(size).fill(false) as boolean[]);
  const reserved = Array.from({ length: size }, () => Array(size).fill(false) as boolean[]);
  const set = (row: number, col: number, value: boolean) => {
    matrix[row][col] = value;
    reserved[row][col] = true;
  };
  const finder = (top: number, left: number) => {
    for (let dy = -1; dy <= 7; dy++)
      for (let dx = -1; dx <= 7; dx++) {
        const row = top + dy,
          col = left + dx;
        if (row < 0 || col < 0 || row >= size || col >= size) continue;
        const inside = dy >= 0 && dy <= 6 && dx >= 0 && dx <= 6;
        const dark =
          inside &&
          (dy === 0 ||
            dy === 6 ||
            dx === 0 ||
            dx === 6 ||
            (dy >= 2 && dy <= 4 && dx >= 2 && dx <= 4));
        set(row, col, dark);
      }
  };
  finder(0, 0);
  finder(size - 7, 0);
  finder(0, size - 7);
  for (let i = 8; i < size - 8; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }
  const format = formatBits(0);
  for (let i = 0; i <= 5; i++) set(i, 8, ((format >>> i) & 1) !== 0);
  set(7, 8, ((format >>> 6) & 1) !== 0);
  set(8, 8, ((format >>> 7) & 1) !== 0);
  set(8, 7, ((format >>> 8) & 1) !== 0);
  for (let i = 9; i < 15; i++) set(8, 14 - i, ((format >>> i) & 1) !== 0);
  for (let i = 0; i < 8; i++) set(8, size - 1 - i, ((format >>> i) & 1) !== 0);
  for (let i = 8; i < 15; i++) set(size - 15 + i, 8, ((format >>> i) & 1) !== 0);
  set(size - 8, 8, true);
  if (version >= 2) {
    const centers =
      version === 2 ? [6, 18] : version === 3 ? [6, 22] : version === 4 ? [6, 26] : [6, 30];
    for (const row of centers)
      for (const col of centers) {
        if (reserved[row][col]) continue;
        for (let dy = -2; dy <= 2; dy++)
          for (let dx = -2; dx <= 2; dx++)
            set(row + dy, col + dx, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
  }
  const stream = all.flatMap((byte) => Array.from({ length: 8 }, (_, i) => (byte >>> (7 - i)) & 1));
  let index = 0,
    upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right--;
    for (let vert = 0; vert < size; vert++) {
      const row = upward ? size - 1 - vert : vert;
      for (let offset = 0; offset < 2; offset++) {
        const col = right - offset;
        if (reserved[row][col]) continue;
        const bit = index < stream.length ? stream[index++] !== 0 : false;
        matrix[row][col] = bit !== ((row + col) % 2 === 0);
      }
    }
    upward = !upward;
  }
  return matrix;
}

export function qrSvgDataUrl(payload: string): string {
  if (!payload || payload.length > 100) throw new Error('Doctor reference is invalid.');
  let version = 1;
  const byteLength = new TextEncoder().encode(payload).length;
  while (version < 5 && byteLength > [0, 17, 32, 53, 78, 106][version]) version++;
  const matrix = makeMatrix(payload, version);
  const quiet = 4,
    size = matrix.length + quiet * 2;
  const path = matrix
    .flatMap((row, y) =>
      row.flatMap((dark, xx) => (dark ? [`M${xx + quiet},${y + quiet}h1v1h-1z`] : [])),
    )
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="white"/><path d="${path}" fill="black"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
