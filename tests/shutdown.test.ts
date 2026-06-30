import { describe, it, expect } from 'vitest';
import { shutdown, type Req } from '../src/web/shutdown';

// Requests relative to SIGTERM at t=0 (negative arrival = already in flight).
const REQS: Req[] = [
  { id: 'r1', arrival: -2, duration: 3 },  // finishes at +1
  { id: 'r2', arrival: -1, duration: 5 },  // finishes at +4
  { id: 'r3', arrival: 1, duration: 2 },   // arrives during the readiness window, finishes at +3
  { id: 'r4', arrival: 3, duration: 2 },   // arrives after the LB stopped routing here → rejected
  { id: 'r5', arrival: -3, duration: 12 }, // a long request, finishes at +9
];

describe('graceful shutdown drains in-flight requests', () => {
  it('with a grace period longer than the longest request, nothing is dropped', () => {
    const r = shutdown(REQS, 2, 10);
    expect(r.dropped).toBe(0);
    expect(r.cleanExit).toBe(true);
    expect(r.rejected).toBe(1);       // r4 arrived too late
    expect(r.completed).toBe(4);
    expect(r.drainNeeded).toBe(9);    // had to wait for r5
  });

  it('a grace period shorter than the longest request force-kills the stragglers', () => {
    const r = shutdown(REQS, 2, 6);
    expect(r.dropped).toBe(1);        // r5 (finishes at 9 > grace 6) is SIGKILLed
    expect(r.cleanExit).toBe(false);
    expect(r.results.find((x) => x.id === 'r5')!.outcome).toBe('dropped');
  });
});

describe('the abrupt-kill anti-pattern', () => {
  it('an immediate exit (grace period 0) drops every in-flight request', () => {
    const r = shutdown(REQS, 2, 0);
    expect(r.dropped).toBe(4);        // r1,r2,r3,r5 all still running → all dropped
    expect(r.completed).toBe(0);
    expect(r.cleanExit).toBe(false);
  });
});

describe('readiness propagation', () => {
  it('requests arriving after the readiness delay are routed elsewhere (rejected, not dropped)', () => {
    const r = shutdown(REQS, 2, 100);
    expect(r.results.find((x) => x.id === 'r4')!.outcome).toBe('rejected');
    expect(r.dropped).toBe(0); // a reject is the LB's job, not a failed request here
  });
  it('a longer readiness window accepts more late arrivals (and must drain them)', () => {
    const more = shutdown(REQS, 4, 100); // now r4 (arrival 3) is accepted
    expect(more.rejected).toBe(0);
    expect(more.completed).toBe(5);
  });
});
