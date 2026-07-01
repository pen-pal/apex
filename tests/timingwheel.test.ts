import { describe, it, expect } from 'vitest';
import { TimingWheel } from '../src/web/timingwheel';

describe('timers fire at exactly the right tick', () => {
  it('a delay of d fires on tick d, not before or after', () => {
    const w = new TimingWheel(8);
    w.add('a', 3); w.add('b', 8); w.add('c', 10); w.add('d', 1);
    const fireTick: Record<string, number> = {};
    for (let t = 1; t <= 12; t++) for (const x of w.tick()) fireTick[x.id] = t;
    expect(fireTick).toEqual({ d: 1, a: 3, b: 8, c: 10 });
  });
  it('places timers in the bucket the hand will reach, with the right round count', () => {
    const w = new TimingWheel(8);
    expect(w.add('short', 3)).toMatchObject({ rounds: 0, fireAt: 3 });
    expect(w.add('lap', 8)).toMatchObject({ rounds: 0, fireAt: 8 });   // exactly one lap → bucket 0, rounds 0
    expect(w.add('overlap', 10)).toMatchObject({ rounds: 1, fireAt: 10 }); // one full lap + 2
    expect(w.add('far', 25)).toMatchObject({ rounds: 3, fireAt: 25 });     // floor((25-1)/8)=3
  });
});

describe('scheduling relative to the moving hand', () => {
  it('delay is measured from the current time, wherever the hand is', () => {
    const w = new TimingWheel(8);
    w.tick(); w.tick(); w.tick();           // advance to time 3, hand at bucket 3
    const t = w.add('x', 6);
    expect(t.fireAt).toBe(9);               // 3 + 6
    let fired = -1;
    for (let now = 4; now <= 12; now++) for (const f of w.tick()) if (f.id === 'x') fired = now;
    expect(fired).toBe(9);
  });
});

describe('cancel', () => {
  it('removes a pending timer so it never fires', () => {
    const w = new TimingWheel(8);
    w.add('x', 5);
    expect(w.cancel('x')).toBe(true);
    expect(w.cancel('missing')).toBe(false);
    let any = false;
    for (let t = 1; t <= 16; t++) if (w.tick().length) any = true;
    expect(any).toBe(false);
  });
});

describe('agrees with ground truth under load (fuzz)', () => {
  it('3000 runs: every timer fires on exactly its scheduled absolute tick', () => {
    let s = 1; const rnd = (n: number) => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s % n; };
    for (let run = 0; run < 3000; run++) {
      const N = 4 + rnd(12);
      const w = new TimingWheel(N);
      const expected: Record<string, number> = {};
      for (let i = 0; i < 15; i++) { const t = w.add('t' + i, 1 + rnd(40)); expected['t' + i] = t.fireAt; }
      for (let t = 1; t <= 60; t++) {
        if (rnd(3) === 0) { const tm = w.add('m' + t, 1 + rnd(30)); expected['m' + t] = tm.fireAt; }
        for (const x of w.tick()) {
          expect(x.fireAt).toBe(t);          // fired exactly when due
          expect(expected[x.id]).toBe(t);
          delete expected[x.id];
        }
      }
    }
  });
});
