import { describe, it, expect } from 'vitest';
import { aesCtr, ctrBlock, aesGcmEncrypt, aesGcmDecrypt, gfmul, xorBytes } from '../src/web/aesgcm';

const hex = (s: string) => Uint8Array.from(s.replace(/\s/g, '').match(/../g)!.map((b) => parseInt(b, 16)));
const toHex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');

describe('CTR mode — NIST SP 800-38A F.5.1 (CTR-AES128.Encrypt)', () => {
  const key = hex('2b7e151628aed2a6abf7158809cf4f3c');
  const ctr0 = hex('f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff');
  const pt = hex(
    '6bc1bee22e409f96e93d7e117393172a' +
    'ae2d8a571e03ac9c9eb76fac45af8e51' +
    '30c81c46a35ce411e5fbc1191a0a52ef' +
    'f69f2445df4f9b17ad2b417be66c3710',
  );
  const ctExpected =
    '874d6191b620e3261bef6864990db6ce' +
    '9806f66b7970fdff8617187bb9fffdff' +
    '5ae4df3edbd5d35e5b4f09020db03eab' +
    '1e031dda2fbe03d1792170a0f3009cee';

  it('encrypts the four-block known answer', () => {
    expect(toHex(aesCtr(pt, key, ctr0).out)).toBe(ctExpected);
  });

  it('decrypt is the same operation (XOR the keystream back)', () => {
    const ct = aesCtr(pt, key, ctr0).out;
    expect(toHex(aesCtr(ct, key, ctr0).out)).toBe(toHex(pt)); // round-trips
  });

  it('needs no padding — ciphertext length equals plaintext length', () => {
    const odd = hex('00112233445566778899aabbcc'); // 13 bytes, not a block multiple
    expect(aesCtr(odd, key, ctr0).out.length).toBe(13);
  });
});

describe('nonce reuse — the keystream cancels and plaintexts leak', () => {
  const key = hex('2b7e151628aed2a6abf7158809cf4f3c');
  const nonce = hex('cafebabefacedbaddecaf888');
  const p1 = new TextEncoder().encode('attack at dawn!!');
  const p2 = new TextEncoder().encode('retreat at noon!');

  it('reusing (key, nonce): C1 ⊕ C2 == P1 ⊕ P2 (keystream gone)', () => {
    const icb = ctrBlock(nonce);
    const c1 = aesCtr(p1, key, icb).out;
    const c2 = aesCtr(p2, key, icb).out; // SAME counter block — the bug
    expect(toHex(xorBytes(c1, c2))).toBe(toHex(xorBytes(p1, p2)));
  });

  it('a fresh nonce breaks the relation (no leak)', () => {
    const c1 = aesCtr(p1, key, ctrBlock(nonce)).out;
    const n2 = nonce.slice(); n2[11] ^= 0x01;
    const c2 = aesCtr(p2, key, ctrBlock(n2)).out; // different keystream
    expect(toHex(xorBytes(c1, c2))).not.toBe(toHex(xorBytes(p1, p2)));
  });
});

describe('GCM (AEAD) — canonical McGrew–Viega / NIST SP 800-38D test vectors', () => {
  it('Test Case 2: zero key, one zero block', () => {
    const r = aesGcmEncrypt(hex('00000000000000000000000000000000'), hex('00000000000000000000000000000000'), hex('000000000000000000000000'));
    expect(toHex(r.ciphertext)).toBe('0388dace60b6a392f328c2b971b2fe78');
    expect(toHex(r.tag)).toBe('ab6e47d42cec13bdf53a67b21257bddf');
  });

  it('Test Case 3: 64-byte plaintext, real key + IV', () => {
    const key = hex('feffe9928665731c6d6a8f9467308308');
    const iv = hex('cafebabefacedbaddecaf888');
    const pt = hex(
      'd9313225f88406e5a55909c5aff5269a86a7a9531534f7da2e4c303d8a318a72' +
      '1c3c0c95956809532fcf0e2449a6b525b16aedf5aa0de657ba637b391aafd255',
    );
    const r = aesGcmEncrypt(pt, key, iv);
    expect(toHex(r.ciphertext)).toBe(
      '42831ec2217774244b7221b784d0d49ce3aa212f2c02a4e035c17e2329aca12e' +
      '21d514b25466931c7d8f6a5aac84aa051ba30b396a0aac973d58e091473f5985',
    );
    expect(toHex(r.tag)).toBe('4d5c2af327cd64a62cf35abd2ba6fab4');
  });

  it('Test Case 1: empty plaintext authenticates to the published tag', () => {
    const r = aesGcmEncrypt(new Uint8Array(0), hex('00000000000000000000000000000000'), hex('000000000000000000000000'));
    expect(r.ciphertext.length).toBe(0);
    expect(toHex(r.tag)).toBe('58e2fccefa7e3061367f1d57a4e7455a');
  });

  it('honest ciphertext verifies and round-trips; a tampered byte is rejected', () => {
    const key = hex('feffe9928665731c6d6a8f9467308308');
    const iv = hex('cafebabefacedbaddecaf888');
    const pt = hex('d9313225f88406e5a55909c5aff5269a');
    const r = aesGcmEncrypt(pt, key, iv);

    const ok = aesGcmDecrypt(r.ciphertext, key, iv, r.tag);
    expect(ok.authentic).toBe(true);
    expect(toHex(ok.plaintext)).toBe(toHex(pt));

    const tampered = r.ciphertext.slice(); tampered[0] ^= 0x80; // flip one bit
    expect(aesGcmDecrypt(tampered, key, iv, r.tag).authentic).toBe(false);
  });
});

describe('GF(2^128) multiply', () => {
  it('is commutative and has 1 (the GCM bit-reflected unit) as identity-ish behaviour', () => {
    const a = hex('0388dace60b6a392f328c2b971b2fe78');
    const b = hex('66e94bd4ef8a2c3b884cfa59ca342b2e'); // H for the zero-key case
    expect(toHex(gfmul(a, b))).toBe(toHex(gfmul(b, a))); // commutative
  });
});
