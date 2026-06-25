// Threshold signatures (t-of-n Schnorr, the idea behind FROST) — a signing key that no single party
// ever holds, yet ANY t of n parties can jointly produce ONE ordinary signature, while t−1 cannot.
// The group secret x is Shamir-shared: x = f(0) of a degree-(t−1) polynomial, party i holds s_i = f(i),
// and the group public key is Y = x·G. To sign, a coalition S of t parties each picks a nonce d_i and
// publishes R_i = d_i·G; the aggregate nonce is R = Σ R_i and the challenge c = H(R, Y, m). Each party
// returns a PARTIAL signature z_i = d_i + c·λ_i·s_i, where λ_i is its Lagrange coefficient at 0 for the
// set S. The combiner sums them: z = Σ z_i. The magic is Σ λ_i·s_i = f(0) = x (Lagrange interpolation),
// so z = (Σ d_i) + c·x and therefore z·G = R + c·Y — a valid Schnorr signature, with x NEVER assembled.
// A coalition of only t−1 interpolates to the WRONG value (≠ x), so the signature fails to verify.
// Real EC math on the project's verified toy curve (group order 19); the hash is a teaching stand-in.
import { CURVE, mul, add, modinv, type Pt } from './ecc';

export const N = 19; // the curve's prime group order — scalars live in F_19
const G = CURVE.G;
const smod = (a: number): number => ((a % N) + N) % N;
const ptEq = (P: Pt, Q: Pt): boolean => (P === null || Q === null) ? P === Q : P.x === Q.x && P.y === Q.y;

/** k·P (default P = the generator G), scalar reduced mod the group order. */
export const scalarMul = (k: number, P: Pt = G): Pt => mul(smod(k), P, CURVE).point;

// ---- Shamir sharing over F_19 (the scalar field) -----------------------------------------------

export const evalPoly = (coeffs: number[], x: number): number => {
  let acc = 0, xp = 1;
  for (const c of coeffs) { acc = smod(acc + c * xp); xp = smod(xp * x); }
  return acc;
};

export interface Share { id: number; value: number }
export interface Dealt { shares: Share[]; pub: Pt; coeffs: number[] }

/** Deal a t-of-n sharing of `secret`: f(0)=secret, degree t−1; share i = f(i); group key Y = secret·G. */
export function deal(secret: number, t: number, n: number, randomCoeffs: number[]): Dealt {
  const coeffs = [smod(secret), ...Array.from({ length: t - 1 }, (_, i) => smod(randomCoeffs[i] ?? 1))];
  const shares = Array.from({ length: n }, (_, i) => ({ id: i + 1, value: evalPoly(coeffs, i + 1) }));
  return { shares, pub: scalarMul(secret), coeffs };
}

/** Lagrange basis coefficient at x=0 for member `id` within coalition `S` (in F_19). */
export function lagrange0(S: number[], id: number): number {
  let num = 1, den = 1;
  for (const j of S) if (j !== id) { num = smod(num * smod(-j)); den = smod(den * smod(id - j)); }
  return smod(num * modinv(den, N));
}

/** Reconstruct the secret from a set of shares via Lagrange at 0 (the sanity check that Σλ·s = x). */
export const reconstruct = (shares: Share[]): number => {
  const ids = shares.map((s) => s.id);
  return smod(shares.reduce((acc, s) => smod(acc + smod(lagrange0(ids, s.id) * s.value)), 0));
};

// ---- threshold Schnorr signing -----------------------------------------------------------------

/** A deterministic teaching challenge c = H(R, Y, m) ∈ [1, N−1]. */
export function challenge(R: Pt, Y: Pt, msg: string): number {
  let h = 0x811c9dc5 >>> 0;
  const s = `${R ? R.x + ',' + R.y : 'O'}|${Y ? Y.x + ',' + Y.y : 'O'}|${msg}`;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return 1 + (h % (N - 1)); // never 0, so the c·Y term never degenerates
}

export interface Signature { R: Pt; z: number; c: number }

/** A coalition (its shares) each contributes a nonce; produce the combined (R, z) signature. */
export function sign(coalition: Share[], nonces: number[], pub: Pt, msg: string): Signature {
  const ids = coalition.map((s) => s.id);
  const R = coalition.reduce<Pt>((acc, _, i) => add(acc, scalarMul(nonces[i]), CURVE), null);
  const c = challenge(R, pub, msg);
  const z = smod(coalition.reduce((acc, s, i) => smod(acc + smod(nonces[i] + smod(c * smod(lagrange0(ids, s.id) * s.value)))), 0));
  return { R, z, c };
}

/** Verify a Schnorr signature against the group public key: z·G == R + c·Y. */
export function verify(sig: Signature, pub: Pt, msg: string): boolean {
  if (challenge(sig.R, pub, msg) !== sig.c) return false;
  const lhs = scalarMul(sig.z); //            z·G
  const rhs = add(sig.R, scalarMul(sig.c, pub), CURVE); // R + c·Y
  return ptEq(lhs, rhs);
}
