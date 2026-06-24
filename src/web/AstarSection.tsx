// A* pathfinding, made visible. A grid you paint walls onto; A* and BFS run on it and you
// can see the difference — A*'s heuristic focuses its expansion toward the goal, BFS floods
// outward in all directions, yet both find the same shortest path. The expanded cells and
// the final path are drawn. Real algorithms in astar.ts (tested for optimality vs BFS).
import { useMemo, useState } from 'react';
import { astar, bfs, type Grid, type Cell } from './astar';

const W = 16, H = 11;
const START: Cell = [1, 5], GOAL: Cell = [14, 5];
const k = (x: number, y: number) => `${x},${y}`;
const INIT_WALLS = ['7,2', '7,3', '7,4', '7,5', '7,6', '7,7', '7,8', '10,0', '10,1', '10,2', '10,3', '10,4', '10,5', '10,6'];

export function AstarSection() {
  const [walls, setWalls] = useState<Set<string>>(new Set(INIT_WALLS));
  const [algo, setAlgo] = useState<'astar' | 'bfs'>('astar');
  const grid: Grid = useMemo(() => ({ w: W, h: H, walls }), [walls]);

  const aRes = useMemo(() => astar(grid, START, GOAL), [grid]);
  const bRes = useMemo(() => bfs(grid, START, GOAL), [grid]);
  const res = algo === 'astar' ? aRes : bRes;

  const expandedSet = new Set(res.expanded.map(([x, y]) => k(x, y)));
  const pathSet = new Set((res.path ?? []).map(([x, y]) => k(x, y)));

  const toggleWall = (x: number, y: number) => {
    if ((x === START[0] && y === START[1]) || (x === GOAL[0] && y === GOAL[1])) return;
    setWalls((w) => { const n = new Set(w); const kk = k(x, y); n.has(kk) ? n.delete(kk) : n.add(kk); return n; });
  };

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>A* — shortest path, but pointed at the goal</h2></div>
        <p className="jsec-sub">
          A* scores each cell <code>f = g + h</code>: <strong>g</strong> is the cost to reach it, <strong>h</strong> is a guess of the
          distance left (Manhattan, here). It always expands the lowest-f cell, so the search leans toward the goal instead of flooding
          everywhere — yet because the guess never overestimates, the path it returns is still the shortest. Compare it with goal-blind
          BFS. Click cells to add or remove walls.
        </p>

        <div className="pf-toggle">
          <button className={algo === 'astar' ? 'on' : ''} onClick={() => setAlgo('astar')}>A* (heuristic)</button>
          <button className={algo === 'bfs' ? 'on' : ''} onClick={() => setAlgo('bfs')}>BFS (blind)</button>
          <button onClick={() => setWalls(new Set())} className="pf-clear">clear walls</button>
        </div>

        <div className="pf-grid" style={{ gridTemplateColumns: `repeat(${W}, 1fr)` }}>
          {Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => {
            const kk = k(x, y);
            const isStart = x === START[0] && y === START[1], isGoal = x === GOAL[0] && y === GOAL[1];
            const cls = walls.has(kk) ? 'wall' : isStart ? 'start' : isGoal ? 'goal' : pathSet.has(kk) ? 'path' : expandedSet.has(kk) ? 'exp' : '';
            return <div key={kk} className={`pf-cell ${cls}`} onMouseDown={() => toggleWall(x, y)}>{isStart ? '◉' : isGoal ? '★' : ''}</div>;
          }))}
        </div>

        <div className="pf-stats">
          <span>{algo === 'astar' ? 'A*' : 'BFS'} explored <b>{res.expanded.length}</b> cells</span>
          <span>path length <b>{res.path ? res.cost : '—'}</b></span>
          <span className="pf-cmp">A* {aRes.expanded.length} vs BFS {bRes.expanded.length} cells explored {aRes.path ? `· same ${aRes.cost}-step path` : ''}</span>
        </div>

        <p className="pf-foot">
          Both find the same optimal length — the heuristic doesn’t change the answer, only how much of the grid gets touched to find it.
          With <code>h = 0</code>, A* degenerates into Dijkstra (the routing section runs Dijkstra over a network graph). A heuristic that
          <em> over</em>estimates can be faster but may miss the optimum (inadmissible); weighting h trades optimality for speed. A* is the
          backbone of game-AI navigation, robot motion planning, and GPS routing (where the “as-the-crow-flies” distance is the heuristic).
        </p>
      </section>
    </div>
  );
}
