// Password hashing beyond PBKDF2 — why memory-hardness matters. A salt defeats
// rainbow tables and a high iteration count makes each guess slow (that's the
// PBKDF2 tool in the crypto playground), but PBKDF2 and bcrypt use almost no memory,
// so an attacker packs thousands of cheap GPU/ASIC cores and cracks in parallel.
// scrypt and Argon2 force each guess to touch a large block of RAM, so parallel
// cracking needs proportional memory — collapsing the GPU advantage. We model the
// attacker's throughput, assuming the defender tuned every KDF to the SAME cost on
// their own server. The gpuAdvantage figures are illustrative orders of magnitude;
// the ordering is the real lesson.

export interface Kdf {
  id: string; name: string; year: number;
  memoryKiB: number; // working memory per guess
  gpuAdvantage: number; // ~how many× faster a GPU/ASIC cracks it vs one CPU core (illustrative)
  defends: string[]; // properties it adds
}

export const KDFS: Kdf[] = [
  { id: 'pbkdf2', name: 'PBKDF2', year: 2000, memoryKiB: 0.001, gpuAdvantage: 1000, defends: ['salt', 'iterations'] },
  { id: 'bcrypt', name: 'bcrypt', year: 1999, memoryKiB: 4, gpuAdvantage: 30, defends: ['salt', 'cost factor', 'small fixed memory'] },
  { id: 'scrypt', name: 'scrypt', year: 2009, memoryKiB: 16384, gpuAdvantage: 3, defends: ['salt', 'cost', 'memory-hard (N·r)'] },
  { id: 'argon2', name: 'Argon2id', year: 2015, memoryKiB: 65536, gpuAdvantage: 1.5, defends: ['salt', 'cost', 'memory-hard', 'parallelism', 'side-channel resistance'] },
];

export const byId = (id: string): Kdf => KDFS.find((k) => k.id === id)!;

// The defender tunes each KDF to take this long on their own server, so on a single
// CPU core every KDF gives the attacker the same rate — the GPU is what differs.
export const DEFENDER_HASH_SECONDS = 0.25;

/** Attacker guesses/sec given a core budget and whether they use GPUs/ASICs. */
export function attackerGuessesPerSec(kdf: Kdf, cores: number, gpu: boolean): number {
  const perCore = 1 / DEFENDER_HASH_SECONDS;
  return cores * perCore * (gpu ? kdf.gpuAdvantage : 1);
}

/** Expected seconds to crack a password with `entropyBits` of entropy (half the space). */
export function crackSeconds(kdf: Kdf, entropyBits: number, cores: number, gpu: boolean): number {
  const guesses = Math.pow(2, entropyBits - 1);
  return guesses / attackerGuessesPerSec(kdf, cores, gpu);
}

/** Human-friendly duration. */
export function humanTime(sec: number): string {
  if (!isFinite(sec)) return '∞';
  if (sec >= 31557600 * 1e6) return `${(sec / 31557600).toExponential(1)} yr`;
  const u: [number, string][] = [[31557600, 'yr'], [86400, 'd'], [3600, 'h'], [60, 'm'], [1, 's']];
  for (const [s, label] of u) if (sec >= s) return `${(sec / s).toFixed(sec / s >= 10 ? 0 : 1)} ${label}`;
  if (sec >= 1e-3) return `${(sec * 1000).toFixed(0)} ms`;
  return `${sec.toExponential(1)} s`;
}
