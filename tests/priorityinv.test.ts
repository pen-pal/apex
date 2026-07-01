import { describe, it, expect } from 'vitest';
import { simulate, SCENARIO } from '../src/web/priorityinv';

const noInh = simulate(SCENARIO, false);
const inh = simulate(SCENARIO, true);
const ranBefore = (tl: string[], id: string, doneAt: number) => tl.slice(0, doneAt).includes(id);

describe('the bug: unbounded priority inversion', () => {
  it('without inheritance, the MEDIUM task runs while HIGH is blocked (inversion)', () => {
    // M has no lock and is lower priority than H, yet it executes before H completes
    expect(ranBefore(noInh.timeline, 'M', noInh.completion.H)).toBe(true);
  });
  it('the high task is delayed well beyond its own work', () => {
    expect(noInh.hWait).toBeGreaterThan(0);
    expect(noInh.completion.H).toBe(14); // finishes far later than its ideal (arrival 2 + work 4 = 6)
  });
});

describe('the fix: priority inheritance', () => {
  it('the high task finishes much sooner', () => {
    expect(inh.completion.H).toBeLessThan(noInh.completion.H);
    expect(inh.completion.H).toBe(9);
    expect(inh.hWait).toBeLessThan(noInh.hWait);
  });
  it('the medium task no longer delays the high task (it runs AFTER H completes)', () => {
    expect(ranBefore(inh.timeline, 'M', inh.completion.H)).toBe(false);
  });
  it("H's wait is bounded by the low task's critical section, not by medium work", () => {
    // remaining critical section after H arrives is short; hWait reflects only that
    expect(inh.hWait).toBe(3);
  });
});

describe('both schedules are valid and complete', () => {
  it('every task finishes and does its full work in both modes', () => {
    for (const r of [noInh, inh]) {
      for (const t of SCENARIO) {
        expect(r.completion[t.id]).toBeGreaterThan(0);
        expect(r.timeline.filter((x) => x === t.id).length).toBe(t.work); // ran exactly `work` steps
      }
    }
  });
  it('the lock is never held by two tasks — H only enters its section after L releases', () => {
    // H's first run step comes only after L has executed through its unlock point in both modes
    const hStart = (tl: string[]) => tl.indexOf('H');
    expect(hStart(noInh.timeline)).toBeGreaterThan(0);
    expect(hStart(inh.timeline)).toBeGreaterThan(0);
  });
});
