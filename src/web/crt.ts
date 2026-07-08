// Chinese Remainder Theorem — the math, with the coprimality precondition made testable. When the moduli are pairwise
// coprime the map number → (remainders) is a bijection over [0, M): every fingerprint has exactly one preimage, and CRT
// reconstructs it as x = Σ rᵢ·eᵢ mod M with the basis eᵢ ≡ 1 (mod mᵢ), ≡ 0 elsewhere. Drop coprimality and the whole
// theorem collapses: only lcm(moduli) fingerprints are reachable, so the map is many-to-one — some fingerprints have
// several preimages (a collision), others none (a gap). preimages() brute-forces that directly so the failure is shown,
// not asserted.

export const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
export const lcm = (a: number, b: number): number => (a / gcd(a, b)) * b;
export const product = (mods: number[]): number => mods.reduce((a, b) => a * b, 1);
export const reachable = (mods: number[]): number => mods.reduce((a, b) => lcm(a, b), 1);
export const pairwiseCoprime = (mods: number[]): boolean =>
  mods.every((m, i) => mods.every((n, j) => i >= j || gcd(m, n) === 1));

const modinv = (a: number, m: number): number => {
  a = ((a % m) + m) % m;
  for (let x = 1; x < m; x++) if ((a * x) % m === 1) return x;
  return 1; // no inverse (only happens for non-coprime moduli, where reconstruct is not valid anyway)
};

// The CRT basis eᵢ = Mᵢ·(Mᵢ⁻¹ mod mᵢ), valid only for coprime moduli.
export function basis(mods: number[]): number[] {
  const M = product(mods);
  return mods.map((mi) => { const Mi = M / mi; return Mi * modinv(Mi, mi); });
}
export const reconstruct = (rs: number[], mods: number[]): number => {
  const E = basis(mods), M = product(mods);
  return ((rs.reduce((s, r, i) => s + r * E[i], 0) % M) + M) % M;
};

// Every x in [0, product) whose remainders match the fingerprint. Length 1 for all fingerprints iff the moduli are
// coprime; otherwise some fingerprints collide (length > 1) and some are impossible (length 0).
export function preimages(rs: number[], mods: number[]): number[] {
  const M = product(mods), out: number[] = [];
  for (let x = 0; x < M; x++) if (mods.every((mi, i) => x % mi === rs[i])) out.push(x);
  return out;
}
