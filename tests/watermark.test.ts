import { describe, it, expect } from 'vitest';
import { processStream, type Ev } from '../src/web/watermark';

// Arrival order (out of order in event-time): A@1 B@3 C@12 D@7 E@25 F@6
const EVENTS: Ev[] = [
  { id: 'A', time: 1 }, { id: 'B', time: 3 }, { id: 'C', time: 12 },
  { id: 'D', time: 7 }, { id: 'E', time: 25 }, { id: 'F', time: 6 },
];

describe('stream watermarks — tumbling windows, size 10, lateness 2', () => {
  const r = processStream(EVENTS, 10, 2);

  it('groups on-time events into their event-time windows', () => {
    const w = (s: number) => r.windows.find((x) => x.start === s);
    expect(w(0)!.events).toEqual(['A', 'B']);   // [0,10): A@1, B@3
    expect(w(10)!.events).toEqual(['C']);        // [10,20): C@12
    expect(w(20)!.events).toEqual(['E']);        // [20,30): E@25
  });

  it('fires a window when the watermark passes its end', () => {
    // C@12 pushes maxTime=12, watermark=10, which is exactly [0,10).end → it fires
    const w0 = r.windows.find((x) => x.start === 0)!;
    expect(w0.firedAt).toBe(10);
    // [10,20) fires when E@25 lifts the watermark to 23
    expect(r.windows.find((x) => x.start === 10)!.firedAt).toBe(23);
  });

  it('drops events that arrive after their window already fired (too late)', () => {
    // D@7 arrives after [0,10) fired (wm was 10); F@6 likewise → both late
    expect(r.late).toEqual(['D', 'F']);
  });

  it('flushes the last, still-open window at end of stream', () => {
    const w20 = r.windows.find((x) => x.start === 20)!;
    expect(w20.firedAt).toBe(Infinity); // watermark (23) never reached 30, so it flushes at stream end
  });

  it('the watermark is max-event-time minus the allowed lateness', () => {
    const cStep = r.steps.find((s) => s.id === 'C')!;
    expect(cStep.watermark).toBe(10); // maxTime 12 − lateness 2
    const eStep = r.steps.find((s) => s.id === 'E')!;
    expect(eStep.watermark).toBe(23);
  });

  it('flags exactly the late events in the per-step trace', () => {
    expect(r.steps.filter((s) => s.late).map((s) => s.id)).toEqual(['D', 'F']);
  });
});

describe('allowed-lateness slack', () => {
  it('more lateness lets a straggler still count', () => {
    // B@3 arrives after A@12 in arrival order; with lateness 10 the watermark stays low enough
    const evs: Ev[] = [{ id: 'A', time: 12 }, { id: 'B', time: 3 }];
    // window [0,10): wm after A@12 = 12 − 10 = 2 < 10, so [0,10) hasn't fired → B is still on time
    const r = processStream(evs, 10, 10);
    expect(r.late).toEqual([]);
    expect(r.windows.find((w) => w.start === 0)!.events).toEqual(['B']);
  });

  it('zero lateness fires eagerly and drops more', () => {
    const evs: Ev[] = [{ id: 'A', time: 12 }, { id: 'B', time: 3 }];
    // wm after A@12 = 12 → [0,10) fires empty; B@3 then arrives late
    const r = processStream(evs, 10, 0);
    expect(r.late).toEqual(['B']);
  });
});

describe('in-order stream', () => {
  it('every event lands in its window, none late', () => {
    const evs: Ev[] = [{ id: 'a', time: 0 }, { id: 'b', time: 5 }, { id: 'c', time: 11 }, { id: 'd', time: 21 }];
    const r = processStream(evs, 10, 0);
    expect(r.late).toEqual([]);
    expect(r.windows.map((w) => w.events)).toEqual([['a', 'b'], ['c'], ['d']]);
  });
});
