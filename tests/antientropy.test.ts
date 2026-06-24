import { describe, it, expect } from 'vitest';
import { quorumRead, leafHashes, buildMerkle, merkleDiff, type Replica } from '../src/web/antientropy';

describe('read-repair (quorum read reconciliation)', () => {
  const reps: Replica[] = [
    { id: 'A', value: 'cart=[milk]', version: 5 },
    { id: 'B', value: 'cart=[milk,eggs]', version: 7 },
    { id: 'C', value: 'cart=[milk]', version: 5 },
  ];
  it('returns the newest version and flags the stale replicas for repair', () => {
    const r = quorumRead(reps, 3);
    expect(r.winner).toBe('cart=[milk,eggs]');
    expect(r.winningVersion).toBe(7);
    expect(r.stale).toEqual(['A', 'C']); // both behind B
    expect(r.repaired).toBe(true);
  });
  it('does nothing when the quorum already agrees', () => {
    const agree = [{ id: 'A', value: 'x', version: 9 }, { id: 'B', value: 'x', version: 9 }];
    const r = quorumRead(agree, 2);
    expect(r.repaired).toBe(false);
    expect(r.stale).toEqual([]);
  });
});

describe('anti-entropy via Merkle trees', () => {
  const keys = (extra = '') => Array.from({ length: 64 }, (_, i) => `key${i}=v${i}${i === 19 ? extra : ''}`);

  it('identical keyspaces match in a single root comparison', () => {
    const a = buildMerkle(leafHashes(keys()));
    const b = buildMerkle(leafHashes(keys()));
    const d = merkleDiff(a, b);
    expect(d.differingLeaves).toEqual([]);
    expect(d.comparisons).toBe(1); // just the root — O(1) when in sync
  });

  it('pinpoints a single divergent key in O(log n), not O(n)', () => {
    const a = buildMerkle(leafHashes(keys())); // replica A
    const b = buildMerkle(leafHashes(keys('!'))); // replica B differs only at key19
    const d = merkleDiff(a, b);
    expect(d.differingLeaves).toEqual([19]); // exactly the divergent key
    expect(d.comparisons).toBeLessThanOrEqual(2 * Math.log2(64) + 1); // ≤13 node compares, not 64
    expect(d.comparisons).toBeLessThan(64);
  });

  it('finds multiple divergent keys and still beats a full scan', () => {
    const a = buildMerkle(leafHashes(Array.from({ length: 64 }, (_, i) => `k${i}`)));
    const b = buildMerkle(leafHashes(Array.from({ length: 64 }, (_, i) => `k${i}${i === 3 || i === 40 ? 'x' : ''}`)));
    const d = merkleDiff(a, b);
    expect(d.differingLeaves.sort((x, y) => x - y)).toEqual([3, 40]);
    expect(d.comparisons).toBeLessThan(64);
  });

  it('the root hash is a deterministic fingerprint of the whole keyspace', () => {
    expect(buildMerkle(leafHashes(keys())).hash).toBe(buildMerkle(leafHashes(keys())).hash);
    expect(buildMerkle(leafHashes(keys())).hash).not.toBe(buildMerkle(leafHashes(keys('!'))).hash);
  });
});
