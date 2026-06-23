import { describe, it, expect } from 'vitest';
import { encryptBlock, expandKey128, aesEcbEncrypt, aesCbcEncrypt } from '../src/web/aes';

const hb = (s: string) => new Uint8Array(s.match(/../g)!.map((h) => parseInt(h, 16)));
const hx = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');

describe('AES-128 block (FIPS-197)', () => {
  it('encrypts the FIPS-197 Appendix C.1 test block', () => {
    const key = hb('000102030405060708090a0b0c0d0e0f');
    const pt = hb('00112233445566778899aabbccddeeff');
    expect(hx(encryptBlock(pt, expandKey128(key)))).toBe('69c4e0d86a7b0430d8cdb78070b4c55a');
  });
});

describe('AES-128 modes (NIST SP 800-38A)', () => {
  const key = hb('2b7e151628aed2a6abf7158809cf4f3c');

  it('ECB matches F.1.1 (each block independent)', () => {
    // first two plaintext blocks of the SP 800-38A example
    const pt = hb('6bc1bee22e409f96e93d7e117393172aae2d8a571e03ac9c9eb76fac45af8e51');
    const ct = aesEcbEncrypt(pt, key);
    expect(hx(ct[0])).toBe('3ad77bb40d7a3660a89ecaf32466ef97');
    expect(hx(ct[1])).toBe('f5d3d58503b9699de785895a96fdbaaf');
  });

  it('CBC matches F.2.1 (blocks chained through the IV)', () => {
    const iv = hb('000102030405060708090a0b0c0d0e0f');
    const pt = hb('6bc1bee22e409f96e93d7e117393172aae2d8a571e03ac9c9eb76fac45af8e51');
    const ct = aesCbcEncrypt(pt, key, iv);
    expect(hx(ct[0])).toBe('7649abac8119b246cee98e9b12e9197d');
    expect(hx(ct[1])).toBe('5086cb9b507219ee95db113a917678b2');
  });
});

describe('ECB leaks structure, CBC does not', () => {
  const key = hb('2b7e151628aed2a6abf7158809cf4f3c');
  const iv = hb('00000000000000000000000000000000');
  // two IDENTICAL 16-byte plaintext blocks
  const repeated = hb('41414141414141414141414141414141' + '41414141414141414141414141414141');

  it('ECB produces identical ciphertext for identical plaintext blocks', () => {
    const ct = aesEcbEncrypt(repeated, key);
    expect(hx(ct[0])).toBe(hx(ct[1])); // the leak: repetition shows through
  });

  it('CBC produces different ciphertext for the same plaintext blocks', () => {
    const ct = aesCbcEncrypt(repeated, key, iv);
    expect(hx(ct[0])).not.toBe(hx(ct[1])); // chaining hides the repetition
  });
});
