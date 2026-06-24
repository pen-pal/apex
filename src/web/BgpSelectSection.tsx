// BGP best-path selection, made visible. Several routes to one prefix; the router
// walks a fixed tiebreaker cascade and the first rule that separates them wins. Nudge a
// route's LOCAL_PREF and watch the deciding step jump — policy (local-pref) is checked
// before the "shortest" AS path, which surprises people. Real decision logic
// (bgpselect.ts, tested).
import { useState } from 'react';
import { selectBest, type Route } from './bgpselect';

const ORIGIN = ['IGP', 'EGP', '?'];

export function BgpSelectSection() {
  const [lp, setLp] = useState<Record<string, number>>({ A: 100, B: 100, C: 100 });
  const routes: Route[] = [
    { id: 'A', nextHop: '10.0.0.1', localPref: lp.A, asPath: [65001, 65002, 65003], origin: 0, med: 50, ebgp: true, igpMetric: 10, routerId: 3 },
    { id: 'B', nextHop: '10.0.0.2', localPref: lp.B, asPath: [65010, 65020], origin: 0, med: 20, ebgp: true, igpMetric: 5, routerId: 1 },
    { id: 'C', nextHop: '10.0.0.3', localPref: lp.C, asPath: [65030], origin: 0, med: 30, ebgp: false, igpMetric: 8, routerId: 2 },
  ];
  const { winner, steps } = selectBest(routes);
  const decider = steps.find((s) => s.decided);

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>BGP best-path — picking one route of many</h2></div>
        <p className="jsec-sub">
          A router often hears several routes to the same prefix. It runs a fixed cascade and the <strong>first rule that breaks the
          tie wins</strong>; equal candidates fall through. Crucially, <strong>LOCAL_PREF</strong> (your own policy) is checked before
          AS-path length — so the “shortest” route doesn’t always win. Adjust each route’s local-pref and watch the decision move.
        </p>

        <div className="bsel-routes">
          <div className="bsel-row head"><span>route</span><span>local-pref</span><span>AS-path</span><span>origin</span><span>MED</span><span>eBGP?</span><span>rtr-id</span></div>
          {routes.map((r) => (
            <div key={r.id} className={`bsel-row ${winner?.id === r.id ? 'win' : ''}`}>
              <span className="bsel-id">{r.id}</span>
              <span><input type="range" min={50} max={300} step={10} value={r.localPref} onChange={(e) => setLp((p) => ({ ...p, [r.id]: Number(e.target.value) }))} /> <b>{r.localPref}</b></span>
              <span className="bsel-mono">{r.asPath.join(' ')} <i>({r.asPath.length})</i></span>
              <span>{ORIGIN[r.origin]}</span>
              <span>{r.med}</span>
              <span>{r.ebgp ? 'eBGP' : 'iBGP'}</span>
              <span>{r.routerId}</span>
            </div>
          ))}
        </div>

        <div className="bsel-cascade">
          {steps.map((s, i) => {
            const active = s.survivors.length > 0;
            return (
              <div key={i} className={`bsel-step ${s.decided ? 'decided' : ''} ${active ? '' : 'skip'}`}>
                <span className="bsel-step-n">{i + 1}</span>
                <span className="bsel-step-name">{s.name}</span>
                <span className="bsel-step-crit">{s.criterion}</span>
                <span className="bsel-survivors">{s.survivors.join(', ') || '—'}{s.decided && ' ✓ decides'}</span>
              </div>
            );
          })}
        </div>

        <div className="bsel-verdict">
          🏆 best path: <strong>route {winner?.id}</strong> (next-hop {winner?.nextHop}) — decided by{' '}
          <strong>{decider ? decider.name : 'no contest'}</strong>.
        </div>

        <p className="bsel-foot">
          Order matters more than “distance”: because LOCAL_PREF outranks AS-path length, an operator can steer traffic onto a paid
          transit or away from a peer regardless of how many hops it is — the lever behind most inter-domain traffic engineering.
          The router-id at the bottom guarantees the process is always deterministic.
        </p>
      </section>
    </div>
  );
}
