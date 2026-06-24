// Spanning Tree Protocol (IEEE 802.1D) — turn a looped switch topology into a
// loop-free tree so broadcasts don't circulate forever. Bridges elect a ROOT (lowest
// bridge ID), each non-root bridge finds its shortest path to the root and marks that
// link its ROOT PORT, each segment picks a DESIGNATED port (the end closer to the
// root), and every remaining port is BLOCKED — cutting exactly the redundant links
// that would form loops. Pure shortest-path + tie-break model (tested).

export interface Link { a: number; b: number; cost: number }
export type Role = 'root-port' | 'designated' | 'blocked';

const INF = Infinity;

/** Dijkstra distances from `root` over the undirected weighted links. */
function distances(bridges: number[], links: Link[], root: number): Record<number, number> {
  const dist: Record<number, number> = {};
  for (const b of bridges) dist[b] = b === root ? 0 : INF;
  const seen = new Set<number>();
  while (seen.size < bridges.length) {
    let u = -1, best = INF;
    for (const b of bridges) if (!seen.has(b) && dist[b] < best) { best = dist[b]; u = b; }
    if (u === -1) break;
    seen.add(u);
    for (const l of links) {
      const v = l.a === u ? l.b : l.b === u ? l.a : null;
      if (v !== null && dist[u] + l.cost < dist[v]) dist[v] = dist[u] + l.cost;
    }
  }
  return dist;
}

export interface PortRole { link: Link; bridge: number; other: number; role: Role }

export interface StpResult { root: number; dist: Record<number, number>; ports: PortRole[]; blocked: number }

export function spanningTree(bridges: number[], links: Link[]): StpResult {
  const root = Math.min(...bridges); // lowest bridge ID wins
  const dist = distances(bridges, links, root);

  // each non-root bridge's root port = the link giving its shortest path (tiebreak:
  // lower neighbour ID, then lower cost)
  const rootPort: Record<number, Link | null> = {};
  for (const b of bridges) {
    if (b === root) { rootPort[b] = null; continue; }
    let best: Link | null = null, bestCost = INF, bestNb = INF;
    for (const l of links) {
      const nb = l.a === b ? l.b : l.b === b ? l.a : null;
      if (nb === null) continue;
      const c = dist[nb] + l.cost;
      if (c < bestCost || (c === bestCost && nb < bestNb)) { best = l; bestCost = c; bestNb = nb; }
    }
    rootPort[b] = best;
  }

  const ports: PortRole[] = [];
  for (const l of links) {
    // designated end of the segment = the bridge closer to root (tiebreak lower ID)
    const desig = dist[l.a] < dist[l.b] || (dist[l.a] === dist[l.b] && l.a < l.b) ? l.a : l.b;
    for (const [bridge, other] of [[l.a, l.b], [l.b, l.a]] as const) {
      let role: Role;
      if (bridge === desig) role = 'designated';
      else if (rootPort[bridge] === l) role = 'root-port';
      else role = 'blocked';
      ports.push({ link: l, bridge, other, role });
    }
  }
  return { root, dist, ports, blocked: ports.filter((p) => p.role === 'blocked').length };
}
