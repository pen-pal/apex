import { describe, it, expect } from 'vitest';
import { step, coherent, type State, type Op } from '../src/web/mesi';

// Drive a sequence of (core, op) from the all-Invalid start, returning every intermediate state.
function run(n: number, ops: [number, Op][]) {
  let states: State[] = Array(n).fill('I');
  const trace = ops.map(([core, op]) => { const s = step(states, core, op); states = s.states; return s; });
  return { states, trace };
}

describe('MESI — the canonical 2-core sequence (Hennessy & Patterson)', () => {
  // P0 read, P1 read, P0 write, P1 read, P1 write — the textbook walk through all four states.
  const { trace } = run(2, [[0, 'read'], [1, 'read'], [0, 'write'], [1, 'read'], [1, 'write']]);

  it('P0 read miss with no other copy → Exclusive', () => {
    expect(trace[0].states).toEqual(['E', 'I']);
    expect(trace[0].bus).toBe('BusRd');
  });
  it('P1 read shares it → both Shared, P0 drops E→S', () => {
    expect(trace[1].states).toEqual(['S', 'S']);
    expect(trace[1].bus).toBe('BusRd');
    expect(trace[1].flush).toBe(false); // E supplies clean, no write-back
  });
  it('P0 write to a Shared line → BusUpgr, P1 invalidated, P0→M', () => {
    expect(trace[2].states).toEqual(['M', 'I']);
    expect(trace[2].bus).toBe('BusUpgr');
  });
  it('P1 read forces the M owner to flush, both → Shared', () => {
    expect(trace[3].states).toEqual(['S', 'S']);
    expect(trace[3].bus).toBe('BusRd');
    expect(trace[3].flush).toBe(true); // P0 was Modified → must write back
  });
  it('P1 write → BusUpgr, P0 invalidated, P1→M', () => {
    expect(trace[4].states).toEqual(['I', 'M']);
    expect(trace[4].bus).toBe('BusUpgr');
  });
});

describe('MESI — individual transitions', () => {
  it('write miss from Invalid issues BusRdX (read-for-ownership)', () => {
    const s = step(['I', 'I'], 0, 'write');
    expect(s.states).toEqual(['M', 'I']);
    expect(s.bus).toBe('BusRdX');
  });
  it('E→M on write is silent (no bus traffic)', () => {
    const s = step(['E', 'I'], 0, 'write');
    expect(s.states).toEqual(['M', 'I']);
    expect(s.bus).toBeNull();
    expect(s.hit).toBe(true);
  });
  it('read/write hits in M never touch the bus', () => {
    expect(step(['M', 'I'], 0, 'read').bus).toBeNull();
    expect(step(['M', 'I'], 0, 'write').bus).toBeNull();
  });
  it('a read that finds a Modified owner causes a flush', () => {
    const s = step(['M', 'I'], 1, 'read');
    expect(s.states).toEqual(['S', 'S']);
    expect(s.flush).toBe(true);
  });
  it('false sharing: a write by any core invalidates all other copies of the line', () => {
    const s = step(['S', 'S', 'S'], 1, 'write');
    expect(s.states).toEqual(['I', 'M', 'I']);
  });
});

describe('the coherence invariant holds after every step', () => {
  it('no legal sequence ever produces two owners or M+S', () => {
    expect(coherent(['M', 'S'])).toBe(false);
    expect(coherent(['E', 'E'])).toBe(false);
    expect(coherent(['M', 'I', 'I'])).toBe(true);
    expect(coherent(['S', 'S', 'S'])).toBe(true);

    // brute a deterministic mix of ops over 3 cores; the invariant must never break
    let states: State[] = ['I', 'I', 'I'];
    const script: [number, Op][] = [[0, 'read'], [1, 'write'], [2, 'read'], [0, 'write'], [1, 'read'], [2, 'write'], [0, 'read'], [0, 'write']];
    for (const [c, op] of script) {
      states = step(states, c, op).states;
      expect(coherent(states), `after core ${c} ${op}: ${states}`).toBe(true);
    }
  });
});
