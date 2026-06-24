import { describe, it, expect } from 'vitest';
import { create, responsible, nextNode, fingerTable, lookup } from '../src/web/chord';

// The classic Chord paper example: m=3 (ring of 8), nodes {0, 1, 3}.
const ring = create(3, [0, 1, 3]);

describe('successor / responsibility', () => {
  it('a key is owned by the first node clockwise', () => {
    expect(responsible(ring, 0)).toBe(0);
    expect(responsible(ring, 1)).toBe(1);
    expect(responsible(ring, 2)).toBe(3); // 2 → 3
    expect(responsible(ring, 4)).toBe(0); // wraps past the top → 0
    expect(responsible(ring, 6)).toBe(0);
  });

  it('next-node pointers form the ring', () => {
    expect(nextNode(ring, 0)).toBe(1);
    expect(nextNode(ring, 1)).toBe(3);
    expect(nextNode(ring, 3)).toBe(0); // wraps
  });
});

describe('finger tables (the O(log n) shortcuts)', () => {
  it('node 0: successors of 1, 2, 4', () => {
    expect(fingerTable(ring, 0).map((f) => f.node)).toEqual([1, 3, 0]);
  });
  it('node 1: successors of 2, 3, 5', () => {
    expect(fingerTable(ring, 1).map((f) => f.node)).toEqual([3, 3, 0]);
  });
  it('node 3: successors of 4, 5, 7', () => {
    expect(fingerTable(ring, 3).map((f) => f.node)).toEqual([0, 0, 0]);
  });
});

describe('lookup routing', () => {
  it('finds the owner of a key and records the hops', () => {
    const r = lookup(ring, 0, 6); // who owns key 6, starting at node 0?
    expect(r.target).toBe(0);     // responsible(6) = 0
    expect(r.hops[0]).toBe(0);
    expect(r.hops.length).toBeLessThanOrEqual(ring.m + 1); // O(log n) hops
  });

  it('lookups from any start reach the same owner', () => {
    for (const start of [0, 1, 3])
      for (const key of [0, 1, 2, 4, 5, 6, 7])
        expect(lookup(ring, start, key).target).toBe(responsible(ring, key));
  });

  it('uses finger shortcuts rather than walking node-by-node', () => {
    const big = create(6, [0, 8, 16, 24, 32, 40, 48, 56]); // 8 nodes on a 64-ring
    const r = lookup(big, 0, 50); // owner is 56
    expect(r.target).toBe(56);
    expect(r.hops.length).toBeLessThan(big.nodes.length); // fewer hops than nodes
  });
});
