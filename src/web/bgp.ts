// BGP best-path selection — the decision ladder every router walks to pick ONE
// route when several reach the same prefix. It compares candidates rung by rung,
// stopping at the first attribute that breaks the tie. This is the canonical
// "why did BGP pick THAT path?" — modeled here as pure, tested logic (the order
// matches Cisco/standard BGP best-path; RFC 4271 §9.1 plus common vendor steps).

export type Origin = 'IGP' | 'EGP' | 'INCOMPLETE'; // best → worst (i < e < ?)
const ORIGIN_RANK: Record<Origin, number> = { IGP: 0, EGP: 1, INCOMPLETE: 2 };

export interface Route {
  id: string; // a short label, e.g. "via AS65010"
  nextHop: string;
  weight: number; // Cisco-local, higher wins (never advertised)
  localPref: number; // higher wins (within the AS)
  asPath: number[]; // shorter wins
  origin: Origin; // IGP < EGP < INCOMPLETE
  med: number; // lower wins (only compared among same-neighbor-AS by default; simplified here)
  fromEbgp: boolean; // eBGP preferred over iBGP
  igpMetric: number; // lower wins (metric to the next hop)
  routerId: number; // lowest wins (final tie-break)
}

export interface Rung {
  key: string; // attribute name
  label: string; // human label
  better: 'higher' | 'lower'; // which direction wins
  value: (r: Route) => number; // numeric comparison value (already normalized so LOWER number = better)
  explain: string;
}

// Each rung returns a number where LOWER = better, so one comparator handles all.
export const LADDER: Rung[] = [
  { key: 'weight', label: 'Weight', better: 'higher', value: (r) => -r.weight, explain: 'Cisco-proprietary, local to this router and never advertised. Highest wins.' },
  { key: 'localPref', label: 'Local Preference', better: 'higher', value: (r) => -r.localPref, explain: 'Set within your AS to steer outbound traffic. Highest wins, and it propagates across iBGP.' },
  { key: 'asPath', label: 'AS_PATH length', better: 'lower', value: (r) => r.asPath.length, explain: 'Fewer autonomous systems to cross. Shortest wins — the attribute people think of as “BGP distance”.' },
  { key: 'origin', label: 'Origin code', better: 'lower', value: (r) => ORIGIN_RANK[r.origin], explain: 'How the route entered BGP: IGP (i) beats EGP (e) beats INCOMPLETE (?).' },
  { key: 'med', label: 'MED', better: 'lower', value: (r) => r.med, explain: 'Multi-Exit Discriminator — a hint from a neighbor AS about which of its entry points to prefer. Lowest wins.' },
  { key: 'ebgp', label: 'eBGP over iBGP', better: 'lower', value: (r) => (r.fromEbgp ? 0 : 1), explain: 'A route learned from an external peer is preferred over one learned internally.' },
  { key: 'igpMetric', label: 'IGP metric to next hop', better: 'lower', value: (r) => r.igpMetric, explain: 'Cost to actually reach the BGP next hop, per the IGP (OSPF/IS-IS). Lowest wins.' },
  { key: 'routerId', label: 'Lowest router-ID', better: 'lower', value: (r) => r.routerId, explain: 'The deterministic final tie-break: prefer the path from the peer with the lowest BGP router-ID.' },
];

export interface DecisionStep {
  rung: Rung;
  bestValue: number; // the winning (lowest) value at this rung among survivors
  survivors: string[]; // route ids still in contention AFTER this rung
  eliminated: string[]; // route ids knocked out AT this rung
  decisive: boolean; // did this rung reduce the field to one / break the tie?
}

export interface BgpDecision {
  steps: DecisionStep[];
  winner: Route | null;
  decidedAt: string | null; // the rung key that produced the single winner
}

/** Walk the ladder over candidate routes, recording who is eliminated at each rung. */
export function selectBestPath(routes: Route[]): BgpDecision {
  const steps: DecisionStep[] = [];
  let survivors = routes.slice();
  let decidedAt: string | null = null;

  for (const rung of LADDER) {
    if (survivors.length <= 1) break;
    const before = survivors;
    let best = Infinity;
    for (const r of before) best = Math.min(best, rung.value(r));
    const survived = before.filter((r) => rung.value(r) === best);
    const eliminated = before.filter((r) => rung.value(r) !== best);
    const decisive = survived.length < before.length;
    steps.push({
      rung, bestValue: best,
      survivors: survived.map((r) => r.id),
      eliminated: eliminated.map((r) => r.id),
      decisive,
    });
    survivors = survived;
    if (survivors.length === 1 && decidedAt === null) decidedAt = rung.key;
  }

  return { steps, winner: survivors.length >= 1 ? survivors[0] : null, decidedAt };
}
