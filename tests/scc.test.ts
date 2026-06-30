import { describe, it, expect } from 'vitest';
import { kosaraju, isDag, nodesOf, type DiEdge } from '../src/web/scc';

// CLRS Figure 22.9 digraph. SCCs: {a,b,e}, {c,d}, {f,g}, {h}.
const G: DiEdge[] = [
  { from: 'a', to: 'b' }, { from: 'b', to: 'c' }, { from: 'b', to: 'e' }, { from: 'b', to: 'f' },
  { from: 'c', to: 'd' }, { from: 'c', to: 'g' }, { from: 'd', to: 'c' }, { from: 'd', to: 'h' },
  { from: 'e', to: 'a' }, { from: 'e', to: 'f' }, { from: 'f', to: 'g' }, { from: 'g', to: 'f' },
];

describe('Kosaraju on the CLRS example', () => {
  const r = kosaraju(G, ['h']);
  const comp = (n: string) => r.compOf[n];

  it('finds exactly four strongly connected components', () => {
    expect(r.components).toHaveLength(4);
  });
  it('groups mutually reachable nodes and separates the rest', () => {
    expect(comp('a')).toBe(comp('b'));
    expect(comp('a')).toBe(comp('e'));   // a→b→e→a
    expect(comp('c')).toBe(comp('d'));   // c→d→c
    expect(comp('f')).toBe(comp('g'));   // f→g→f
    expect(comp('a')).not.toBe(comp('c'));
    expect(comp('c')).not.toBe(comp('f'));
    expect(comp('h')).not.toBe(comp('f')); // h is its own component
  });
  it('the components partition every vertex exactly once', () => {
    const all = r.components.flat().sort();
    expect(all).toEqual(nodesOf(G));
    expect(new Set(all).size).toBe(all.length);
  });
  it('the condensation is a DAG (the SCC theorem)', () => {
    expect(isDag(r)).toBe(true);
  });
});

describe('edge cases', () => {
  it('a simple cycle is one component', () => {
    const cyc: DiEdge[] = [{ from: 'x', to: 'y' }, { from: 'y', to: 'z' }, { from: 'z', to: 'x' }];
    const r = kosaraju(cyc);
    expect(r.components).toHaveLength(1);
    expect(r.components[0]).toEqual(['x', 'y', 'z']);
  });
  it('a DAG has every node as its own component, and stays a DAG', () => {
    const dag: DiEdge[] = [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }, { from: 'a', to: 'c' }];
    const r = kosaraju(dag);
    expect(r.components).toHaveLength(3);
    expect(isDag(r)).toBe(true);
  });
  it('two disjoint cycles give two components with no condensation edges', () => {
    const r = kosaraju([{ from: 'a', to: 'b' }, { from: 'b', to: 'a' }, { from: 'c', to: 'd' }, { from: 'd', to: 'c' }]);
    expect(r.components).toHaveLength(2);
    expect(r.condensation).toHaveLength(0);
  });
});
