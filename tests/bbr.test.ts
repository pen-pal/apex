import { describe, it, expect } from 'vitest';
import { bdpKB, bbrSteady, lossBasedSteady, startup, type Link } from '../src/web/bbr';

// 100 Mbps bottleneck, 40 ms RTT, a fat 250 KB buffer.
const link: Link = { btlBwMbps: 100, rtPropMs: 40, bufferKB: 250 };

describe('BDP', () => {
  it('= bandwidth × propagation delay', () => {
    // 100e6/8 bytes/s × 0.04 s = 500_000 bytes = 488.28 KB
    expect(bdpKB(link)).toBeCloseTo(488.28, 1);
  });
});

describe('BBR vs loss-based steady state', () => {
  const bbr = bbrSteady(link);
  const loss = lossBasedSteady(link);

  it('both achieve full throughput (fill the pipe)', () => {
    expect(bbr.throughputMbps).toBe(100);
    expect(loss.throughputMbps).toBe(100);
  });

  it('BBR keeps the buffer empty → RTT stays at the propagation delay', () => {
    expect(bbr.queueKB).toBeCloseTo(0, 6);
    expect(bbr.rttMs).toBeCloseTo(40, 6);
  });

  it('loss-based fills the buffer → bufferbloat adds latency', () => {
    expect(loss.queueKB).toBe(250);
    // queue delay = 250 KB / 100 Mbps = 250*1024*8 / 100e6 s = 20.48 ms
    expect(loss.rttMs).toBeCloseTo(40 + 20.48, 1);
    expect(loss.rttMs).toBeGreaterThan(bbr.rttMs); // the whole point of BBR
  });
});

describe('BBR STARTUP bandwidth probing', () => {
  it('doubles the estimate each round until it plateaus at BtlBw', () => {
    const s = startup(link);
    expect(s[0].estBwMbps).toBe(2);   // 1 → 2
    expect(s[1].estBwMbps).toBe(4);
    expect(s[2].estBwMbps).toBe(8);
    const found = s[s.length - 1].estBwMbps;
    expect(found).toBe(100);          // capped at the bottleneck
    expect(s.some((r) => r.plateau)).toBe(true); // it noticed the plateau
  });
});

describe('STARTUP exit threshold', () => {
  it('exits after exactly 3 flat rounds (matches real BBR full_bw_count ≥ 3)', () => {
    const out = startup({ btlBwMbps: 100, minRttMs: 20 } as any, 20);
    expect(out.filter((r) => r.plateau)).toHaveLength(3); // three plateaus, then stop
    expect(out[out.length - 1].estBwMbps).toBe(100); // settled at BtlBw
  });
});
