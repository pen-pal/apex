import { describe, it, expect } from 'vitest';
import { analyze, simulate } from '../src/web/pbft';

describe('PBFT quorum math', () => {
  it('n=4, f=1 is the minimum tolerant configuration', () => {
    const a = analyze(4, 1);
    expect(a.tolerant).toBe(true);   // 4 ≥ 3·1+1
    expect(a.quorum).toBe(3);        // 2f+1
    expect(a.honest).toBe(3);
    expect(a.honestInQuorum).toBe(2); // quorum − f = at least one honest majority
  });

  it('two 2f+1 quorums always overlap in ≥ f+1 nodes, ≥1 honest', () => {
    for (const [n, f] of [[4, 1], [7, 2], [10, 3]]) {
      const a = analyze(n, f);
      expect(a.intersectionMin).toBeGreaterThanOrEqual(f + 1); // 2(2f+1)−(3f+1) = f+1
      expect(a.honestInIntersection).toBeGreaterThanOrEqual(1); // a shared honest witness
    }
  });

  it('n=3, f=1 cannot tolerate one Byzantine fault', () => {
    const a = analyze(3, 1);
    expect(a.tolerant).toBe(false); // 3 < 4
    expect(a.honest).toBe(2);
    expect(a.honest).toBeLessThan(a.quorum); // 2 honest < quorum of 3 → can't form a quorum
  });
});

describe('PBFT phase progression', () => {
  it('reaches agreement when n ≥ 3f+1', () => {
    const r = simulate(4, 1);
    expect(r.agreement).toBe(true);
    expect(r.phases.find((p) => p.name === 'commit')!.reached).toBe(true);
    expect(r.reason).toMatch(/safe/);
  });

  it('fails to agree when n < 3f+1 (the prepare/commit quorum is unreachable)', () => {
    const r = simulate(3, 1);
    expect(r.agreement).toBe(false);
    expect(r.phases.find((p) => p.name === 'prepare')!.reached).toBe(false);
    expect(r.reason).toMatch(/block or split/);
  });

  it('scales: n=7 tolerates f=2, n=6 does not', () => {
    expect(simulate(7, 2).agreement).toBe(true);
    expect(simulate(6, 2).agreement).toBe(false); // needs 7
  });
});
