import { describe, it, expect } from 'vitest';
import { weightOf, NICE_0_WEIGHT, leftmost, tick, run, initCfs, type Task } from '../src/web/cfs';

describe('the nice→weight table matches the kernel sched_prio_to_weight[]', () => {
  it('nice 0 is 1024, and the table steps ~1.25× per level', () => {
    expect(weightOf(0)).toBe(NICE_0_WEIGHT);
    expect(weightOf(0)).toBe(1024);
    expect(weightOf(1)).toBe(820);   // 1024 / 1.25
    expect(weightOf(5)).toBe(335);
    expect(weightOf(-5)).toBe(3121);
  });
  it('clamps out-of-range nice values to the table bounds', () => {
    expect(weightOf(-20)).toBe(weightOf(-5));
    expect(weightOf(19)).toBe(weightOf(5));
  });
});

describe('CFS always runs the smallest-vruntime task', () => {
  const tasks: Task[] = [{ id: 'A', nice: 0 }, { id: 'B', nice: 0 }];
  it('picks the leftmost (min vruntime), advancing it so the other runs next', () => {
    let st = initCfs(tasks);
    expect(leftmost(tasks, st)).toBe('A');       // tie → lexicographic
    st = tick(tasks, st, 4).state;
    expect(leftmost(tasks, st)).toBe('B');       // A advanced, so B is now behind
  });
  it('a niced-down task’s vruntime advances faster for the same real time', () => {
    const t2: Task[] = [{ id: 'hi', nice: -5 }, { id: 'lo', nice: 5 }];
    let st = initCfs(t2);
    const a = tick(t2, st, 10).pick.vrAfter; // hi: 10*1024/3121 ≈ 3.28
    const b = tick([{ id: 'lo', nice: 5 }], initCfs([{ id: 'lo', nice: 5 }]), 10).pick.vrAfter; // lo: 10*1024/335 ≈ 30.6
    expect(b).toBeGreaterThan(a * 5);
  });
});

describe('long-run CPU share is proportional to weight (the fairness guarantee)', () => {
  it('two equal-nice tasks split the CPU 50/50', () => {
    const r = run([{ id: 'A', nice: 0 }, { id: 'B', nice: 0 }], 4, 1000);
    expect(r.share['A']).toBeCloseTo(0.5, 2);
  });

  it('nice 0 vs nice 5 converges to the weight ratio 1024:335', () => {
    const r = run([{ id: 'fat', nice: 0 }, { id: 'thin', nice: 5 }], 3, 4000);
    expect(r.share['fat']).toBeCloseTo(r.ideal['fat'], 2);   // ≈ 0.753
    expect(r.share['thin']).toBeCloseTo(r.ideal['thin'], 2); // ≈ 0.247
    expect(r.share['fat']).toBeGreaterThan(r.share['thin']);
  });

  it('three tasks each get CPU close to their weight fraction', () => {
    const r = run([{ id: 'p', nice: -3 }, { id: 'q', nice: 0 }, { id: 'r', nice: 3 }], 2, 6000);
    for (const id of ['p', 'q', 'r']) expect(r.share[id]).toBeCloseTo(r.ideal[id], 2);
  });
});
