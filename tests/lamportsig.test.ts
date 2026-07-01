import { describe, it, expect } from 'vitest';
import { keygen, sign, verify, messageBits, revealed, forgeablePositions, H, L } from '../src/web/lamportsig';

describe('key structure', () => {
  it('a key pair is 2L secrets and their hashes', () => {
    const kp = keygen(777);
    expect(kp.priv).toHaveLength(L);
    expect(kp.pub).toHaveLength(L);
    for (let i = 0; i < L; i++) { expect(H(kp.priv[i][0])).toBe(kp.pub[i][0]); expect(H(kp.priv[i][1])).toBe(kp.pub[i][1]); }
  });
});

describe('sign and verify', () => {
  const kp = keygen(42);
  const msg = 'transfer $100 to alice';
  it('a signature reveals one secret per bit and verifies', () => {
    const sig = sign(msg, kp.priv);
    expect(sig).toHaveLength(L);
    expect(verify(msg, sig, kp.pub)).toBe(true);
    const bits = messageBits(msg);
    expect(sig.every((s, i) => H(s) === kp.pub[i][bits[i]])).toBe(true);
  });
  it('rejects a tampered message', () => {
    const sig = sign(msg, kp.priv);
    expect(verify('transfer $900 to alice', sig, kp.pub)).toBe(false);
  });
  it('rejects a tampered signature', () => {
    const sig = sign(msg, kp.priv);
    const bad = [...sig]; bad[3] = 'deadbeef';
    expect(verify(msg, bad, kp.pub)).toBe(false);
  });
  it('round-trips over many keys and messages (fuzz)', () => {
    let s = 1; const rnd = (n: number) => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s % n; };
    for (let t = 0; t < 5000; t++) {
      const k = keygen(rnd(1e9)); const m = 'msg' + rnd(1e6);
      expect(verify(m, sign(m, k.priv), k.pub)).toBe(true);
    }
  });
});

describe('the one-time weakness', () => {
  it('one message exposes no both-secret positions', () => {
    expect(forgeablePositions(['hello'])).toBe(0);
    for (const set of revealed(['hello'])) expect(set.size).toBe(1); // exactly one secret revealed per position
  });
  it('two messages expose both secrets exactly where their digests differ', () => {
    const msgs = ['transfer $100 to alice', 'transfer $250 to bob'];
    const b1 = messageBits(msgs[0]), b2 = messageBits(msgs[1]);
    const differing = b1.filter((x, i) => x !== b2[i]).length;
    expect(forgeablePositions(msgs)).toBe(differing);
    expect(forgeablePositions(msgs)).toBeGreaterThan(0); // reusing a key leaks
  });
});
