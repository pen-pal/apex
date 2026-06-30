import { describe, it, expect } from 'vitest';
import { prove, verify, hashToGroup, proofToOutput } from '../src/web/vrf';
import { N, E } from '../src/web/blindsig';

describe('VRF — verifiable random function (RSA-FDH style)', () => {
  it('a freshly produced proof verifies', () => {
    const v = prove('alice|epoch-42');
    expect(verify(v.input, v.output, v.proof)).toBe(true);
  });

  it('is deterministic — the same input always yields the same output & proof (uniqueness)', () => {
    expect(prove('seed')).toEqual(prove('seed'));
  });

  it('different inputs give different (pseudorandom) outputs', () => {
    const a = prove('candidate-1'), b = prove('candidate-2');
    expect(a.proof).not.toBe(b.proof);
    expect(a.output).not.toBe(b.output);
  });

  it('hashes the input into the RSA group [1, n-1], never 0', () => {
    for (const s of ['', 'x', 'a-much-longer-input-string', '42']) {
      const h = hashToGroup(s);
      expect(h).toBeGreaterThanOrEqual(1);
      expect(h).toBeLessThan(N);
    }
  });

  it('the proof is the RSA core: pi^e mod n recovers H(input)', () => {
    const v = prove('check-the-trapdoor');
    // verify() relies on this identity; assert it directly against the public exponent
    let acc = 1; for (let i = 0; i < E; i++) acc = (acc * v.proof) % N;
    expect(acc).toBe(hashToGroup(v.input));
  });

  it('rejects a forged output (can\'t shop for a favorable result)', () => {
    const v = prove('lottery|round-7');
    const lie = (v.output + 1) % 1000;
    expect(verify(v.input, lie, v.proof)).toBe(false);
  });

  it('rejects a tampered proof', () => {
    const v = prove('lottery|round-7');
    expect(verify(v.input, v.output, v.proof === N - 1 ? 1 : v.proof + 1)).toBe(false);
  });

  it('rejects a proof bound to a different input (soundness)', () => {
    const v = prove('input-A');
    // the same proof, but claimed for another input, must fail
    expect(verify('input-B', v.output, v.proof)).toBe(false);
  });

  it('output is a stable 0–999 derivation of the proof', () => {
    const v = prove('x');
    expect(v.output).toBe(proofToOutput(v.proof));
    expect(v.output).toBeGreaterThanOrEqual(0);
    expect(v.output).toBeLessThan(1000);
  });
});
