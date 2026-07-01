import { describe, it, expect } from 'vitest';
import { transfer, scenario } from '../src/web/swsyndrome';

describe('transfer arithmetic', () => {
  it('tiny segments waste almost everything on headers', () => {
    const t = transfer(1000, 1, 40);
    expect(t.segments).toBe(1000);
    expect(t.headerBytes).toBe(40000);
    expect(t.wireBytes).toBe(41000);
    expect(t.efficiency).toBeCloseTo(1000 / 41000, 6); // ~2.4%
  });
  it('full-MSS segments are efficient', () => {
    const t = transfer(1000, 1460, 40);
    expect(t.segments).toBe(1);
    expect(t.efficiency).toBeCloseTo(1000 / 1040, 6);  // ~96%
  });
  it('efficiency = payload / (payload + segments·header), and all payload is covered', () => {
    for (const [p, s] of [[1000, 7], [100000, 1], [5, 1460], [1, 1]] as [number, number][]) {
      const t = transfer(p, s, 40);
      expect(t.efficiency).toBe(p / (p + t.segments * 40));
      expect(t.segments * t.segSize).toBeGreaterThanOrEqual(p); // segments cover the payload
    }
  });
  it('efficiency rises monotonically with segment size', () => {
    let prev = 0;
    for (const s of [1, 2, 10, 50, 200, 1000, 1460]) { const e = transfer(100000, s).efficiency; expect(e).toBeGreaterThanOrEqual(prev); prev = e; }
  });
  it('handles a zero-byte payload without dividing by zero', () => {
    expect(transfer(0, 100).efficiency).toBe(1);
  });
});

describe('SWS scenario: slow reader vs avoidance', () => {
  it('a 1-byte reader is catastrophic; avoidance coalesces to full segments', () => {
    const sc = scenario(100000, 1, 1460, 40);
    expect(sc.naive.efficiency).toBeLessThan(0.05);      // ~2.4%
    expect(sc.avoided.efficiency).toBeGreaterThan(0.95); // ~97%
    expect(sc.avoided.segments).toBeLessThan(sc.naive.segments);
    expect(sc.speedup).toBeGreaterThan(20);              // ~40x less wire traffic
  });
  it('a reasonably-sized reader is already fine (SWS is about the tiny increments)', () => {
    const sc = scenario(100000, 1460, 1460, 40);
    expect(sc.naive.efficiency).toBeCloseTo(sc.avoided.efficiency, 6);
    expect(sc.speedup).toBeCloseTo(1, 6);
  });
});
