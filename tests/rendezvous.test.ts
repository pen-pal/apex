import { describe, it, expect } from 'vitest';
import { assign, ranking, distribution, moved, weight } from '../src/web/rendezvous';

const keys = Array.from({ length: 12000 }, (_, i) => 'key-' + i);
const nodes = ['n0', 'n1', 'n2', 'n3', 'n4'];

describe('assignment', () => {
  it('assigns each key to its highest-weight node, deterministically', () => {
    for (const k of ['a', 'b', 'key-7', 'xyz']) {
      const best = nodes.reduce((m, n) => (weight(k, n) > weight(k, m) ? n : m), nodes[0]);
      expect(assign(k, nodes)).toBe(best);
      expect(assign(k, nodes)).toBe(assign(k, nodes)); // stable
    }
  });
  it('ranking is the full preference list, and its head is the assignment', () => {
    const r = ranking('key-7', nodes);
    expect(r).toHaveLength(nodes.length);
    expect(new Set(r)).toEqual(new Set(nodes));                 // a permutation
    expect(r[0]).toBe(assign('key-7', nodes));                  // top = owner
    for (let i = 1; i < r.length; i++) expect(weight('key-7', r[i - 1])).toBeGreaterThanOrEqual(weight('key-7', r[i]));
  });
});

describe('keys spread evenly across nodes', () => {
  it('each node gets roughly keys/N (within 10%)', () => {
    const d = distribution(keys, nodes);
    const ideal = keys.length / nodes.length;
    for (const n of nodes) expect(Math.abs(d[n] - ideal)).toBeLessThan(ideal * 0.1);
    expect(Object.values(d).reduce((a, b) => a + b, 0)).toBe(keys.length); // all placed
  });
});

describe('minimal disruption — the whole point', () => {
  it('removing a node moves ONLY that node’s keys, nothing else', () => {
    const after = ['n0', 'n1', 'n2', 'n3'];               // n4 removed
    const mv = moved(keys, nodes, after);
    const owned = keys.filter((k) => assign(k, nodes) === 'n4');
    expect(mv.length).toBe(owned.length);                 // exactly the orphaned keys
    expect(mv.every((k) => assign(k, nodes) === 'n4')).toBe(true);
    // every key NOT on n4 stays put
    expect(keys.filter((k) => assign(k, nodes) !== 'n4').every((k) => assign(k, nodes) === assign(k, after))).toBe(true);
  });
  it('adding a node pulls only keys that now prefer it — none shuffle between existing nodes', () => {
    const after = [...nodes, 'n5'];
    const mv = moved(keys, nodes, after);
    expect(mv.length).toBeLessThan(keys.length * 0.25);   // ~1/6
    expect(mv.every((k) => assign(k, after) === 'n5')).toBe(true); // all moved keys go TO the newcomer
  });
});
