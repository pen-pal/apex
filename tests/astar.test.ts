import { describe, it, expect } from 'vitest';
import { astar, bfs, type Grid } from '../src/web/astar';

const empty = (w: number, h: number): Grid => ({ w, h, walls: new Set() });

describe('A* on an open grid', () => {
  it('finds a path of Manhattan length on an empty grid', () => {
    const g = empty(6, 6);
    const r = astar(g, [0, 0], [5, 5]);
    expect(r.path).not.toBeNull();
    expect(r.cost).toBe(10);             // |5-0|+|5-0|
    expect(r.path![0]).toEqual([0, 0]);
    expect(r.path![r.path!.length - 1]).toEqual([5, 5]);
  });

  it('the path is contiguous (each step moves one cell)', () => {
    const r = astar(empty(8, 8), [0, 0], [7, 3]);
    for (let i = 1; i < r.path!.length; i++) {
      const [x1, y1] = r.path![i - 1], [x2, y2] = r.path![i];
      expect(Math.abs(x1 - x2) + Math.abs(y1 - y2)).toBe(1);
    }
  });
});

describe('A* matches BFS optimal cost but expands no more cells', () => {
  it('same cost as BFS, with heuristic focusing the search', () => {
    const g: Grid = { w: 10, h: 10, walls: new Set(['3,0', '3,1', '3,2', '3,3', '3,4']) }; // a wall to route around
    const a = astar(g, [0, 2], [9, 2]);
    const b = bfs(g, [0, 2], [9, 2]);
    expect(a.cost).toBe(b.cost);                       // same optimal length
    expect(a.expanded.length).toBeLessThanOrEqual(b.expanded.length); // A* never explores more
  });

  it('on a big open grid A* expands far fewer cells than BFS', () => {
    const g = empty(15, 15);
    const a = astar(g, [0, 0], [14, 14]);
    const b = bfs(g, [0, 0], [14, 14]);
    expect(a.cost).toBe(b.cost);
    expect(a.expanded.length).toBeLessThan(b.expanded.length);
  });
});

describe('walls and impossibility', () => {
  it('routes around a wall, lengthening the path', () => {
    const g: Grid = { w: 5, h: 5, walls: new Set(['2,0', '2,1', '2,2', '2,3']) }; // wall with a gap at y=4
    const r = astar(g, [0, 0], [4, 0]);
    expect(r.path).not.toBeNull();
    expect(r.cost).toBeGreaterThan(4); // can't go straight; must detour down and back up
  });

  it('returns no path when the goal is walled off', () => {
    const walls = new Set<string>(['1,0', '0,1', '1,1']); // box the start into the corner
    const r = astar({ w: 5, h: 5, walls }, [0, 0], [4, 4]);
    expect(r.path).toBeNull();
    expect(r.cost).toBe(Infinity);
  });
});
