// The padding-oracle attack — how a server that merely tells you "your padding is valid / invalid" leaks the
// entire plaintext of a CBC-encrypted message, without the key. CBC decryption computes
// P_i = Decrypt(C_i) XOR C_{i-1}. The block Decrypt(C_i) — call it the "intermediate" I_i — depends only on the
// key and C_i, NOT on C_{i-1}. So if the attacker sends a forged previous block C', the server decrypts to
// I_i XOR C', and (crucially) checks the PKCS#7 padding of the result before doing anything else. By tampering
// with C' one byte at a time and watching whether the padding check passes, the attacker learns I_i byte by
// byte: force the last byte to be 0x01 (valid padding of length 1), and you've learned I_i's last byte =
// C'_last XOR 0x01. Then force the last two bytes to 0x02 0x02, and so on up the block. Once I_i is known,
// XOR with the REAL C_{i-1} gives the true plaintext P_i. About 128 oracle queries per byte on average —
// cheap. This broke countless TLS/CBC deployments and ASP.NET (2010). The fixes are encrypt-then-MAC / AEAD
// (verify a MAC before ever looking at padding) and constant-time, oracle-free error handling.
// Reference: Vaudenay, "Security Flaws Induced by CBC Padding" (2002).

export const B = 8; // block size in bytes

const xorBytes = (a: number[], b: number[]) => a.map((x, i) => x ^ b[i]);

/** PKCS#7 padding check — the single bit of information the oracle leaks. */
export function validPKCS7(block: number[]): boolean {
  const k = block[B - 1];
  if (k < 1 || k > B) return false;
  for (let i = B - k; i < B; i++) if (block[i] !== k) return false;
  return true;
}

// The oracle: decrypt (I XOR prev) and report only whether its padding is valid. `I` is the intermediate the
// attacker is trying to learn — the oracle NEVER reveals it directly.
export type Oracle = (prev: number[]) => boolean;
export const makeOracle = (intermediate: number[]): Oracle => (prev) => validPKCS7(xorBytes(intermediate, prev));

/** Recover the intermediate block I byte-by-byte using only the boolean oracle. Returns I and the query count. */
export function recoverIntermediate(oracle: Oracle): { intermediate: number[]; queries: number } {
  const I = new Array(B).fill(0);
  let queries = 0;
  for (let pad = 1; pad <= B; pad++) {
    const pos = B - pad;
    const prev = new Array(B).fill(0);
    for (let j = pos + 1; j < B; j++) prev[j] = I[j] ^ pad; // make the known tail decrypt to `pad`
    let found = -1;
    for (let g = 0; g <= 255; g++) {
      prev[pos] = g;
      queries++;
      if (!oracle(prev)) continue;
      // guard against a false positive (a longer valid padding): perturb the byte left of pos and re-check.
      if (pos > 0) {
        const saved = prev[pos - 1];
        prev[pos - 1] = (saved + 1) & 0xff;
        queries++;
        const still = oracle(prev);
        prev[pos - 1] = saved;
        if (!still) continue; // it was really a longer padding, keep searching
      }
      found = g;
      break;
    }
    if (found < 0) throw new Error(`no byte found for pad ${pad}`);
    I[pos] = found ^ pad; // P'[pos] = I[pos] XOR prev[pos] == pad  ⇒  I[pos] = prev[pos] XOR pad
  }
  return { intermediate: I, queries };
}

export interface Attack { recovered: number[]; queries: number; matches: boolean }

/** Full demo: given a plaintext block (valid PKCS#7) and the real previous block/IV, recover the plaintext
 *  purely through the padding oracle — proving it matches without the attacker ever knowing the key or I. */
export function attackBlock(plaintext: number[], prevBlock: number[]): Attack {
  const intermediate = xorBytes(plaintext, prevBlock);       // the "true" Decrypt(C_i) = P XOR C_{i-1}
  const oracle = makeOracle(intermediate);                    // server leaks only padding validity
  const { intermediate: recoveredI, queries } = recoverIntermediate(oracle);
  const recovered = xorBytes(recoveredI, prevBlock);          // plaintext = I XOR real previous block
  return { recovered, queries, matches: recovered.every((b, i) => b === plaintext[i]) };
}

export interface Step { pos: number; plaintextByte: number; padTarget: number; queries: number }

/** Same attack, but records each byte as it falls — recovery order is last byte (pad 1) → first byte (pad B). */
export function attackTraced(plaintext: number[], prevBlock: number[]): { steps: Step[]; recovered: number[]; totalQueries: number; matches: boolean } {
  const intermediate = xorBytes(plaintext, prevBlock);
  const oracle = makeOracle(intermediate);
  const I = new Array(B).fill(0);
  const steps: Step[] = [];
  let total = 0;
  for (let pad = 1; pad <= B; pad++) {
    const pos = B - pad;
    const prev = new Array(B).fill(0);
    for (let j = pos + 1; j < B; j++) prev[j] = I[j] ^ pad;
    let found = -1, q = 0;
    for (let g = 0; g <= 255; g++) {
      prev[pos] = g; q++;
      if (!oracle(prev)) continue;
      if (pos > 0) { const s = prev[pos - 1]; prev[pos - 1] = (s + 1) & 0xff; q++; const ok = oracle(prev); prev[pos - 1] = s; if (!ok) continue; }
      found = g; break;
    }
    I[pos] = found ^ pad; total += q;
    steps.push({ pos, plaintextByte: I[pos] ^ prevBlock[pos], padTarget: pad, queries: q });
  }
  const recovered = xorBytes(I, prevBlock);
  return { steps, recovered, totalQueries: total, matches: recovered.every((b, i) => b === plaintext[i]) };
}

/** Turn a short string into one PKCS#7-padded block. */
export function padBlock(s: string): number[] {
  const bytes = [...s].flatMap((c) => [...new TextEncoder().encode(c)]).slice(0, B);
  const k = B - bytes.length;
  return k === 0 ? bytes : bytes.concat(new Array(k).fill(k));
}
