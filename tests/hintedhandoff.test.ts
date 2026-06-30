import { describe, it, expect } from 'vitest';
import { write, recover, type Node } from '../src/web/hintedhandoff';

const ring = (downIds: string[] = []): Node[] =>
  ['A', 'B', 'C', 'D', 'E'].map((id) => ({ id, up: !downIds.includes(id) }));

describe('hinted handoff — sloppy quorum keeps writes available', () => {
  it('all replicas up → N normal replicas, no hints', () => {
    const r = write('k', 'v', ring(), 3, 2);
    expect(r.placements).toEqual([
      { node: 'A', role: 'replica' }, { node: 'B', role: 'replica' }, { node: 'C', role: 'replica' },
    ]);
    expect(r.hints).toEqual([]);
    expect(r.acks).toBe(3);
    expect(r.satisfied).toBe(true);
  });

  it('a down home replica is handed off to the next healthy node', () => {
    const r = write('k', 'v', ring(['B']), 3, 2);
    // A, C store normally; D takes a hint for B
    expect(r.placements).toEqual([
      { node: 'A', role: 'replica' }, { node: 'C', role: 'replica' }, { node: 'D', role: 'hint', for: 'B' },
    ]);
    expect(r.hints).toEqual([{ key: 'k', value: 'v', intendedFor: 'B', storedOn: 'D' }]);
    expect(r.acks).toBe(3);
    expect(r.durableHome).toBe(2);
    expect(r.satisfied).toBe(true); // sloppy quorum: hint counts toward W
  });

  it('two down home replicas → two hints on the next two fallbacks', () => {
    const r = write('k', 'v', ring(['B', 'C']), 3, 2);
    expect(r.placements).toEqual([
      { node: 'A', role: 'replica' }, { node: 'D', role: 'hint', for: 'B' }, { node: 'E', role: 'hint', for: 'C' },
    ]);
    expect(r.acks).toBe(3);
    expect(r.satisfied).toBe(true);
  });

  it('when fallbacks run out, acks fall short and the quorum can fail', () => {
    // A,B,C down; only D,E healthy → hints for A and B, none left for C
    const r = write('k', 'v', ring(['A', 'B', 'C']), 3, 2);
    expect(r.acks).toBe(2); // D (for A), E (for B)
    expect(r.hints.map((h) => h.intendedFor)).toEqual(['A', 'B']);
    expect(r.satisfied).toBe(true);  // W=2 still met
    expect(write('k', 'v', ring(['A', 'B', 'C']), 3, 3).satisfied).toBe(false); // W=3 cannot be met
  });

  it('durable-home count reflects how many true replicas got it', () => {
    expect(write('k', 'v', ring(['A', 'B']), 3, 2).durableHome).toBe(1); // only C is a healthy home replica
  });
});

describe('recovery replays the hints', () => {
  it('a recovered node gets exactly the hints addressed to it', () => {
    const r = write('k', 'v', ring(['B', 'C']), 3, 2);
    const { replayed, remaining } = recover('B', r.hints);
    expect(replayed).toEqual([{ key: 'k', value: 'v', intendedFor: 'B', storedOn: 'D' }]);
    expect(remaining.map((h) => h.intendedFor)).toEqual(['C']); // C's hint still parked on E
  });
  it('recovering a node with no hints is a no-op', () => {
    const r = write('k', 'v', ring(['B']), 3, 2);
    expect(recover('A', r.hints).replayed).toEqual([]);
  });
});
