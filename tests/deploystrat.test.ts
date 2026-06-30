import { describe, it, expect } from 'vitest';
import { simulate, availability, minAvailability, type Strategy } from '../src/web/deploystrat';

const ALL: Strategy[] = ['recreate', 'rolling', 'bluegreen', 'canary'];

describe('every strategy ends fully on v2 at 100% traffic', () => {
  for (const s of ALL) {
    it(`${s} finishes on all-v2`, () => {
      const steps = simulate(s, 4);
      const last = steps[steps.length - 1];
      expect(last.instances.every((v) => v === 'v2')).toBe(true);
      expect(last.trafficV2).toBe(100);
    });
  }
});

describe('downtime is unique to recreate', () => {
  it('recreate has a 0%-availability window', () => {
    expect(minAvailability(simulate('recreate', 4))).toBe(0);
  });
  it('rolling, blue-green and canary are zero-downtime', () => {
    for (const s of ['rolling', 'bluegreen', 'canary'] as Strategy[]) expect(minAvailability(simulate(s, 4))).toBeGreaterThan(0);
  });
});

describe('rolling: capacity dips but both versions serve', () => {
  const steps = simulate('rolling', 4, 1);
  it('availability drops below 100 during a swap but never to 0', () => {
    expect(Math.min(...steps.map(availability))).toBe(75); // one of four down
    expect(minAvailability(steps)).toBeGreaterThan(0);
  });
  it('at some step both v1 and v2 are live simultaneously', () => {
    expect(steps.some((s) => s.instances.includes('v1') && s.instances.includes('v2'))).toBe(true);
  });
  it('a bigger batch dips capacity further', () => {
    expect(Math.min(...simulate('rolling', 4, 2).map(availability))).toBe(50);
  });
});

describe('blue-green: atomic cutover at full capacity', () => {
  const steps = simulate('bluegreen', 3);
  it('stays at 100% availability the whole time', () => {
    expect(minAvailability(steps)).toBe(100);
  });
  it('has a step where v2 is fully up but still serving 0% traffic, then jumps to 100%', () => {
    const ready = steps.find((s) => s.trafficV2 === 0 && s.phase.includes('smoke-tested'));
    expect(ready).toBeDefined();
    expect(steps[steps.length - 1].trafficV2).toBe(100); // atomic 0 → 100
    expect(steps.some((s) => s.trafficV2 > 0 && s.trafficV2 < 100)).toBe(false); // no gradual ramp
  });
});

describe('canary: gradual traffic ramp', () => {
  const steps = simulate('canary', 4);
  it('traffic to v2 strictly increases 0 → 5 → 50 → 100', () => {
    expect(steps.map((s) => s.trafficV2)).toEqual([0, 5, 50, 100]);
  });
  it('starts with a single canary instance taking a small traffic slice', () => {
    const canaryStep = steps[1];
    expect(canaryStep.instances.filter((v) => v === 'v2')).toHaveLength(1);
    expect(canaryStep.trafficV2).toBeLessThan(10); // small slice while it's watched
  });
});
