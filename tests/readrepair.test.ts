import { describe, it, expect } from 'vitest';
import { read, write, converged, type Replica } from '../src/web/readrepair';

const fresh = (): Replica[] => [0, 1, 2, 3, 4].map((id) => ({ id, value: 'v1', version: 1 }));

describe('a read heals the stale replicas it touches', () => {
  it('returns the freshest value and writes it back to stale replicas in the read set', () => {
    const reps = fresh();
    write(reps, [0, 1, 2], 'v2', 2);          // the write reached 0,1,2; 3,4 are stale
    expect(converged(reps)).toBe(false);
    const r = read(reps, [2, 3, 4]);          // read a quorum that includes a fresh replica
    expect(r.value).toBe('v2');
    expect(r.repaired.sort()).toEqual([3, 4]); // 3 and 4 were behind → repaired
    expect(reps.find((x) => x.id === 3)!.version).toBe(2);
    expect(reps.find((x) => x.id === 4)!.version).toBe(2);
  });
  it('does NOT touch replicas outside the read set', () => {
    const reps = fresh();
    write(reps, [0], 'v2', 2);                // only replica 0 got the write
    read(reps, [0, 1]);                        // read {0,1} → repairs 1, leaves 2,3,4 alone
    expect(reps.find((x) => x.id === 1)!.version).toBe(2);
    for (const id of [2, 3, 4]) expect(reps.find((x) => x.id === id)!.version).toBe(1); // still stale
  });
});

describe('a read set that misses the newest returns stale data', () => {
  it('reading only behind replicas yields the old value (sawNewest = false)', () => {
    const reps = fresh();
    write(reps, [0, 1, 2], 'v2', 2);
    const r = read(reps, [3, 4]);             // both stale, missed the write
    expect(r.value).toBe('v1');
    expect(r.sawNewest).toBe(false);
    expect(r.version).toBeLessThan(r.globalNewest);
  });
});

describe('R + W > N guarantees the read sees the newest', () => {
  it('overlapping write and read sets always surface the latest version', () => {
    // N=5, W=3 ({0,1,2}), R=3 — any 3-replica read set overlaps a 3-replica write set (3+3>5)
    const writeSet = [0, 1, 2];
    const readSets = [[0, 3, 4], [1, 3, 4], [2, 3, 4], [2, 4, 0]];
    for (const rs of readSets) {
      const reps = fresh();
      write(reps, writeSet, 'v2', 2);
      expect(read(reps, rs).sawNewest).toBe(true); // overlap → sees v2
    }
  });
});

describe('convergence', () => {
  it('a handful of overlapping reads bring the whole cluster into agreement', () => {
    const reps = fresh();
    write(reps, [0], 'v2', 2);                // one replica ahead
    read(reps, [0, 1, 2]); read(reps, [2, 3, 4]); read(reps, [0, 3, 4]);
    expect(converged(reps)).toBe(true);
  });
});
