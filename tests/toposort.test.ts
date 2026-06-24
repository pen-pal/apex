import { describe, it, expect } from 'vitest';
import { topoSort, isValidOrder, type Graph } from '../src/web/toposort';

// A classic DAG (Wikipedia's Kahn example, relabeled): edges point "must come before".
const dag: Graph = {
  nodes: ['2', '3', '5', '7', '8', '9', '10', '11'],
  edges: [['5', '11'], ['7', '11'], ['7', '8'], ['3', '8'], ['3', '10'], ['11', '2'], ['11', '9'], ['11', '10'], ['8', '9']],
};

describe('topological sort of a DAG', () => {
  const r = topoSort(dag);
  it('produces an ordering with no cycle', () => {
    expect(r.hasCycle).toBe(false);
    expect(r.order).not.toBeNull();
    expect(r.order!.length).toBe(dag.nodes.length); // all nodes included
  });
  it('every edge points forward in the order', () => {
    expect(isValidOrder(dag, r.order!)).toBe(true);
  });
  it('is deterministic (alphabetical tie-break)', () => {
    // ready-0 nodes are 3,5,7; smallest first → 3, then its effects, etc.
    expect(r.order![0]).toBe('3');
    expect(topoSort(dag).order).toEqual(r.order); // stable across runs
  });
});

describe('a simple chain and a diamond', () => {
  it('orders a chain a→b→c→d', () => {
    expect(topoSort({ nodes: ['a', 'b', 'c', 'd'], edges: [['a', 'b'], ['b', 'c'], ['c', 'd']] }).order).toEqual(['a', 'b', 'c', 'd']);
  });
  it('respects both paths of a diamond', () => {
    const g: Graph = { nodes: ['a', 'b', 'c', 'd'], edges: [['a', 'b'], ['a', 'c'], ['b', 'd'], ['c', 'd']] };
    const r = topoSort(g);
    expect(isValidOrder(g, r.order!)).toBe(true);
    expect(r.order![0]).toBe('a');
    expect(r.order![3]).toBe('d');
  });
});

describe('cycle detection', () => {
  it('reports a cycle and returns no order', () => {
    const r = topoSort({ nodes: ['a', 'b', 'c'], edges: [['a', 'b'], ['b', 'c'], ['c', 'a']] });
    expect(r.hasCycle).toBe(true);
    expect(r.order).toBeNull();
    expect(new Set(r.cycleNodes)).toEqual(new Set(['a', 'b', 'c']));
  });
  it('a partial cycle leaves the acyclic prefix orderable but still flags the cycle', () => {
    const r = topoSort({ nodes: ['x', 'a', 'b'], edges: [['x', 'a'], ['a', 'b'], ['b', 'a']] }); // a↔b cycle
    expect(r.hasCycle).toBe(true);
    expect(r.cycleNodes).toContain('a');
    expect(r.cycleNodes).toContain('b');
  });
});
