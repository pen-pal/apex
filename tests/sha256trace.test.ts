import { describe, it, expect } from 'vitest';
import { sha256, sha256Trace, SHA256_IV, hex } from '../src/web/sha256';

const enc = (s: string) => new TextEncoder().encode(s);

describe('sha256Trace — the Merkle–Damgård chain exposed', () => {
  it('still computes the NIST "abc" digest', () => {
    expect(hex(sha256Trace(enc('abc')).digest)).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('"abc" pads to one 64-byte block with 64 compression rounds', () => {
    const t = sha256Trace(enc('abc'));
    expect(t.padded.length).toBe(64);
    expect(t.blocks.length).toBe(1);
    expect(t.blocks[0].rounds.length).toBe(64);
  });

  it('the chain starts from the SHA-256 IV', () => {
    const t = sha256Trace(enc('abc'));
    expect([...t.blocks[0].before]).toEqual([...SHA256_IV]);
    expect(t.blocks[0].before[0]).toBe(0x6a09e667);
  });

  it('each block feeds the next: block[i].after === block[i+1].before', () => {
    const t = sha256Trace(enc('x'.repeat(200))); // 200 bytes → multiple blocks
    expect(t.blocks.length).toBeGreaterThan(1);
    for (let i = 0; i + 1 < t.blocks.length; i++)
      expect([...t.blocks[i].after]).toEqual([...t.blocks[i + 1].before]);
  });

  it('the trace digest matches plain sha256 for many lengths', () => {
    for (const m of ['', 'a', 'abc', 'x'.repeat(55), 'x'.repeat(56), 'x'.repeat(64), 'hello world '.repeat(20)])
      expect(hex(sha256Trace(enc(m)).digest)).toBe(hex(sha256(enc(m))));
  });

  it('padding carries 0x80 then the 64-bit bit-length at the end', () => {
    const t = sha256Trace(enc('abc'));
    expect(t.padded[3]).toBe(0x80); // right after the 3 message bytes
    expect(t.padded[t.padded.length - 1]).toBe(24); // 3 bytes = 24 bits
  });
});
