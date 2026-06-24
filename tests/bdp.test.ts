import { describe, it, expect } from 'vitest';
import { compute } from '../src/web/bdp';

describe('Bandwidth-Delay Product (1 Gbps, 100 ms — the classic long-fat-pipe case)', () => {
  const r = compute(1000, 100, 64); // 64 KB un-scaled window

  it('BDP = bandwidth × RTT = 12.5 MB', () => {
    expect(r.bdpBytes).toBe(12_500_000); // 1e9/8 bytes/s × 0.1 s
  });

  it('a 64 KB window caps throughput at window / RTT ≈ 5.24 Mbps', () => {
    expect(r.windowLimitedMbps).toBeCloseTo(5.24288, 4); // 65536 B / 0.1 s × 8 / 1e6
    expect(r.effectiveMbps).toBeCloseTo(5.24288, 4);
  });

  it('that is well under 1% of the link — the window is the bottleneck', () => {
    expect(r.utilization).toBeLessThan(0.01);
    expect(r.windowLimited).toBe(true);
  });

  it('reports the window size needed to fill the pipe (~12.2 MB)', () => {
    expect(r.windowNeededKB).toBeCloseTo(12_207, 0);
  });
});

describe('a window at or above the BDP saturates the link', () => {
  it('utilization reaches 100% and the window is no longer the limit', () => {
    const r = compute(1000, 100, 13_000); // ~12.7 MB window > 12.5 MB BDP
    expect(r.effectiveMbps).toBe(1000);
    expect(r.utilization).toBe(1);
    expect(r.windowLimited).toBe(false);
  });

  it('low RTT shrinks the BDP, so the same window goes much further', () => {
    const lan = compute(1000, 1, 64);  // 1 ms RTT → BDP 125 KB
    const wan = compute(1000, 100, 64); // 100 ms RTT → BDP 12.5 MB
    expect(lan.utilization).toBeGreaterThan(0.5);          // 64 KB covers half the small BDP
    expect(lan.utilization).toBeGreaterThan(wan.utilization * 50); // vastly better than the WAN
  });
});
