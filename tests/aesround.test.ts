import { describe, it, expect } from 'vitest';
import { aesTrace, aesDiffusion, AES_SBOX } from '../src/web/aes';

const hex = (s: string) => Uint8Array.from(s.match(/../g)!.map((b) => parseInt(b, 16)));
const toHex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');

// FIPS-197 Appendix B "Cipher Example" — the canonical AES-128 known-answer vector.
const PT = hex('3243f6a8885a308d313198a2e0370734');
const KEY = hex('2b7e151628aed2a6abf7158809cf4f3c');
const CT = '3925841d02dc09fbdc118597196a0b32';

describe('aesTrace — the FIPS-197 cipher example, step by step', () => {
  const steps = aesTrace(PT, KEY);

  it('produces a full 41-step trace (input + whitening + 9×4 + final 3)', () => {
    expect(steps.length).toBe(41);
    expect(steps[0].op).toBe('input');
    expect(steps[40].op).toBe('AddRoundKey');
    expect(steps[40].round).toBe(10);
  });

  it('start of round 1 (after initial AddRoundKey) matches FIPS-197', () => {
    expect(toHex(steps[1].state)).toBe('193de3bea0f4e22b9ac68d2ae9f84808');
  });

  it('round 1 SubBytes, ShiftRows and MixColumns match FIPS-197', () => {
    expect(toHex(steps[2].state)).toBe('d42711aee0bf98f1b8b45de51e415230'); // SubBytes
    expect(toHex(steps[3].state)).toBe('d4bf5d30e0b452aeb84111f11e2798e5'); // ShiftRows
    expect(toHex(steps[4].state)).toBe('046681e5e0cb199a48f8d37a2806264c'); // MixColumns
  });

  it('the final state equals the published ciphertext', () => {
    expect(toHex(steps[40].state)).toBe(CT);
  });

  it('the last round skips MixColumns', () => {
    expect(steps.filter((s) => s.round === 10).map((s) => s.op)).toEqual(['SubBytes', 'ShiftRows', 'AddRoundKey']);
  });

  it('every AddRoundKey step carries the round key it mixed in', () => {
    expect(steps[1].roundKey && toHex(steps[1].roundKey)).toBe(toHex(KEY)); // round key 0 IS the cipher key
    expect(steps.filter((s) => s.op === 'AddRoundKey').every((s) => s.roundKey?.length === 16)).toBe(true);
  });
});

describe('diffusion — one flipped input bit reaches the whole block in two rounds', () => {
  it('1 byte → a full column (4) after round 1 MixColumns → all 16 after round 2', () => {
    const flipped = PT.slice();
    flipped[0] ^= 0x01; // a single bit
    const d = aesDiffusion(aesTrace(PT, KEY), aesTrace(flipped, KEY));
    expect(d[0]).toBe(1); // input: exactly one byte differs
    expect(d[4]).toBe(4); // round 1 MixColumns spreads it across one column
    expect(d[8]).toBe(16); // round 2 MixColumns: full diffusion (the AES wide-trail property)
    expect(d[40]).toBe(16); // the ciphertext is fully affected
  });
});

describe('AES_SBOX', () => {
  it('is the FIPS-197 S-box: a bijection with S(00)=63, S(53)=ed', () => {
    expect(AES_SBOX.length).toBe(256);
    expect(AES_SBOX[0x00]).toBe(0x63);
    expect(AES_SBOX[0x53]).toBe(0xed);
    expect(new Set(AES_SBOX).size).toBe(256); // a permutation of all byte values
  });
});
