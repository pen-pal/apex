// Distance-vector routing (Bellman–Ford, as in RIP) — and its famous failure,
// count-to-infinity. Each router knows only its neighbours and the distance
// vectors they advertise; it picks D(x,y) = min over neighbours v of c(x,v) +
// D(v,y). It converges by gossip — but when a link dies, stale "I can still reach
// it" advertisements bounce between routers and the cost crawls upward one hop at a
// time. RIP caps the climb at 16 = unreachable; split-horizon/poison-reverse stops
// it outright. Pure, synchronous, deterministic model (tested).

export const INF = 16; // RIP's "infinity"
export interface Edge { a: string; b: string; cost: number }
export interface Route { cost: number; via: string | null }
export type Tables = Record<string, Record<string, Route>>;

export function neighborsOf(node: string, edges: Edge[]): { node: string; cost: number }[] {
  const out: { node: string; cost: number }[] = [];
  for (const e of edges) {
    if (e.a === node) out.push({ node: e.b, cost: e.cost });
    else if (e.b === node) out.push({ node: e.a, cost: e.cost });
  }
  return out;
}

export function initTables(nodes: string[], edges: Edge[]): Tables {
  const t: Tables = {};
  for (const x of nodes) {
    t[x] = {};
    for (const y of nodes) t[x][y] = x === y ? { cost: 0, via: null } : { cost: INF, via: null };
    for (const nb of neighborsOf(x, edges)) t[x][nb.node] = { cost: nb.cost, via: nb.node };
  }
  return t;
}

/** One synchronous round: every node recomputes from its neighbours' last tables. */
export function step(prev: Tables, nodes: string[], edges: Edge[], splitHorizon: boolean): Tables {
  const next: Tables = {};
  for (const x of nodes) {
    next[x] = {};
    const nbrs = neighborsOf(x, edges);
    for (const y of nodes) {
      if (x === y) { next[x][y] = { cost: 0, via: null }; continue; }
      let best = INF, via: string | null = null;
      for (const { node: v, cost: cxv } of nbrs) {
        let adv = prev[v][y].cost;
        if (splitHorizon && prev[v][y].via === x) adv = INF; // poison reverse: don't advertise a route back to its own next hop
        const c = Math.min(INF, cxv + adv);
        if (c < best) { best = c; via = v; }
      }
      next[x][y] = { cost: best, via };
    }
  }
  return next;
}

const same = (a: Tables, b: Tables) => JSON.stringify(a) === JSON.stringify(b);

/** Run rounds until the tables stop changing (or maxRounds), returning every snapshot. */
export function run(nodes: string[], edges: Edge[], splitHorizon: boolean, opts: { from?: Tables; maxRounds?: number } = {}): Tables[] {
  const max = opts.maxRounds ?? 40;
  const snaps: Tables[] = [opts.from ?? initTables(nodes, edges)];
  for (let i = 0; i < max; i++) {
    const next = step(snaps[snaps.length - 1], nodes, edges, splitHorizon);
    snaps.push(next);
    if (same(next, snaps[snaps.length - 2])) { snaps.pop(); break; } // converged; drop the duplicate
  }
  return snaps;
}

/** Converge, cut a link, then watch it reconverge — the count-to-infinity scenario. */
export function brokenLinkTimeline(nodes: string[], edges: Edge[], broken: [string, string], splitHorizon: boolean) {
  const converged = run(nodes, edges, splitHorizon).pop()!;
  const remaining = edges.filter((e) => !((e.a === broken[0] && e.b === broken[1]) || (e.a === broken[1] && e.b === broken[0])));
  const timeline = run(nodes, remaining, splitHorizon, { from: converged });
  return { converged, timeline };
}
