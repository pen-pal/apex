import { describe, it, expect } from 'vitest';
import { spanningTree, type Link } from '../src/web/stp';

// A square loop of 4 bridges, all links cost 1:
//   1 — 2
//   |   |
//   4 — 3
// Hand-worked: root = 1 (lowest ID). dist 1:0, 2:1, 4:1, 3:2 (via either 2 or 4;
// tie broken to neighbour 2). Designated ends sit on the lower-dist side; bridge 3's
// link to 4 is neither designated nor its root port → BLOCKED, breaking the one loop.
const square: Link[] = [
  { a: 1, b: 2, cost: 1 },
  { a: 2, b: 3, cost: 1 },
  { a: 3, b: 4, cost: 1 },
  { a: 4, b: 1, cost: 1 },
];

describe('spanning tree on a square loop', () => {
  const r = spanningTree([1, 2, 3, 4], square);

  it('elects the lowest bridge ID as root', () => {
    expect(r.root).toBe(1);
  });

  it('computes shortest-path cost to the root', () => {
    expect(r.dist).toEqual({ 1: 0, 2: 1, 3: 2, 4: 1 });
  });

  it('blocks exactly one port end — enough to break the single loop', () => {
    expect(r.blocked).toBe(1);
    const blocked = r.ports.find((p) => p.role === 'blocked')!;
    expect(blocked.bridge).toBe(3); // the bridge farthest from root, on its non-root link
    expect(blocked.other).toBe(4);
  });

  it('keeps a tree: every non-root bridge has exactly one root port, the root none', () => {
    for (const b of [2, 3, 4])
      expect(r.ports.filter((p) => p.bridge === b && p.role === 'root-port')).toHaveLength(1);
    expect(r.ports.filter((p) => p.bridge === 1 && p.role === 'root-port')).toHaveLength(0);
  });

  it('the root bridge is designated on all of its ports', () => {
    expect(r.ports.filter((p) => p.bridge === 1).every((p) => p.role === 'designated')).toBe(true);
  });
});

describe('link cost steers the tree', () => {
  // Same square but the 1—2 link is expensive (cost 10): bridge 2 now reaches root
  // cheaper through 3→4→1 (cost 3) than directly (10), so its root port flips.
  const weighted: Link[] = [
    { a: 1, b: 2, cost: 10 },
    { a: 2, b: 3, cost: 1 },
    { a: 3, b: 4, cost: 1 },
    { a: 4, b: 1, cost: 1 },
  ];
  const r = spanningTree([1, 2, 3, 4], weighted);

  it('routes around the costly link', () => {
    expect(r.dist).toEqual({ 1: 0, 2: 3, 3: 2, 4: 1 });
    const rp2 = r.ports.find((p) => p.bridge === 2 && p.role === 'root-port')!;
    expect(rp2.other).toBe(3); // toward 3, not the expensive direct link to 1
  });

  it('still blocks exactly one port to leave a loop-free tree', () => {
    expect(r.blocked).toBe(1);
  });
});
