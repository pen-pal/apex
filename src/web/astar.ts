// A* pathfinding (Hart, Nilsson & Raphael, 1968) — find the shortest path on a grid while
// exploring far fewer cells than a blind search, by letting a HEURISTIC pull the frontier
// toward the goal. Each candidate cell is scored f = g + h: g is the known cost to reach it
// from the start, h is an estimate of the remaining cost to the goal (here Manhattan
// distance). A* always expands the lowest-f cell next, so it heads straight for the goal but
// detours around walls only as much as it must. Because the heuristic never overestimates
// (it's "admissible"), the path it finds is guaranteed optimal — the same as Dijkstra, but
// with the search focused. Pure; tested against BFS for optimality.

export type Cell = [number, number];
const key = (x: number, y: number) => `${x},${y}`;
const manhattan = (a: Cell, b: Cell) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);

export interface Grid { w: number; h: number; walls: Set<string> }
export interface Result { path: Cell[] | null; expanded: Cell[]; cost: number }

function neighbors(g: Grid, [x, y]: Cell): Cell[] {
  const out: Cell[] = [];
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = x + dx, ny = y + dy;
    if (nx >= 0 && nx < g.w && ny >= 0 && ny < g.h && !g.walls.has(key(nx, ny))) out.push([nx, ny]);
  }
  return out;
}

function reconstruct(came: Map<string, Cell>, goal: Cell): Cell[] {
  const path: Cell[] = [goal];
  let cur = goal;
  while (came.has(key(cur[0], cur[1]))) { cur = came.get(key(cur[0], cur[1]))!; path.push(cur); }
  return path.reverse();
}

export function astar(g: Grid, start: Cell, goal: Cell): Result {
  const gScore = new Map<string, number>([[key(...start), 0]]);
  const came = new Map<string, Cell>();
  const open: Cell[] = [start];
  const expanded: Cell[] = [];
  const closed = new Set<string>();

  while (open.length) {
    // pick the lowest f = g + h (tie-break by smaller h, then insertion order)
    let bi = 0;
    const f = (c: Cell) => (gScore.get(key(...c)) ?? Infinity) + manhattan(c, goal);
    for (let i = 1; i < open.length; i++) if (f(open[i]) < f(open[bi]) || (f(open[i]) === f(open[bi]) && manhattan(open[i], goal) < manhattan(open[bi], goal))) bi = i;
    const cur = open.splice(bi, 1)[0];
    const ck = key(...cur);
    if (closed.has(ck)) continue;
    closed.add(ck);
    expanded.push(cur);
    if (cur[0] === goal[0] && cur[1] === goal[1]) return { path: reconstruct(came, goal), expanded, cost: gScore.get(ck)! };
    for (const nb of neighbors(g, cur)) {
      const tentative = gScore.get(ck)! + 1;
      if (tentative < (gScore.get(key(...nb)) ?? Infinity)) { came.set(key(...nb), cur); gScore.set(key(...nb), tentative); open.push(nb); }
    }
  }
  return { path: null, expanded, cost: Infinity };
}

/** Breadth-first search (no heuristic) — the optimality/expansion baseline. */
export function bfs(g: Grid, start: Cell, goal: Cell): Result {
  const came = new Map<string, Cell>();
  const seen = new Set<string>([key(...start)]);
  const queue: Cell[] = [start];
  const expanded: Cell[] = [];
  while (queue.length) {
    const cur = queue.shift()!;
    expanded.push(cur);
    if (cur[0] === goal[0] && cur[1] === goal[1]) { const path = reconstruct(came, goal); return { path, expanded, cost: path.length - 1 }; }
    for (const nb of neighbors(g, cur)) if (!seen.has(key(...nb))) { seen.add(key(...nb)); came.set(key(...nb), cur); queue.push(nb); }
  }
  return { path: null, expanded, cost: Infinity };
}
