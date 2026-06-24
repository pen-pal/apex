import { describe, it, expect } from 'vitest';
import { aesEcbEncrypt, aesCbcEncrypt } from '../src/web/aes';

const hb = (h: string) => new Uint8Array(h.match(/../g)!.map((x) => parseInt(x, 16)));
const hx = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

// The reason ECB is unsafe and CBC is not — a structural property, not impl output.
// Two identical plaintext blocks encrypt to identical ciphertext under ECB (so any
// repeating pattern in the data survives encryption — the "ECB penguin"), while CBC's
// chaining makes the second block depend on the first, so they differ.
describe('block-cipher mode leakage', () => {
  const key = hb('2b7e151628aed2a6abf7158809cf4f3c');
  const iv = hb('000102030405060708090a0b0c0d0e0f');
  // two identical 16-byte blocks
  const twin = hb('00112233445566778899aabbccddeeff'.repeat(2));

  it('ECB maps identical plaintext blocks to identical ciphertext blocks (the leak)', () => {
    const ct = aesEcbEncrypt(twin, key);
    expect(ct).toHaveLength(2);
    expect(hx(ct[0])).toBe(hx(ct[1])); // <-- the pattern survives
  });

  it('CBC chaining makes the same two blocks encrypt differently', () => {
    const ct = aesCbcEncrypt(twin, key, iv);
    expect(ct).toHaveLength(2);
    expect(hx(ct[0])).not.toBe(hx(ct[1])); // <-- pattern is destroyed
  });

  it('still matches the NIST SP 800-38A ECB vector for the first block', () => {
    // anchor to the published value so the leak demo rests on a real cipher
    const ct = aesEcbEncrypt(hb('6bc1bee22e409f96e93d7e117393172a'), key);
    expect(hx(ct[0])).toBe('3ad77bb40d7a3660a89ecaf32466ef97');
  });
});
