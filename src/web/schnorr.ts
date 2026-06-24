// Schnorr's zero-knowledge proof of knowledge — prove you know a secret x (the
// discrete log of a public Y = xG) WITHOUT revealing x. Three moves: the prover
// commits T = rG to a random r; the verifier sends a random challenge c; the prover
// answers s = r + c·x. The check g^s = T·Y^c holds iff the prover knew x, yet the
// transcript (T, c, s) could be simulated for any verifier, so it leaks nothing. This
// is the heart of Schnorr/EdDSA signatures (Fiat–Shamir sets c = H(...) to drop the
// interaction). Built on the ecc.ts toy curve (order 19). Tested.
import { CURVE, mul, add, order, type Pt } from './ecc';

export const N = order(CURVE); // scalar field = subgroup order
const m = (n: number) => ((n % N) + N) % N;
const G = CURVE.G;
const ptEq = (a: Pt, b: Pt) => (a === null ? b === null : b !== null && a.x === b.x && a.y === b.y);

export const publicKey = (x: number): Pt => mul(m(x), G, CURVE).point; // Y = xG
export const commit = (r: number): Pt => mul(m(r), G, CURVE).point; // T = rG
export const respond = (r: number, c: number, x: number): number => m(r + c * x); // s = r + c·x mod N

/** Verify: sG == T + cY. */
export function verify(Y: Pt, T: Pt, c: number, s: number): boolean {
  const lhs = mul(m(s), G, CURVE).point;
  const rhs = add(T, mul(m(c), Y, CURVE).point, CURVE);
  return ptEq(lhs, rhs);
}

/** A cheating prover who picks the response s and challenge c FIRST can back out a
 *  matching commitment T = sG − cY — which is exactly why the verifier must choose c
 *  AFTER seeing T (and why simulatability ⇒ zero-knowledge). */
export function forgeCommit(Y: Pt, c: number, s: number): Pt {
  const sG = mul(m(s), G, CURVE).point;
  const cY = mul(m(c), Y, CURVE).point;
  // T = sG − cY = sG + (−cY): negate cY's y-coordinate
  const negcY: Pt = cY === null ? null : { x: cY.x, y: (CURVE.p - cY.y) % CURVE.p };
  return add(sG, negcY, CURVE);
}
