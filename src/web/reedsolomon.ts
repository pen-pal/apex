// Reed-Solomon erasure coding over GF(256) — the real field (Rijndael's, poly 0x11b) used
// by QR codes, CDs/DVDs, and RAID-6. Treat k data bytes as the values of a degree-(k-1)
// polynomial at k points; evaluating that polynomial at n > k points gives a codeword with
// n-k redundant symbols. Lose ANY n-k symbols and the remaining k points still pin down the
// same polynomial (Lagrange interpolation), so every byte is recoverable. This encoder is
// systematic — the first k codeword symbols ARE the data — and the math is genuine GF(256),
// not a prime-field stand-in. Pure and tested (GF products vs FIPS-197 + full recovery).

// ── GF(256) arithmetic via exp/log tables, generator 3, reduction poly 0x11b ──
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
function mulNoTable(a: number, b: number): number {
  let p = 0;
  for (let i = 0; i < 8; i++) {
    if (b & 1) p ^= a;
    const hi = a & 0x80;
    a = (a << 1) & 0xff;
    if (hi) a ^= 0x1b;
    b >>= 1;
  }
  return p;
}
(() => {
  let v = 1;
  for (let i = 0; i < 255; i++) { EXP[i] = v; LOG[v] = i; v = mulNoTable(v, 3); }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

export const gmul = (a: number, b: number): number => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);
// precondition: b ≠ 0 (denominators here are differences of DISTINCT interpolation x-coords, never zero)
export const gdiv = (a: number, b: number): number => (a === 0 ? 0 : EXP[(LOG[a] - LOG[b] + 255) % 255]);
const gsub = (a: number, b: number) => a ^ b; // subtraction == addition == XOR in GF(2^n)

/** Lagrange-interpolate the polynomial through `points` and evaluate it at `atX`. */
export function interpolateEval(points: [number, number][], atX: number): number {
  let acc = 0;
  for (let i = 0; i < points.length; i++) {
    const [xi, yi] = points[i];
    let num = 1, den = 1;
    for (let j = 0; j < points.length; j++) {
      if (j === i) continue;
      num = gmul(num, gsub(atX, points[j][0]));
      den = gmul(den, gsub(xi, points[j][0]));
    }
    acc = gsub(acc, gmul(yi, gdiv(num, den)));
  }
  return acc;
}

/** Encode k data bytes into an n-symbol systematic codeword (points x = 1..n). */
export function encode(data: number[], n: number): number[] {
  const k = data.length;
  const known: [number, number][] = data.map((y, i) => [i + 1, y]);
  const out: number[] = [];
  for (let j = 0; j < n; j++) out.push(j < k ? data[j] : interpolateEval(known, j + 1));
  return out;
}

/** Recover the k data bytes from a received codeword with erasures (null = lost).
 *  Returns null if fewer than k symbols survive. */
export function decode(received: (number | null)[], k: number): number[] | null {
  const survivors: [number, number][] = [];
  received.forEach((v, idx) => { if (v !== null) survivors.push([idx + 1, v]); });
  if (survivors.length < k) return null; // too many erasures
  const pts = survivors.slice(0, k);
  return Array.from({ length: k }, (_, i) => interpolateEval(pts, i + 1));
}
