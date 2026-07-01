import { describe, it, expect } from 'vitest';
import { envelopeEncrypt, envelopeDecrypt, unwrapDEK, rotateKEK, bytes, str } from '../src/web/envelope';

const KEK = 0xa11ce, DEK = 0x5ec12e7;
const MSG = 'customer SSN: 123-45-6789';
const pt = bytes(MSG);

describe('the two-layer hierarchy', () => {
  it('encrypts with the DEK, wraps the DEK with the KEK, and round-trips', () => {
    const env = envelopeEncrypt(pt, KEK, DEK);
    expect(str(envelopeDecrypt(env, KEK))).toBe(MSG);
  });
  it('the DEK is never stored in the clear (only the wrapped form)', () => {
    const env = envelopeEncrypt(pt, KEK, DEK);
    expect(unwrapDEK(env.wrappedDEK, KEK)).toBe(DEK);      // KMS can recover it
    expect(env.wrappedDEK).not.toEqual([(DEK >>> 24) & 0xff, (DEK >>> 16) & 0xff, (DEK >>> 8) & 0xff, DEK & 0xff]);
  });
  it('the wrapped DEK is tiny next to the data', () => {
    const big = envelopeEncrypt(bytes('x'.repeat(5000)), KEK, DEK);
    expect(big.wrappedDEK.length).toBe(4);
    expect(big.ciphertext.length).toBe(5000);
  });
});

describe('the wrong master key fails', () => {
  it('a different KEK unwraps a wrong DEK and does not recover the data', () => {
    const env = envelopeEncrypt(pt, KEK, DEK);
    expect(str(envelopeDecrypt(env, 0xbad))).not.toBe(MSG);
  });
});

describe('key rotation is nearly free — only the DEK is re-wrapped', () => {
  const env = envelopeEncrypt(pt, KEK, DEK);
  const rotated = rotateKEK(env, KEK, 0xf00d);
  it('the ciphertext (the big data) is byte-identical — never re-encrypted', () => {
    expect(rotated.ciphertext).toEqual(env.ciphertext);
  });
  it('only the wrapped DEK changed, and the new KEK decrypts', () => {
    expect(rotated.wrappedDEK).not.toEqual(env.wrappedDEK);
    expect(str(envelopeDecrypt(rotated, 0xf00d))).toBe(MSG);
  });
  it('the old KEK no longer works after rotation', () => {
    expect(str(envelopeDecrypt(rotated, KEK))).not.toBe(MSG);
  });
  it('rotation preserves the underlying DEK', () => {
    expect(unwrapDEK(rotated.wrappedDEK, 0xf00d)).toBe(DEK);
  });
});
