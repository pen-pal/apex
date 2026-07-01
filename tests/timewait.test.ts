import { describe, it, expect } from 'vitest';
import { analyze, maxSustainableRate } from '../src/web/timewait';

const POOL = 28232; // ~ 61000-32768

describe('port pressure follows Little\'s law (rate × TIME_WAIT)', () => {
  it('ports held equals rate times TIME_WAIT', () => {
    expect(analyze({ connRate: 1000, timeWaitSec: 60, portPool: POOL }).portsHeld).toBe(60000);
    expect(analyze({ connRate: 500, timeWaitSec: 30, portPool: POOL }).portsHeld).toBe(15000);
  });
});

describe('exhaustion when demand exceeds the pool', () => {
  it('high churn with the default 60s TIME_WAIT exhausts the ephemeral pool', () => {
    const r = analyze({ connRate: 1000, timeWaitSec: 60, portPool: POOL });
    expect(r.exhausted).toBe(true);
    expect(r.utilizationPct).toBeGreaterThan(200);
  });
  it('low churn stays well within the pool', () => {
    const r = analyze({ connRate: 100, timeWaitSec: 60, portPool: POOL });
    expect(r.exhausted).toBe(false);
    expect(r.utilizationPct).toBeCloseTo(21.25, 1);
  });
});

describe('the three levers that fix it', () => {
  it('shorter TIME_WAIT (tcp_tw_reuse) relieves pressure', () => {
    expect(analyze({ connRate: 1000, timeWaitSec: 60, portPool: POOL }).exhausted).toBe(true);
    expect(analyze({ connRate: 1000, timeWaitSec: 15, portPool: POOL }).exhausted).toBe(false);
  });
  it('a wider ephemeral range raises the ceiling', () => {
    expect(analyze({ connRate: 1000, timeWaitSec: 60, portPool: POOL }).exhausted).toBe(true);
    expect(analyze({ connRate: 1000, timeWaitSec: 60, portPool: 65000 }).exhausted).toBe(false);
  });
  it('lower connect rate (connection pooling / keep-alive) is the real fix', () => {
    // pooling turns 1000 short connections/s into a handful of reused ones
    expect(analyze({ connRate: 1000, timeWaitSec: 60, portPool: POOL }).exhausted).toBe(true);
    expect(analyze({ connRate: 50, timeWaitSec: 60, portPool: POOL }).exhausted).toBe(false);
  });
});

describe('max sustainable rate', () => {
  it('is pool / TIME_WAIT, and marks the exhaustion boundary', () => {
    expect(maxSustainableRate(POOL, 60)).toBeCloseTo(470.5, 1);
    const rate = maxSustainableRate(POOL, 60);
    expect(analyze({ connRate: Math.floor(rate), timeWaitSec: 60, portPool: POOL }).exhausted).toBe(false);
    expect(analyze({ connRate: Math.ceil(rate) + 1, timeWaitSec: 60, portPool: POOL }).exhausted).toBe(true);
  });
});
