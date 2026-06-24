// BGP route propagation & hijacking — how a route to a prefix spreads across the
// internet's autonomous systems, and how an attacker steals traffic by lying. An AS
// announces a prefix; neighbors learn a route whose AS_PATH is the announcer's path
// with the announcer prepended; each AS keeps the SHORTEST loop-free AS_PATH and
// re-advertises its best. A HIJACK is just another AS announcing the same prefix: any
// AS for whom the rogue's path is shorter switches to it, sending that traffic to the
// attacker. A MORE-SPECIFIC announcement (a longer prefix) beats everything via
// longest-prefix match, capturing the whole internet. Real BGP path selection. Tested.

export interface AsGraph { nodes: number[]; edges: [number, number][] }

export interface Route {
  origin: number; // the AS that originated the prefix (real or rogue)
  asPath: number[]; // ordered AS_PATH from this AS to the origin (this AS first)
}

export interface PropResult {
  best: Record<number, Route>; // each AS's chosen route to the prefix
}

function neighbours(g: AsGraph, n: number): number[] {
  const out: number[] = [];
  for (const [a, b] of g.edges) { if (a === n) out.push(b); if (b === n) out.push(a); }
  return out;
}

// shorter AS_PATH wins; tie-break on next-hop ASN (deterministic, stands in for
// real tie-breakers like router-id) so results are stable.
function better(a: Route, b: Route): boolean {
  if (a.asPath.length !== b.asPath.length) return a.asPath.length < b.asPath.length;
  return (a.asPath[1] ?? a.origin) < (b.asPath[1] ?? b.origin);
}

/**
 * Propagate one or more origins of the SAME prefix across the graph. Each origin AS
 * starts with AS_PATH [itself]; routes flood outward, prepending and dropping loops,
 * keeping the best per AS. Returns each AS's chosen route (and thus which origin it
 * sends traffic toward).
 */
export function propagate(g: AsGraph, origins: number[]): PropResult {
  const best: Record<number, Route> = {};
  for (const o of origins) best[o] = { origin: o, asPath: [o] };

  // relax until stable (Bellman-Ford style over AS_PATH length)
  let changed = true;
  while (changed) {
    changed = false;
    for (const n of g.nodes) {
      for (const nb of neighbours(g, n)) {
        const adv = best[nb];
        if (!adv) continue;
        if (adv.asPath.includes(n)) continue; // loop prevention
        const candidate: Route = { origin: adv.origin, asPath: [n, ...adv.asPath] };
        if (!best[n] || better(candidate, best[n])) { best[n] = candidate; changed = true; }
      }
    }
  }
  return { best };
}

/** Which AS does `as` ultimately route to — the real origin or the hijacker? */
export function routesTo(res: PropResult, as: number): number | null {
  return res.best[as]?.origin ?? null;
}

export interface HijackResult {
  prop: PropResult;
  captured: number[]; // ASes now routing to the hijacker
  legit: number[]; // ASes still routing to the real origin
}

/**
 * Compute the hijack outcome. With `moreSpecific`, the rogue announces a longer
 * prefix that wins everywhere via longest-prefix match (every reachable AS captured).
 */
export function hijack(g: AsGraph, realOrigin: number, rogue: number, moreSpecific: boolean): HijackResult {
  if (moreSpecific) {
    const prop = propagate(g, [rogue]); // a more-specific route is preferred by all
    const captured = g.nodes.filter((n) => routesTo(prop, n) === rogue);
    return { prop, captured, legit: g.nodes.filter((n) => !captured.includes(n)) };
  }
  const prop = propagate(g, [realOrigin, rogue]);
  const captured = g.nodes.filter((n) => routesTo(prop, n) === rogue && n !== realOrigin);
  const legit = g.nodes.filter((n) => routesTo(prop, n) === realOrigin);
  return { prop, captured, legit };
}
