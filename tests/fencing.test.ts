import { describe, it, expect } from 'vitest';
import { lockService, acquire, resource, write, splitBrainScenario } from '../src/web/fencing';

describe('fencing tokens', () => {
  it('the lock service hands out monotonically increasing tokens', () => {
    const ls = lockService();
    expect([acquire(ls), acquire(ls), acquire(ls)]).toEqual([1, 2, 3]);
  });

  it('a write with a stale token is rejected', () => {
    const r = resource();
    expect(write(r, 5, 'fresh').accepted).toBe(true);
    expect(write(r, 3, 'stale').accepted).toBe(false); // 3 < 5
    expect(r.value).toBe('fresh');                     // the stale write didn't land
  });

  it('an equal-or-higher token is accepted and advances the high-water mark', () => {
    const r = resource();
    write(r, 5, 'a');
    expect(write(r, 5, 'b').accepted).toBe(true); // == is fine (idempotent retry)
    expect(write(r, 9, 'c').accepted).toBe(true);
    expect(r.highestToken).toBe(9);
    expect(r.value).toBe('c');
  });
});

describe('the split-brain scenario', () => {
  const { withFencing, withoutFencing } = splitBrainScenario();

  it('WITHOUT fencing, the stale resumed client corrupts the data', () => {
    // B wrote (token 2), then A resumed and wrote with token 1 — last write wins, data is wrong
    expect(withoutFencing.value).toBe('A-data');
  });

  it('WITH fencing, the stale write is rejected and B\'s data survives', () => {
    expect(withFencing.value).toBe('B-data');
    expect(withFencing.highestToken).toBe(2);
    expect(withFencing.log.some((l) => l.includes('REJECTED'))).toBe(true);
  });
});
