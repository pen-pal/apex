// Classical ciphers and why they fall — the pre-history that motivates modern crypto.
// Caesar shifts every letter by a fixed amount; Vigenère shifts by a repeating key.
// Both are monoalphabetic-ish substitutions that LEAK the language's letter frequencies,
// so a frequency attack recovers the key without trying every possibility. We compute
// real shifts and a χ² fit against English letter frequencies. Verified to the
// canonical Vigenère vector (ATTACKATDAWN / LEMON → LXFOPVEFRNHR).

const A = 'A'.charCodeAt(0);
const isUpper = (c: number) => c >= 65 && c <= 90;
const isLower = (c: number) => c >= 97 && c <= 122;

/** English letter frequencies (%) — the fingerprint these ciphers can't hide. */
export const ENGLISH_FREQ: Record<string, number> = {
  E: 12.7, T: 9.1, A: 8.2, O: 7.5, I: 7.0, N: 6.7, S: 6.3, H: 6.1, R: 6.0, D: 4.3, L: 4.0,
  C: 2.8, U: 2.8, M: 2.4, W: 2.4, F: 2.2, G: 2.0, Y: 2.0, P: 1.9, B: 1.5, V: 1.0, K: 0.8,
  J: 0.15, X: 0.15, Q: 0.10, Z: 0.07,
};

/** Caesar shift: rotate each letter by `shift` (mod 26); non-letters pass through. */
export function caesar(text: string, shift: number): string {
  const s = ((shift % 26) + 26) % 26;
  let out = '';
  for (const ch of text) {
    const c = ch.charCodeAt(0);
    if (isUpper(c)) out += String.fromCharCode(((c - 65 + s) % 26) + 65);
    else if (isLower(c)) out += String.fromCharCode(((c - 97 + s) % 26) + 97);
    else out += ch;
  }
  return out;
}

/** Vigenère: shift letter i by key[i mod keylen]. decrypt reverses the shift. */
export function vigenere(text: string, key: string, decrypt = false): string {
  const k = key.toUpperCase().replace(/[^A-Z]/g, '');
  if (!k) return text;
  let out = '', ki = 0;
  for (const ch of text) {
    const c = ch.charCodeAt(0);
    const letter = isUpper(c) || isLower(c);
    if (!letter) { out += ch; continue; }
    const base = isUpper(c) ? 65 : 97;
    let sh = k.charCodeAt(ki % k.length) - A;
    if (decrypt) sh = -sh;
    out += String.fromCharCode((((c - base + sh) % 26) + 26) % 26 + base);
    ki++;
  }
  return out;
}

export function letterCounts(text: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (let i = 0; i < 26; i++) counts[String.fromCharCode(65 + i)] = 0;
  for (const ch of text.toUpperCase()) if (counts[ch] !== undefined) counts[ch]++;
  return counts;
}

export function letterFreq(text: string): Record<string, number> {
  const counts = letterCounts(text);
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  const freq: Record<string, number> = {};
  for (const k in counts) freq[k] = (counts[k] / total) * 100;
  return freq;
}

/** Break a Caesar cipher by frequency: pick the shift whose decrypt best fits English. */
export function crackCaesar(cipher: string): { shift: number; plaintext: string; chi: number[] } {
  const chi: number[] = [];
  for (let s = 0; s < 26; s++) {
    const freq = letterFreq(caesar(cipher, -s));
    let x = 0;
    for (let i = 0; i < 26; i++) {
      const L = String.fromCharCode(65 + i);
      const e = ENGLISH_FREQ[L] ?? 0.05;
      x += ((freq[L] - e) ** 2) / e;
    }
    chi.push(x);
  }
  const shift = chi.indexOf(Math.min(...chi));
  return { shift, plaintext: caesar(cipher, -shift), chi };
}
