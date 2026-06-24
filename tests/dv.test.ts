import { describe, it, expect } from 'vitest';
import { run, brokenLinkTimeline, initTables, neighborsOf, INF, type Edge } from '../src/web/dv';

const NODES = ['A', 'B', 'C', 'D'];
const EDGES: Edge[] = [ // a line A—B—C—D, unit costs
  { a: 'A', b: 'B', cost: 1 },
  { a: 'B', b: 'C', cost: 1 },
  { a: 'C', b: 'D', cost: 1 },
];

describe('distance-vector convergence', () => {
  it('the line converges to hop-count distances', () => {
    const final = run(NODES, EDGES, false).pop()!;
    expect(final['D']['A'].cost).toBe(3); // D→A is 3 hops
    expect(final['A']['D'].cost).toBe(3);
    expect(final['B']['A'].via).toBe('A'); // B reaches A directly
    expect(final['C']['A'].via).toBe('B'); // C reaches A via B
  });

  it('neighbours are read symmetrically from undirected edges', () => {
    expect(neighborsOf('B', EDGES).map((n) => n.node).sort()).toEqual(['A', 'C']);
    expect(initTables(NODES, EDGES)['A']['A'].cost).toBe(0);
  });
});

describe('count-to-infinity when A—B breaks', () => {
  it('without split horizon the cost to A crawls up to infinity over many rounds', () => {
    const { timeline } = brokenLinkTimeline(NODES, EDGES, ['A', 'B'], false);
    const bToA = timeline.map((t) => t['B']['A'].cost);
    // it does NOT jump straight to INF — it climbs (the bad news travels slowly)
    expect(Math.max(...bToA.slice(0, -1).filter((c) => c < INF))).toBeGreaterThan(3);
    expect(timeline[timeline.length - 1]['B']['A'].cost).toBe(INF); // ends unreachable
    expect(timeline.length).toBeGreaterThan(5); // took many rounds
  });

  it('split horizon / poison reverse converges fast to unreachable', () => {
    const { timeline } = brokenLinkTimeline(NODES, EDGES, ['A', 'B'], true);
    expect(timeline[timeline.length - 1]['B']['A'].cost).toBe(INF);
    expect(timeline[timeline.length - 1]['C']['A'].cost).toBe(INF);
  });

  it('split horizon reconverges in fewer rounds than plain DV', () => {
    const slow = brokenLinkTimeline(NODES, EDGES, ['A', 'B'], false).timeline.length;
    const fast = brokenLinkTimeline(NODES, EDGES, ['A', 'B'], true).timeline.length;
    expect(fast).toBeLessThan(slow);
  });
});
