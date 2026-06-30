import { describe, it, expect } from 'vitest';
import { step, run, initState, type Tick } from '../src/web/healthcheck';

const T = (liveness: 'pass' | 'fail', readiness: 'pass' | 'fail'): Tick => ({ liveness, readiness });

describe('readiness gates traffic without restarting', () => {
  it('a ready, live instance serves traffic', () => {
    const r = step(initState(), T('pass', 'pass'));
    expect(r.state.serving).toBe(true);
    expect(r.restarted).toBe(false);
  });
  it('a readiness failure removes it from the LB but does NOT restart it', () => {
    const r = step({ phase: 'live', ready: true, serving: true, livenessFails: 0, restarts: 0 }, T('pass', 'fail'));
    expect(r.state.serving).toBe(false);
    expect(r.state.restarts).toBe(0);   // no restart
    expect(r.restarted).toBe(false);
  });
  it('readiness recovering puts it back in rotation', () => {
    const unready = step(initState(), T('pass', 'fail')).state;
    const back = step(unready, T('pass', 'pass'));
    expect(back.state.serving).toBe(true);
  });
});

describe('liveness restarts only after the failure threshold', () => {
  it('fewer than threshold consecutive failures do NOT restart', () => {
    const seq = run([T('fail', 'pass'), T('fail', 'pass')], 3); // 2 < 3
    expect(seq.every((r) => !r.restarted)).toBe(true);
    expect(seq[1].state.restarts).toBe(0);
  });
  it('the threshold-th consecutive failure kills and restarts the container', () => {
    const seq = run([T('fail', 'pass'), T('fail', 'pass'), T('fail', 'pass')], 3);
    expect(seq[2].restarted).toBe(true);
    expect(seq[2].state.restarts).toBe(1);
    expect(seq[2].state.phase).toBe('starting'); // back to square one
  });
  it('a passing liveness probe resets the failure counter (no false restart)', () => {
    const seq = run([T('fail', 'pass'), T('pass', 'pass'), T('fail', 'pass'), T('fail', 'pass')], 3);
    expect(seq.every((r) => !r.restarted)).toBe(true); // never 3 in a row
    expect(seq[3].state.livenessFails).toBe(2);
  });
});

describe('the classic anti-pattern: slow-under-load on the liveness probe', () => {
  it('sustained liveness failure (e.g. app slow under load) triggers a restart storm', () => {
    // if the probe that should have been READINESS is on LIVENESS, repeated slowness restarts the pod
    const seq = run([T('fail', 'fail'), T('fail', 'fail'), T('fail', 'fail'), T('fail', 'fail'), T('fail', 'fail'), T('fail', 'fail')], 3);
    const restarts = seq.filter((r) => r.restarted).length;
    expect(restarts).toBe(2); // 6 failures / threshold 3 → two restart cycles (crashloop)
  });
  it('the SAME slowness as a readiness check just sheds traffic — zero restarts', () => {
    const seq = run([T('pass', 'fail'), T('pass', 'fail'), T('pass', 'fail'), T('pass', 'fail')], 3);
    expect(seq.every((r) => !r.restarted)).toBe(true);
    expect(seq.every((r) => !r.state.serving)).toBe(true); // out of rotation, but alive
  });
});
