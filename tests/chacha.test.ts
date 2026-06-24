import { describe, it, expect } from 'vitest';
import { quarterRound, chacha20Block, chacha20, hexWord } from '../src/web/chacha';

const hex = (s: string) => Uint8Array.from(s.replace(/\s/g, '').match(/../g)!.map((b) => parseInt(b, 16)));
const toHex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');

describe('ChaCha20 quarter-round — RFC 8439 §2.1.1', () => {
  it('matches the published vector', () => {
    const [a, b, c, d] = quarterRound(0x11111111, 0x01020304, 0x9b8d6f43, 0x01234567);
    expect([a, b, c, d].map(hexWord)).toEqual(['ea2a92f4', 'cb1cf8ce', '4581472e', '5881c4bb']);
  });
});

describe('ChaCha20 block function — RFC 8439 §2.3.2', () => {
  const key = hex('000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f');
  const nonce = hex('000000090000004a00000000');
  const blk = chacha20Block(key, 1, nonce);

  it('produces the published 64-byte keystream block', () => {
    expect(toHex(blk.keystream)).toBe(
      '10f1e7e4d13b5915500fdd1fa32071c4' +
      'c7d1f4c733c068030422aa9ac3d46c4e' +
      'd2826446079faa0914c2d705d98b02a2' +
      'b5129cd1de164eb9cbd083e8a2503c4e',
    );
  });

  it('records 10 double-round snapshots', () => {
    expect(blk.rounds.length).toBe(10);
    expect(blk.state[0]).toBe(0x61707865); // the "expa" constant word
  });
});

describe('ChaCha20 encryption — RFC 8439 §2.4.2', () => {
  it('encrypts the sunscreen plaintext to the published ciphertext (first block)', () => {
    const key = hex('000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f');
    const nonce = hex('000000000000004a00000000');
    const pt = new TextEncoder().encode("Ladies and Gentlemen of the class of '99: If I could offer you only one tip for the future, sunscreen would be it.");
    const ct = chacha20(pt, key, 1, nonce);
    expect(toHex(ct.subarray(0, 64))).toBe(
      '6e2e359a2568f98041ba0728dd0d6981' +
      'e97e7aec1d4360c20a27afccfd9fae0b' +
      'f91b65c5524733ab8f593dabcd62b357' +
      '1639d624e65152ab8f530c359f0861d8',
    );
  });

  it('is its own inverse (XOR keystream back)', () => {
    const key = hex('000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f');
    const nonce = hex('000000000000004a00000000');
    const pt = new TextEncoder().encode('chacha round-trips fine');
    const ct = chacha20(pt, key, 1, nonce);
    expect(toHex(chacha20(ct, key, 1, nonce))).toBe(toHex(pt));
  });
});
