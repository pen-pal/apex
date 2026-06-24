// BGP best-path selection — when a router hears several routes to the same prefix,
// how it picks ONE. It walks a fixed tiebreaker cascade, and the first rule that
// separates the candidates wins; equal candidates fall through to the next rule. This
// is the decision every internet router makes millions of times, and the order is why
// LOCAL_PREF (your policy) beats AS-path length (the "shortest route"). Pure model of
// the standard decision process (tested).

export interface Route {
  id: string;
  nextHop: string;
  localPref: number; // higher wins (local policy)
  asPath: number[]; // shorter wins
  origin: 0 | 1 | 2; // 0=IGP, 1=EGP, 2=incomplete; lower wins
  med: number; // lower wins
  ebgp: boolean; // eBGP beats iBGP
  igpMetric: number; // lower wins (cost to the next hop)
  routerId: number; // lowest wins — the final, always-decisive tiebreaker
}

export interface Step { name: string; criterion: string; survivors: string[]; decided: boolean }

const RULES: { name: string; criterion: string; key: (r: Route) => number; better: 'max' | 'min' }[] = [
  { name: 'Local Preference', criterion: 'highest LOCAL_PREF', key: (r) => r.localPref, better: 'max' },
  { name: 'AS Path Length', criterion: 'shortest AS_PATH', key: (r) => r.asPath.length, better: 'min' },
  { name: 'Origin', criterion: 'lowest ORIGIN (IGP<EGP<?)', key: (r) => r.origin, better: 'min' },
  { name: 'MED', criterion: 'lowest MED', key: (r) => r.med, better: 'min' },
  { name: 'eBGP over iBGP', criterion: 'prefer eBGP', key: (r) => (r.ebgp ? 0 : 1), better: 'min' },
  { name: 'IGP Metric', criterion: 'lowest metric to next-hop', key: (r) => r.igpMetric, better: 'min' },
  { name: 'Router ID', criterion: 'lowest router-id', key: (r) => r.routerId, better: 'min' },
];

/** Walk the cascade; each rule keeps only the candidates tied for best, recording when
 *  the field of survivors first collapses to one. */
export function selectBest(routes: Route[]): { winner: Route | null; steps: Step[] } {
  let survivors = routes.slice();
  const steps: Step[] = [];
  let decidedYet = survivors.length <= 1;
  for (const rule of RULES) {
    if (survivors.length <= 1) { steps.push({ name: rule.name, criterion: rule.criterion, survivors: survivors.map((r) => r.id), decided: false }); continue; }
    const vals = survivors.map(rule.key);
    const best = rule.better === 'max' ? Math.max(...vals) : Math.min(...vals);
    survivors = survivors.filter((r) => rule.key(r) === best);
    const decided = !decidedYet && survivors.length === 1;
    if (decided) decidedYet = true;
    steps.push({ name: rule.name, criterion: rule.criterion, survivors: survivors.map((r) => r.id), decided });
  }
  return { winner: survivors[0] ?? null, steps };
}
