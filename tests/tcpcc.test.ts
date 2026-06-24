import { describe, it, expect } from 'vitest';
import { simulateReno, peakCwnd } from '../src/web/tcpcc';

describe('TCP Reno congestion control', () => {
  it('slow start doubles each RTT until ssthresh, then additive increase', () => {
    const t = simulateReno({ rounds: 8, initialSsthresh: 8, initialCwnd: 1 });
    expect(t.map((r) => r.cwnd)).toEqual([1, 2, 4, 8, 9, 10, 11, 12]);
    // phases switch exactly when cwnd reaches ssthresh
    expect(t.map((r) => r.phase)).toEqual([
      'slow-start', 'slow-start', 'slow-start', 'congestion-avoidance',
      'congestion-avoidance', 'congestion-avoidance', 'congestion-avoidance', 'congestion-avoidance',
    ]);
  });

  it('a triple-dup-ACK halves ssthresh and drops cwnd to it (fast recovery)', () => {
    // grow to cwnd=12 in avoidance, then loss at round 7
    const t = simulateReno({ rounds: 10, initialSsthresh: 8, initialCwnd: 1, losses: { 7: 'triple-dup-ack' } });
    expect(t[7].cwnd).toBe(12); // window at the loss
    expect(t[8].ssthresh).toBe(6); // floor(12/2)
    expect(t[8].cwnd).toBe(6); // dropped to ssthresh, NOT to 1
    expect(t[8].phase).toBe('congestion-avoidance'); // stays in avoidance
    expect(t[9].cwnd).toBe(7); // resumes additive increase
  });

  it('a timeout collapses cwnd to 1 and restarts slow start', () => {
    // slow start 1,2,4,8,16 reaches ssthresh at round 4; inject a timeout there
    const t = simulateReno({ rounds: 9, initialSsthresh: 16, initialCwnd: 1, losses: { 4: 'timeout' } });
    expect(t[4].cwnd).toBe(16); // window at the timeout
    expect(t[5].cwnd).toBe(1); // collapsed to 1 MSS
    expect(t[5].ssthresh).toBe(8); // floor(16/2)
    expect(t[5].phase).toBe('slow-start'); // restarted slow start
    expect(t[6].cwnd).toBe(2); // doubling again
  });

  it('produces the classic AIMD sawtooth across repeated losses (exact sequence)', () => {
    const t = simulateReno({ rounds: 14, initialSsthresh: 16, initialCwnd: 1, losses: { 8: 'triple-dup-ack', 12: 'triple-dup-ack' } });
    // slow-start 1,2,4,8,16; avoid 17..20; loss@8 → 10 (=floor(20/2)); 11,12,13; loss@12 → 6
    expect(t.map((r) => r.cwnd)).toEqual([1, 2, 4, 8, 16, 17, 18, 19, 20, 10, 11, 12, 13, 6]);
  });

  it('never lets ssthresh fall below 2 (RFC 5681 floor 2·SMSS)', () => {
    // slow-start 1,2 reaches ssthresh=2, avoidance → 3; a loss there gives floor(3/2)=1,
    // which the 2·SMSS floor clamps UP to 2
    const t = simulateReno({ rounds: 5, initialSsthresh: 2, initialCwnd: 1, losses: { 2: 'triple-dup-ack' } });
    expect(t[2].cwnd).toBe(3);     // window at the loss
    expect(t[3].ssthresh).toBe(2); // floor(3/2)=1 clamped UP to the floor
    expect(t.every((r) => r.ssthresh >= 2 && r.cwnd >= 1)).toBe(true);
  });

  it('peakCwnd reports the highest window/threshold', () => {
    const t = simulateReno({ rounds: 8, initialSsthresh: 8, initialCwnd: 1 });
    expect(peakCwnd(t)).toBe(12);
  });
});
