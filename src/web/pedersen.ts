// Pedersen commitments — commit to a secret value now, reveal it later, with two
// guarantees: HIDING (the commitment leaks nothing about the value, because a random
// blinding factor scrambles it) and BINDING (you can't later open it to a different value,
// because that would require solving a discrete log). A commitment is C = v·G + r·H, where
// G and H are two generators whose relative discrete log nobody knows. The magic property
// is that commitments are ADDITIVELY HOMOMORPHIC — C(v₁) + C(v₂) = C(v₁+v₂) — which is what
// lets confidential transactions prove "inputs = outputs" without revealing any amount, and
// underpins Bulletproofs and many zero-knowledge systems. Real toy-curve EC math (ecc.ts);
// the structure is exact, the security is only illustrative at this size.
import { CURVE, mul, add, order, type Pt } from './ecc';

const N = order(CURVE); // 19
const G = CURVE.G;
// a second generator (in a real system H's discrete log w.r.t. G must be unknown)
const H: Pt = mul(7, G, CURVE).point;

const mod = (x: number) => ((x % N) + N) % N;
const ptEq = (P: Pt, Q: Pt): boolean => (P === null || Q === null ? P === Q : P.x === Q.x && P.y === Q.y);

/** C = v·G + r·H. */
export function commit(v: number, r: number): Pt {
  return add(mul(mod(v), G, CURVE).point, mul(mod(r), H, CURVE).point, CURVE);
}

/** Open a commitment: does (v, r) produce C? */
export const open = (C: Pt, v: number, r: number): boolean => ptEq(C, commit(v, r));

/** Homomorphic add: combining two commitments commits to the sum of the values & blindings. */
export const addCommit = (C1: Pt, C2: Pt): Pt => add(C1, C2, CURVE);

export const generators = () => ({ G, H, N });
export const ptStr = (P: Pt): string => (P ? `(${P.x}, ${P.y})` : 'O');
