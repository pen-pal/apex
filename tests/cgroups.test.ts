import { describe, it, expect } from 'vitest';
import { cpuThrottle, memoryOutcome, pidsOutcome } from '../src/web/cgroups';

// Independent oracle: the three cgroup limit semantics. CPU throughput is capped at the quota and a task wanting more
// is throttled; memory over the limit is OOM-killed; forks succeed up to pids.max and fail past it. Expected numbers
// are computed by hand from those rules, not read from the model.

describe('cpu.max — quota throttling', () => {
  it('a task under its quota is not throttled', () => {
    const r = cpuThrottle(80, 60);
    expect(r.effectivePct).toBe(60);
    expect(r.throttled).toBe(false);
    expect(r.throttledPct).toBe(0);
  });
  it('a task over its quota is throttled down to the quota', () => {
    const r = cpuThrottle(40, 100); // wants a full core, allowed 40%
    expect(r.effectivePct).toBe(40);
    expect(r.throttled).toBe(true);
    expect(r.throttledPct).toBe(60); // denied 60 of the 100 it wanted
  });
});

describe('memory.max — OOM', () => {
  it('a working set within the limit is fine', () => {
    expect(memoryOutcome(300, 512)).toEqual({ usedMb: 300, oom: false });
  });
  it('a working set over the limit is OOM-killed', () => {
    const r = memoryOutcome(700, 512);
    expect(r.oom).toBe(true);
    expect(r.usedMb).toBe(512); // usage pinned at the cap before the kill
  });
});

describe('pids.max — fork containment', () => {
  it('forks succeed up to the cap', () => {
    expect(pidsOutcome(50, 100)).toEqual({ running: 50, failedForks: 0, contained: false });
  });
  it('a fork bomb is capped and further forks fail', () => {
    const r = pidsOutcome(5000, 100);
    expect(r.running).toBe(100);
    expect(r.failedForks).toBe(4900);
    expect(r.contained).toBe(true);
  });
});
