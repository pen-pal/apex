import { describe, it, expect } from 'vitest';
import { HashRing, hashRing, moduloAssign, movedKeys, RING } from '../src/web/consistenthash';

const keys = Array.from({ length: 500 }, (_, i) => `key-${i}`);

describe('hashRing', () => {
  it('is deterministic and within the ring', () => {
    expect(hashRing('abc')).toBe(hashRing('abc'));
    expect(hashRing('abc')).toBeGreaterThanOrEqual(0);
    expect(hashRing('abc')).toBeLessThan(RING);
  });
  it('matches the published FNV-1a 32-bit vectors (mod RING), not just the impl', () => {
    // FNV-1a: 'abc' → 0x1a47e90b, 'a' → 0xe40c292c; reduced mod RING (65536)
    expect(RING).toBe(65536);
    expect(hashRing('abc')).toBe(0x1a47e90b % RING); // 59659
    expect(hashRing('a')).toBe(0xe40c292c % RING); // 10540
  });
});

describe('HashRing placement and lookup', () => {
  it('assigns every key to one of the live nodes', () => {
    const ring = new HashRing(50);
    ['A', 'B', 'C'].forEach((n) => ring.addNode(n));
    const dist = ring.distribution(keys);
    expect(Object.values(dist).every((n) => ['A', 'B', 'C'].includes(n))).toBe(true);
  });
  it('returns null with no nodes, and wraps clockwise past the top', () => {
    const ring = new HashRing(1);
    expect(ring.lookup('anything')).toBeNull();
    ring.addNode('only');
    expect(ring.lookup('anything')).toBe('only'); // single node owns the whole ring
  });
  it('is stable: the same key maps to the same node across calls', () => {
    const ring = new HashRing(40);
    ['A', 'B', 'C'].forEach((n) => ring.addNode(n));
    expect(ring.lookup('key-7')).toBe(ring.lookup('key-7'));
  });
});

describe('the minimal-remap property (the whole point)', () => {
  it('adding a node moves FAR fewer keys than naive modulo-N', () => {
    const ring = new HashRing(80);
    const nodes = ['A', 'B', 'C', 'D'];
    nodes.forEach((n) => ring.addNode(n));
    const before = ring.distribution(keys);
    ring.addNode('E'); // 4 → 5 nodes
    const after = ring.distribution(keys);

    const consistentMoved = movedKeys(before, after);

    // naive modulo over the same node-set change
    const modBefore = Object.fromEntries(keys.map((k) => [k, moduloAssign(k, nodes)]));
    const modAfter = Object.fromEntries(keys.map((k) => [k, moduloAssign(k, [...nodes, 'E'])]));
    const moduloMoved = movedKeys(modBefore, modAfter);

    // consistent hashing should move roughly 1/5 of keys; modulo reshuffles most of them
    expect(consistentMoved).toBeLessThan(keys.length * 0.45);
    expect(consistentMoved).toBeLessThan(moduloMoved); // strictly better
    expect(moduloMoved).toBeGreaterThan(keys.length * 0.5); // mod-N is a near-total reshuffle
  });

  it('removing a node only moves that node’s keys (to other live nodes)', () => {
    const ring = new HashRing(80);
    ['A', 'B', 'C', 'D'].forEach((n) => ring.addNode(n));
    const before = ring.distribution(keys);
    const onC = keys.filter((k) => before[k] === 'C');
    ring.removeNode('C');
    const after = ring.distribution(keys);

    // every key NOT on C stays put; every key on C moves to a surviving node
    for (const k of keys) {
      if (before[k] === 'C') { expect(after[k]).not.toBe('C'); }
      else { expect(after[k]).toBe(before[k]); }
    }
    expect(movedKeys(before, after)).toBe(onC.length);
  });
});
