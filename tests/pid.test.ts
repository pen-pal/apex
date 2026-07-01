import { describe, it, expect } from 'vitest';
import { simulate } from '../src/web/pid';

const base = { setpoint: 10, load: 2, steps: 1200, dt: 0.05 };

describe('proportional term leaves a steady-state droop', () => {
  it('pure P settles with a residual error of load/Kp', () => {
    for (const kp of [1, 2, 4, 6]) {
      const r = simulate({ ...base, kp, ki: 0, kd: 0, steps: 4000 });
      expect(r.steadyError).toBeCloseTo(base.load / kp, 1); // droop = load/Kp
    }
  });
  it('a higher Kp shrinks the droop', () => {
    const lo = simulate({ ...base, kp: 1, ki: 0, kd: 0, steps: 4000 });
    const hi = simulate({ ...base, kp: 6, ki: 0, kd: 0, steps: 4000 });
    expect(Math.abs(hi.steadyError)).toBeLessThan(Math.abs(lo.steadyError));
  });
});

describe('integral term erases the steady-state error', () => {
  it('P+I drives the output exactly onto the setpoint', () => {
    const r = simulate({ ...base, kp: 3, ki: 1, kd: 0 });
    expect(Math.abs(r.steadyError)).toBeLessThan(0.01);
    expect(r.finalX).toBeCloseTo(base.setpoint, 1);
  });
});

describe('derivative term damps overshoot', () => {
  it('adding D reduces the overshoot of an oscillatory response', () => {
    const p = simulate({ ...base, kp: 3, ki: 0, kd: 0 });
    const pd = simulate({ ...base, kp: 3, ki: 0, kd: 2 });
    expect(p.overshoot).toBeGreaterThan(1);            // P alone overshoots a lot
    expect(pd.overshoot).toBeLessThan(p.overshoot);    // D damps it
    expect(pd.steadyError).toBeCloseTo(p.steadyError, 2); // D doesn't change the droop
  });
  it('full PID has no droop AND less overshoot than P+I alone', () => {
    const pi = simulate({ ...base, kp: 3, ki: 1, kd: 0 });
    const pid = simulate({ ...base, kp: 3, ki: 1, kd: 2 });
    expect(Math.abs(pid.steadyError)).toBeLessThan(0.01);
    expect(pid.overshoot).toBeLessThan(pi.overshoot);
    expect(pid.settleStep).toBeLessThan(pi.settleStep); // and settles faster
  });
});

describe('simulation soundness', () => {
  it('is deterministic and stays finite for these gains', () => {
    const a = simulate({ ...base, kp: 3, ki: 1, kd: 2 });
    const b = simulate({ ...base, kp: 3, ki: 1, kd: 2 });
    expect(a.series).toEqual(b.series);
    expect(Number.isFinite(a.finalX)).toBe(true);
    expect(a.series).toHaveLength(base.steps);
  });
});
