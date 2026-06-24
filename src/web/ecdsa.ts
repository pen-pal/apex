// ECDSA on the same toy curve as the ECC section — signing, verifying, and the
// catastrophe that has burned real systems: reuse the per-signature nonce k and
// the private key falls out of two signatures by simple algebra. This is exactly
// how the Sony PS3 firmware key (2010) and a string of Bitcoin wallets were
// stolen. The scalar field is the curve order n = 19; arithmetic is real.
import { CURVE, mul, add, order, modinv, type Point } from './ecc';

const N = order(CURVE); // the subgroup order; signatures live mod N
const m = (n: number) => ((n % N) + N) % N;

export interface Sig { r: number; s: number }

/** Sign hash z with private key d using nonce k (caller supplies k so the demo
 *  can deliberately reuse it). r = (kG).x mod N; s = k^{-1}(z + r·d) mod N. */
export function ecdsaSign(z: number, d: number, k: number): Sig {
  const R = mul(m(k), CURVE.G, CURVE).point as Point;
  const r = m(R.x);
  const s = m(modinv(m(k), N) * (m(z) + r * d));
  return { r, s };
}

/** Verify: P = (z·s^{-1})G + (r·s^{-1})Q ; valid iff P.x mod N == r. */
export function ecdsaVerify(z: number, sig: Sig, Q: Point): boolean {
  const { r, s } = sig;
  if (r <= 0 || r >= N || s <= 0 || s >= N) return false;
  const w = modinv(s, N);
  const u1 = m(z * w), u2 = m(r * w);
  const P = add(mul(u1, CURVE.G, CURVE).point, mul(u2, Q, CURVE).point, CURVE);
  if (P === null) return false;
  return m(P.x) === r;
}

export const publicKey = (d: number): Point => mul(m(d), CURVE.G, CURVE).point as Point;

export interface Recovered { k: number; d: number }

/** Two signatures that reused the same nonce k (so they share r) leak everything:
 *  k = (z1 − z2)/(s1 − s2),  then  d = (s·k − z)/r — all mod N. */
export function recoverFromReuse(z1: number, s1: number, z2: number, s2: number, r: number): Recovered {
  const k = m((z1 - z2) * modinv(m(s1 - s2), N));
  const d = m((s1 * k - z1) * modinv(r, N));
  return { k, d };
}

export const curveOrder = N;
