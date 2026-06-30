// Request coalescing, made visible. A burst of requests for the same just-expired key arrives; without
// coalescing every one of them stampedes the backend, with it the first computes and the rest share its
// result. Drag the herd size and the compute time and watch the backend-call count diverge — naive
// scales with the herd, singleflight stays at one. Real model from singleflight.ts.
import { useMemo, useState } from 'react';
import { simulate, type Req } from './singleflight';

const OUTCOME_HUE = { compute: 0, shared: 150, hit: 212 } as const;
const OUTCOME_LABEL = { compute: 'backend call', shared: 'shared (coalesced)', hit: 'cache hit' } as const;

export function SingleFlightSection() {
  const [herd, setHerd] = useState(8);
  const [computeMs, setComputeMs] = useState(6);

  const reqs: Req[] = useMemo(() => Array.from({ length: herd }, (_, i) => ({ key: 'hot', arrival: i })), [herd]);
  const naive = useMemo(() => simulate(reqs, computeMs, false), [reqs, computeMs]);
  const sf = useMemo(() => simulate(reqs, computeMs, true), [reqs, computeMs]);

  return (
    <div className="sf">
      <div className="sf-controls">
        <label>herd size <input type="range" min={2} max={14} value={herd} onChange={(e) => setHerd(+e.target.value)} /><b>{herd}</b></label>
        <label>compute time <input type="range" min={1} max={12} value={computeMs} onChange={(e) => setComputeMs(+e.target.value)} /><b>{computeMs} ticks</b></label>
        <span className="sf-note">all requests hit the same just-expired key</span>
      </div>

      <div className="sf-panels">
        {([['without coalescing', naive, false], ['with singleflight', sf, true] ] as const).map(([title, r, dedup]) => (
          <div key={title} className={`sf-panel ${dedup ? 'good' : 'bad'}`}>
            <div className="sf-panel-h">{title}</div>
            <div className="sf-big"><b className={dedup ? 'ok' : 'hot'}>{r.computations}</b> backend call{r.computations === 1 ? '' : 's'}</div>
            <div className="sf-dots">
              {r.results.map((x, i) => (
                <span key={i} className="sf-dot" style={{ background: `hsl(${OUTCOME_HUE[x.outcome]} ${x.outcome === 'hit' ? 55 : 60}% ${x.outcome === 'compute' ? 58 : 55}%)` }} title={`t=${x.req.arrival}: ${OUTCOME_LABEL[x.outcome]}`} />
              ))}
            </div>
            <div className="sf-breakdown">
              {(['compute', 'shared', 'hit'] as const).map((o) => {
                const n = r.results.filter((x) => x.outcome === o).length;
                return n > 0 ? <span key={o} className="sf-bd"><span className="sf-bddot" style={{ background: `hsl(${OUTCOME_HUE[o]} 60% 55%)` }} />{n} {OUTCOME_LABEL[o]}</span> : null;
              })}
            </div>
          </div>
        ))}
      </div>

      <p className="sf-foot">
        The danger moment is a <strong>popular key expiring</strong>: every in-flight request misses simultaneously and they all recompute the
        same value, so the database gets its heaviest load exactly when the cache is least helpful — a stampede that can cascade into an outage.
        Singleflight collapses the duplicates to a single in-flight computation; the rest block briefly and share the answer. Related tactics:
        <em> stale-while-revalidate</em> (serve the old value while one request refreshes), early/probabilistic expiry (refresh just before the TTL
        so misses don’t synchronize), and per-key locks. It’s the read-path twin of the idempotency-key idea on the write path — both turn many
        duplicate operations into one. (Go’s <code>singleflight</code>; cache-stampede literature.)
      </p>
    </div>
  );
}
