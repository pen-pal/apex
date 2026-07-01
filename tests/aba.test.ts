import { describe, it, expect } from 'vitest';
import { runScenario } from '../src/web/aba';

describe('a plain CAS is fooled by A → B → A', () => {
  const r = runScenario(false);
  it("T1's stale CAS succeeds even though the stack changed underneath", () => {
    expect(r.t1CasSucceeded).toBe(true);
    expect(r.corrupted).toBe(true);
    expect(r.finalTop).toBe('B');   // top now points at an already-freed node
  });
  it('T2 performed three mutations that returned the pointer to A', () => {
    // events: T1 read (v0), T2 pop A (v1), T2 pop B (v2), T2 push A (v3), T1 CAS
    expect(r.events[0]).toMatchObject({ actor: 'T1', top: 'A', version: 0 });
    expect(r.events[3]).toMatchObject({ actor: 'T2', top: 'A', version: 3 }); // back to A, but version moved
  });
});

describe('a versioned (tagged) CAS catches the change', () => {
  const r = runScenario(true);
  it("T1's CAS fails because the version moved, so it retries — no corruption", () => {
    expect(r.t1CasSucceeded).toBe(false);
    expect(r.corrupted).toBe(false);
    expect(r.finalTop).toBe('A');   // left as T2 left it; T1 will re-read and retry correctly
  });
});

describe('the difference is exactly the version check', () => {
  it('both see top === A at CAS time; only the tagged one also sees the version differ', () => {
    const naive = runScenario(false), tagged = runScenario(true);
    // same interleaving, opposite outcome
    expect(naive.t1CasSucceeded).not.toBe(tagged.t1CasSucceeded);
    expect(naive.corrupted).toBe(true);
    expect(tagged.corrupted).toBe(false);
  });
});
