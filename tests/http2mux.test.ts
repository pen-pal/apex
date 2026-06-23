import { describe, it, expect } from 'vitest';
import { scheduleHttp11, scheduleHttp2, avgFinish, type Stream } from '../src/web/http2';

// Three responses sharing one connection: a big one first, then two small ones.
const streams: Stream[] = [
  { id: 1, label: 'app.js', frames: 6 },
  { id: 3, label: 'logo.png', frames: 1 },
  { id: 5, label: 'style.css', frames: 2 },
];

describe('HTTP/1.1 serial scheduling (head-of-line blocking)', () => {
  const s = scheduleHttp11(streams);
  it('finishes each stream only after all earlier ones complete', () => {
    expect(s.finish).toEqual({ 1: 6, 3: 7, 5: 9 }); // logo waits behind the 6-frame app.js
    expect(s.totalSlots).toBe(9);
  });
  it('the first six slots are all stream 1 (it blocks the rest)', () => {
    expect(s.ticks.slice(0, 6).every((t) => t.streamId === 1)).toBe(true);
  });
});

describe('HTTP/2 multiplexed scheduling (interleaved)', () => {
  const s = scheduleHttp2(streams);
  it('uses the same total slots but lets short streams finish early', () => {
    expect(s.totalSlots).toBe(9); // same total work
    expect(s.finish[3]).toBeLessThan(scheduleHttp11(streams).finish[3]); // logo no longer blocked
    expect(s.finish[3]).toBe(2); // logo.png done on its first scheduled frame (slot 2)
    expect(s.finish[5]).toBe(5); // style.css done after its 2 frames interleave
  });
  it('interleaves frames from different streams in the early slots', () => {
    const firstThree = s.ticks.slice(0, 3).map((t) => t.streamId);
    expect(new Set(firstThree).size).toBeGreaterThan(1); // not all the same stream
    expect(firstThree).toEqual([1, 3, 5]); // round-robin
  });
});

describe('the multiplexing win', () => {
  it('HTTP/2 lowers AVERAGE completion time though total bytes are equal', () => {
    const h11 = scheduleHttp11(streams);
    const h2 = scheduleHttp2(streams);
    expect(h2.lastFinish).toBe(h11.lastFinish); // last stream finishes at the same time
    expect(avgFinish(h2, streams)).toBeLessThan(avgFinish(h11, streams)); // but the average is better
    // concretely: HTTP/1.1 avg (6+7+9)/3 = 7.33; HTTP/2 avg (9+2+5)/3 = 5.33
    expect(avgFinish(h11, streams)).toBeCloseTo(7.333, 2);
    expect(avgFinish(h2, streams)).toBeCloseTo(5.333, 2);
  });
});
