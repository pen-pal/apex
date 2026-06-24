import { describe, it, expect } from 'vitest';
import { backoffDelay, lcg, simulateFleet, runBreaker, type Req } from '../src/web/retry';

describe('backoff delay formula', () => {
  const r = () => 0.5;
  it('exponential doubles each attempt and saturates at the cap', () => {
    // base 100, cap 2000: 100, 200, 400, 800, 1600, then capped at 2000
    expect([0, 1, 2, 3, 4, 5, 6].map((a) => backoffDelay('exp', a, 100, 2000, r))).toEqual([100, 200, 400, 800, 1600, 2000, 2000]);
  });
  it('fixed and none are constant', () => {
    expect(backoffDelay('fixed', 5, 100, 2000, r)).toBe(100);
    expect(backoffDelay('none', 5, 100, 2000, r)).toBe(0);
  });
  it('full jitter stays within [0, exp] (AWS formula)', () => {
    const rnd = lcg(123);
    for (let a = 0; a < 8; a++) {
      const exp = Math.min(2000, 100 * 2 ** a);
      const d = backoffDelay('jitter', a, 100, 2000, rnd);
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThanOrEqual(exp);
    }
  });
});

describe('the thundering herd and its cure', () => {
  // base 1000 spans many 200ms buckets, giving jitter room to spread the retry storm
  const opts = { clients: 200, baseMs: 1000, capMs: 16000, healMs: 16000, maxAttempts: 8, horizonMs: 20000, bucketMs: 200, seed: 1 };

  it('no backoff hammers the upstream — every client burns all attempts at t=0', () => {
    const f = simulateFleet('none', opts);
    expect(f.peak).toBe(opts.clients * opts.maxAttempts);
  });

  it('plain exponential synchronizes the fleet into full-fleet retry waves', () => {
    const exp = simulateFleet('exp', opts);
    expect(exp.retryPeak).toBe(opts.clients); // every retry wave is the WHOLE fleet at one instant
  });

  it('FULL JITTER flattens the retry waves dramatically — the thundering-herd cure', () => {
    const exp = simulateFleet('exp', opts);
    const jit = simulateFleet('jitter', opts);
    expect(jit.retryPeak).toBeLessThan(exp.retryPeak / 2); // de-synchronized: no full-fleet spike
    expect(jit.retryPeak).toBeGreaterThan(0);
  });

  it('is fully reproducible for a given seed', () => {
    expect(simulateFleet('jitter', opts)).toEqual(simulateFleet('jitter', opts));
  });
});

describe('circuit breaker state machine (Nygard / Hystrix)', () => {
  const cfg = { failThreshold: 3, cooldownMs: 100 };
  // hand-traced trace: 3 fails trip it OPEN@2; shed during cooldown; a probe@102 closes it; 3 more
  // fails re-open@105; shed; a probe@205 closes again.
  const reqs: Req[] = [
    { t: 0, upstream: 'failure' }, { t: 1, upstream: 'failure' }, { t: 2, upstream: 'failure' },
    { t: 3, upstream: 'failure' }, { t: 50, upstream: 'failure' }, { t: 102, upstream: 'success' },
    { t: 103, upstream: 'failure' }, { t: 104, upstream: 'failure' }, { t: 105, upstream: 'failure' },
    { t: 106, upstream: 'success' }, { t: 205, upstream: 'success' },
  ];
  const steps = runBreaker(reqs, cfg);

  it('trips OPEN after the failure threshold', () => {
    expect(steps[2].state).toBe('closed');
    expect(steps[2].nextState).toBe('open'); // the 3rd consecutive failure trips it
  });

  it('sheds load (fails fast) while OPEN during the cooldown', () => {
    expect(steps[3].result).toBe('shed');
    expect(steps[4].result).toBe('shed');
    expect(steps[3].allowed).toBe(false); // request never reaches the upstream
  });

  it('goes HALF-OPEN after cooldown and CLOSES on a successful probe', () => {
    expect(steps[5].state).toBe('half-open'); // t=102, 100ms after opening at t=2
    expect(steps[5].result).toBe('success');
    expect(steps[5].nextState).toBe('closed');
  });

  it('after closing, fresh failures re-open it and requests shed within each new cooldown', () => {
    expect(steps[8].nextState).toBe('open'); // 3 fresh CLOSED-state failures re-open at t=105
    expect(steps[8].state).toBe('closed'); // (this path is driven from CLOSED, not a half-open probe)
    expect(steps[9].result).toBe('shed'); // t=106 is within the new cooldown → shed
    expect(steps[10].state).toBe('half-open'); // t=205 probes again
    expect(steps[10].nextState).toBe('closed');
    expect(steps.filter((s) => s.result === 'shed')).toHaveLength(3);
  });

  it('a FAILED half-open probe immediately re-opens the breaker (does not need a fresh threshold)', () => {
    // trip OPEN at t=2, then the very first post-cooldown probe FAILS → straight back to OPEN
    const trace: Req[] = [
      { t: 0, upstream: 'failure' }, { t: 1, upstream: 'failure' }, { t: 2, upstream: 'failure' }, // → OPEN@2
      { t: 102, upstream: 'failure' }, // cooldown elapsed → HALF-OPEN, probe FAILS → re-OPEN@102
      { t: 150, upstream: 'success' }, // within the new cooldown → shed (proves it really re-opened)
      { t: 202, upstream: 'success' }, // cooldown elapsed again → HALF-OPEN, probe succeeds → CLOSED
    ];
    const s = runBreaker(trace, cfg);
    expect(s[3].state).toBe('half-open'); // the probe ran in half-open
    expect(s[3].result).toBe('failure'); // and it failed
    expect(s[3].nextState).toBe('open'); // → re-open immediately on the single failed probe
    expect(s[4].result).toBe('shed'); // re-opened: the next request is shed
    expect(s[5].state).toBe('half-open'); // 100ms after t=102 → probe again
    expect(s[5].nextState).toBe('closed'); // succeeds → closed
  });
});
