// The Number-Theoretic Transform (NTT) — the FFT done in a finite field, and the engine that makes
// lattice cryptography (Kyber/ML-KEM, Dilithium) fast. Multiplying two degree-(n−1) polynomials the
// schoolbook way is O(n²); the NTT maps each polynomial to the "evaluation domain" where multiplication
// becomes a single POINTWISE product, then maps back — O(n log n) with the fast butterfly. Lattice
// schemes work in the ring Z_q[x]/(x^n+1), so we use the NEGACYCLIC variant: a ψ-weighting (ψ a primitive
// 2n-th root of unity, ψ^n = −1) folds the x^n = −1 wrap into an ordinary length-n NTT with ω = ψ².
// We implement the direct O(n²) definition (legible, exact for the toy n=8, q=17); the identity
// INTT(NTT(a)∘NTT(b)) = a·b mod (x^n+1) is what the tests anchor to. Reference: FIPS 203 (ML-KEM) §4.3.

export const mod = (a: number, q: number) => ((a % q) + q) % q;
export function modpow(b: number, e: number, q: number): number {
  let r = 1; b = mod(b, q);
  while (e > 0) { if (e & 1) r = mod(r * b, q); b = mod(b * b, q); e >>= 1; }
  return r;
}
export const modinv = (a: number, q: number) => modpow(a, q - 2, q); // q prime

/** Forward negacyclic NTT: ψ-weight, then evaluate at powers of ω = ψ². Returns the n transform values. */
export function ntt(a: number[], q: number, psi: number): number[] {
  const n = a.length;
  const omega = mod(psi * psi, q);
  const weighted = a.map((x, j) => mod(x * modpow(psi, j, q), q));
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    let acc = 0;
    for (let j = 0; j < n; j++) acc = mod(acc + weighted[j] * modpow(omega, i * j, q), q);
    out.push(acc);
  }
  return out;
}

/** Inverse negacyclic NTT: interpolate with ω⁻¹, scale by n⁻¹, then strip the ψ-weighting. */
export function intt(ahat: number[], q: number, psi: number): number[] {
  const n = ahat.length;
  const ominv = modinv(mod(psi * psi, q), q);
  const ninv = modinv(n, q);
  const psinv = modinv(psi, q);
  const out: number[] = [];
  for (let j = 0; j < n; j++) {
    let acc = 0;
    for (let i = 0; i < n; i++) acc = mod(acc + ahat[i] * modpow(ominv, i * j, q), q);
    out.push(mod(mod(acc * ninv, q) * modpow(psinv, j, q), q));
  }
  return out;
}

/** Element-wise product in the transform domain — this is the whole point of the NTT. */
export const pointwise = (a: number[], b: number[], q: number) => a.map((x, i) => mod(x * b[i], q));

/** Schoolbook negacyclic convolution: c = a·b mod (x^n+1) — terms that wrap past x^n flip sign. */
export function negamul(a: number[], b: number[], q: number): number[] {
  const n = a.length;
  const c = new Array(n).fill(0);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const k = i + j;
    if (k < n) c[k] = mod(c[k] + a[i] * b[j], q);
    else c[k - n] = mod(c[k - n] - a[i] * b[j], q); // x^n ≡ −1
  }
  return c;
}

/** Multiply via the NTT path: transform both, multiply pointwise, transform back. */
export const nttMul = (a: number[], b: number[], q: number, psi: number) =>
  intt(pointwise(ntt(a, q, psi), ntt(b, q, psi), q), q, psi);

// Default toy parameters: n=8, q=17, ψ=3 (a primitive 16th root of unity mod 17, ψ^8 ≡ −1, ω=ψ²=9).
export const TOY = { n: 8, q: 17, psi: 3 };
