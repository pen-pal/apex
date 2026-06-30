// Bellman–Ford — single-source shortest paths that, unlike Dijkstra, tolerates NEGATIVE edge weights and
// can DETECT a negative-weight cycle (where "shortest" stops being well-defined: you could loop forever
// getting cheaper). The idea is brute-force relaxation: a shortest path has at most V−1 edges, so relaxing
// every edge V−1 times is enough to settle all distances. If a Vth pass can STILL relax some edge, a
// negative cycle is reachable. The cycle-detection half powers a beautiful real-world trick: model
// currency exchange rates as a graph with weight = −ln(rate); a negative cycle is then a sequence of
// trades whose rates multiply to more than 1 — risk-free ARBITRAGE. References: Bellman (1958), Ford
// (1956); CLRS §24.1.

export interface Edge { u: number; v: number; w: number }

export interface BfResult {
  dist: number[];                 // shortest distance from source (Infinity if unreachable)
  pred: number[];                 // predecessor on the shortest path (-1 if none)
  rounds: number[][];             // dist snapshot after each of the V-1 relaxation passes (for the viz)
  hasNegativeCycle: boolean;      // a negative-weight cycle is reachable from the source
  negativeCycle: number[] | null; // the cycle as a node list (first === last), or null
}

/** Run Bellman–Ford from `source` over `n` nodes. Records each relaxation pass so the UI can animate the
 *  distances settling, and reconstructs a negative cycle if one is reachable. */
export function bellmanFord(n: number, edges: Edge[], source: number): BfResult {
  const dist = new Array(n).fill(Infinity);
  const pred = new Array(n).fill(-1);
  dist[source] = 0;
  const rounds: number[][] = [];

  // V-1 relaxation passes settle every shortest path (paths have ≤ V-1 edges).
  for (let i = 0; i < n - 1; i++) {
    let changed = false;
    for (const e of edges) {
      if (dist[e.u] !== Infinity && dist[e.u] + e.w < dist[e.v]) {
        dist[e.v] = dist[e.u] + e.w;
        pred[e.v] = e.u;
        changed = true;
      }
    }
    rounds.push([...dist]);
    if (!changed) break; // early exit once nothing moves — distances are stable
  }

  // One more pass: any edge that STILL relaxes lies on / downstream of a negative cycle.
  let onCycle = -1;
  for (const e of edges) {
    if (dist[e.u] !== Infinity && dist[e.u] + e.w < dist[e.v]) { onCycle = e.v; pred[e.v] = e.u; break; }
  }

  if (onCycle === -1) return { dist, pred, rounds, hasNegativeCycle: false, negativeCycle: null };

  // Step back V times to land *inside* the cycle (not just on a path leading to it), then walk it.
  let x = onCycle;
  for (let i = 0; i < n; i++) x = pred[x];
  const cycle: number[] = [];
  let cur = x;
  do { cycle.push(cur); cur = pred[cur]; } while (cur !== x && cycle.length <= n);
  cycle.push(x);
  cycle.reverse();
  return { dist, pred, rounds, hasNegativeCycle: true, negativeCycle: cycle };
}

export interface Rate { from: string; to: string; rate: number }
export interface Arbitrage { cycle: string[]; profit: number }

/** Detect a risk-free arbitrage loop among `currencies` given directed exchange `rates`. Builds the
 *  −ln(rate) graph (so a path's total weight = −ln of the product of rates), adds a zero-weight virtual
 *  source reaching every node (so a cycle anywhere is found), and reports the loop + its profit multiplier
 *  (>1 means free money). Returns null if no arbitrage exists. */
export function detectArbitrage(currencies: string[], rates: Rate[]): Arbitrage | null {
  const idx = new Map(currencies.map((c, i) => [c, i]));
  const n = currencies.length;
  const edges: Edge[] = [];
  for (const r of rates) {
    const u = idx.get(r.from), v = idx.get(r.to);
    if (u === undefined || v === undefined || r.rate <= 0) continue;
    edges.push({ u, v, w: -Math.log(r.rate) });
  }
  // Virtual source n → every currency, weight 0, so unreachable components are still scanned.
  for (let i = 0; i < n; i++) edges.push({ u: n, v: i, w: 0 });

  const res = bellmanFord(n + 1, edges, n);
  if (!res.hasNegativeCycle || !res.negativeCycle) return null;

  // The reported cycle is in node space; the virtual source can't be on a cycle (no incoming edges),
  // so every node maps to a real currency. The pred-walk may yield the loop in either direction, so
  // orient it to follow real directed edges before multiplying the rates.
  const hasRate = (a: string, b: string) => rates.some((r) => r.from === a && r.to === b);
  const names = res.negativeCycle.filter((i) => i < n).map((i) => currencies[i]);
  const seq = names.length >= 2 && !hasRate(names[0], names[1]) ? [...names].reverse() : names;
  let profit = 1;
  for (let i = 0; i < seq.length - 1; i++) {
    const r = rates.find((x) => x.from === seq[i] && x.to === seq[i + 1]);
    if (r) profit *= r.rate;
  }
  return { cycle: seq, profit };
}
