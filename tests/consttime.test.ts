import { describe, it, expect } from 'vitest';
import { naiveEqual, constantTimeEqual, timingAttack, ALPHABET } from '../src/web/consttime';

describe('the leak: examined-byte count', () => {
  it('naive compare reveals the matching-prefix length', () => {
    expect(naiveEqual('secret', 'xxxxxx').examined).toBe(1); // mismatch at byte 0
    expect(naiveEqual('secret', 'sxxxxx').examined).toBe(2); // 1 byte matched, mismatch at 1
    expect(naiveEqual('secret', 'secrxx').examined).toBe(5); // 4 matched, mismatch at 4
    expect(naiveEqual('secret', 'secret')).toEqual({ equal: true, examined: 6 });
  });

  it('constant-time compare examines every byte no matter where the mismatch is', () => {
    expect(constantTimeEqual('secret', 'xxxxxx').examined).toBe(6);
    expect(constantTimeEqual('secret', 'secrxx').examined).toBe(6); // SAME as a total mismatch — no leak
    expect(constantTimeEqual('secret', 'secret')).toEqual({ equal: true, examined: 6 });
  });

  it('both agree on the actual equality result', () => {
    for (const g of ['secret', 'secrxt', 'xxxxxx', 'secre']) {
      expect(constantTimeEqual('secret', g).equal).toBe(naiveEqual('secret', g).equal);
    }
  });
});

describe('the attack', () => {
  const secret = 'tk7m9q';

  it('recovers the secret against the leaky comparator in LINEAR probes', () => {
    const a = timingAttack(secret, naiveEqual);
    expect(a.success).toBe(true);
    expect(a.recovered).toBe(secret);
    expect(a.probes).toBe(ALPHABET.length * secret.length); // 36·6 = 216, not 36^6 ≈ 2 billion
  });

  it('is the difference between feasible and infeasible', () => {
    const linear = ALPHABET.length * secret.length;
    const bruteForce = ALPHABET.length ** secret.length;
    expect(bruteForce / linear).toBeGreaterThan(1e7); // ~10 million times more work to brute-force
  });

  it('FAILS against the constant-time comparator — no timing signal to follow', () => {
    const a = timingAttack(secret, constantTimeEqual);
    expect(a.success).toBe(false); // can't recover byte-by-byte
    expect(a.recovered).not.toBe(secret);
  });
});
