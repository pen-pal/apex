// EdDSA (the Ed25519 construction, on Apex's toy curve). A Schnorr-style signature with
// one decisive twist: the per-signature nonce is DERIVED DETERMINISTICALLY from the
// secret key and the message, r = H(secret ‖ message), instead of being randomly drawn.
// That single change kills the catastrophe that breaks ECDSA — reuse the same nonce on
// two different messages and anyone can solve for your private key (see the ECDSA
// section). With EdDSA each message gets its own nonce by construction, so reuse across
// distinct messages can't happen, and there's no RNG to get wrong. Real toy-curve EC math
// (ecc.ts) + real SHA-256 (sha256.ts); tested.
import { CURVE, mul, add, order, type Pt } from './ecc';
import { sha256 } from './sha256';

const N = order(CURVE); // 19 — the generator's order
const G = CURVE.G;

const ptEq = (P: Pt, Q: Pt): boolean => (P === null || Q === null ? P === Q : P.x === Q.x && P.y === Q.y);

/** Hash a label + numbers to a scalar via real SHA-256, reduced into the given range. */
function hashScalar(parts: (number | string)[], lo: number, hi: number): number {
  const bytes = new TextEncoder().encode(parts.join('|'));
  const d = sha256(bytes);
  const v = ((d[0] << 24) | (d[1] << 16) | (d[2] << 8) | d[3]) >>> 0;
  return lo + (v % (hi - lo));
}

export const publicKey = (secret: number): Pt => mul(secret, G, CURVE).point;

/** Deterministic nonce in 1..N-1 from the secret and message — never random. */
export const nonce = (secret: number, msg: number): number => hashScalar(['nonce', secret, msg], 1, N);

const challenge = (R: Pt, A: Pt, msg: number): number =>
  hashScalar(['chal', R ? R.x : -1, R ? R.y : -1, A ? A.x : -1, A ? A.y : -1, msg], 0, N);

export interface Signature { R: Pt; s: number; r: number; e: number }

export function sign(secret: number, msg: number): Signature {
  const A = publicKey(secret);
  const r = nonce(secret, msg);
  const R = mul(r, G, CURVE).point;
  const e = challenge(R, A, msg);
  const s = (r + e * secret) % N;
  return { R, s, r, e };
}

/** Verify s·G == R + e·A. */
export function verify(A: Pt, msg: number, sig: { R: Pt; s: number }): boolean {
  const e = challenge(sig.R, A, msg);
  const lhs = mul(sig.s, G, CURVE).point;
  const rhs = add(sig.R, mul(e, A, CURVE).point, CURVE);
  return ptEq(lhs, rhs);
}
