// Load balancing, made visible. Pick a strategy and step a stream of requests —
// each occupies a backend for its duration — and watch how round-robin spreads
// evenly, least-connections adapts to slow requests, weighted favours bigger
// servers, and ip-hash pins each client to one backend. Real model (loadbalance.ts).
import { useEffect, useMemo, useState } from 'react';
import { Balancer, skew, type Algo, type Req } from './loadbalance';

const BACKENDS = [{ id: 'web-1', weight: 1 }, { id: 'web-2', weight: 2 }, { id: 'web-3', weight: 1 }];
const CLIENTS = ['alice', 'bob', 'carol', 'dave', 'eve'];
const DUR = [1, 3, 2, 4, 1, 2, 3, 1, 2, 1, 3, 2, 1, 4, 2, 1, 3, 2];
const REQS: Req[] = DUR.map((d, i) => ({ client: CLIENTS[i % CLIENTS.length], duration: d }));

const ALGOS: { id: Algo; label: string; note: string }[] = [
  { id: 'round-robin', label: 'Round robin', note: 'Cycles in order. Simple and even when requests are uniform — but a slow request can pile up on one backend.' },
  { id: 'weighted', label: 'Weighted RR', note: 'Bigger servers (higher weight) get proportionally more requests. web-2 has weight 2.' },
  { id: 'least-conn', label: 'Least connections', note: 'Sends each request to whoever has the fewest in flight — adapts to uneven durations automatically.' },
  { id: 'ip-hash', label: 'IP hash (sticky)', note: 'Hashes the client → always the same backend. Keeps sessions/caches warm, but can balance unevenly.' },
];

interface Flow { backend: string; remaining: number; client: string }
function replay(algo: Algo, step: number) {
  const lb = new Balancer(algo, BACKENDS);
  let inFlight: Flow[] = [];
  let last: { backend: string; client: string } | null = null;
  for (let s = 0; s < step; s++) {
    inFlight.forEach((f) => (f.remaining -= 1));
    inFlight.filter((f) => f.remaining <= 0).forEach((f) => lb.release(f.backend));
    inFlight = inFlight.filter((f) => f.remaining > 0);
    const r = REQS[s];
    if (r) {
      const a = lb.dispatch(r);
      inFlight.push({ backend: a.backend, remaining: r.duration, client: r.client });
      last = { backend: a.backend, client: r.client };
    }
  }
  const active: Record<string, number> = {};
  for (const f of inFlight) active[f.backend] = (active[f.backend] ?? 0) + 1;
  return { handled: lb.handledMap, active, inFlight, last };
}

export function LoadBalanceSection() {
  const [algo, setAlgo] = useState<Algo>('round-robin');
  const [step, setStep] = useState(REQS.length);
  const [playing, setPlaying] = useState(false);

  const state = useMemo(() => replay(algo, step), [algo, step]);
  useEffect(() => { setStep(REQS.length); }, [algo]);
  useEffect(() => {
    if (!playing) return;
    if (step >= REQS.length) { setPlaying(false); return; }
    const id = setTimeout(() => setStep((s) => Math.min(s + 1, REQS.length)), 600);
    return () => clearTimeout(id);
  }, [playing, step]);

  const algoInfo = ALGOS.find((a) => a.id === algo)!;
  const maxHandled = Math.max(1, ...Object.values(state.handled));
  const nextReq = REQS[step];

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Load balancing — spreading requests across servers</h2></div>
        <p className="jsec-sub">
          A load balancer is the front door to a pool of identical servers. <em>How</em> it picks one matters: the
          strategy decides whether load spreads evenly, adapts to slow requests, or keeps a user pinned to one box.
          Choose an algorithm and step the request stream.
        </p>

        <div className="lb-algos">
          {ALGOS.map((a) => <button key={a.id} className={`lb-algo ${algo === a.id ? 'on' : ''}`} onClick={() => setAlgo(a.id)}>{a.label}</button>)}
        </div>
        <p className="lb-note">{algoInfo.note}</p>

        <div className="lb-controls">
          <button className="ghost small" onClick={() => { setStep(0); setPlaying(false); }}>⏮</button>
          <button className="ghost small" disabled={step >= REQS.length} onClick={() => { setStep((s) => Math.min(REQS.length, s + 1)); setPlaying(false); }}>next request →</button>
          <button className="ghost small" onClick={() => { if (step >= REQS.length) setStep(0); setPlaying((p) => !p); }}>{playing ? '⏸' : '▶'}</button>
          <button className="ghost small" onClick={() => { setStep(REQS.length); setPlaying(false); }}>all</button>
          <span className="lb-prog">{step}/{REQS.length}</span>
        </div>

        {nextReq && step < REQS.length && (
          <div className="lb-incoming">next: request from <strong>{nextReq.client}</strong> · {nextReq.duration} ticks{state.last && ` · last → ${state.last.backend} (${state.last.client})`}</div>
        )}

        <div className="lb-backends">
          {BACKENDS.map((b) => {
            const active = state.active[b.id] ?? 0;
            const handled = state.handled[b.id] ?? 0;
            const isLast = state.last?.backend === b.id;
            return (
              <div key={b.id} className={`lb-backend ${isLast ? 'hit' : ''}`}>
                <div className="lb-b-head">{b.id}{b.weight > 1 && <span className="lb-weight">×{b.weight}</span>}</div>
                <div className="lb-conns">
                  {Array.from({ length: Math.max(active, 0) }, (_, i) => <span key={i} className="lb-conn" />)}
                  {active === 0 && <span className="lb-idle">idle</span>}
                </div>
                <div className="lb-active">{active} active</div>
                <div className="lb-handledbar"><div className="lb-handledfill" style={{ width: `${(handled / maxHandled) * 100}%` }} /></div>
                <div className="lb-handled">{handled} handled</div>
              </div>
            );
          })}
        </div>

        <div className="lb-skew">load skew (busiest − idlest handled): <strong>{skew(state.handled)}</strong> {skew(state.handled) === 0 ? '· perfectly even' : ''}</div>
        <p className="enc-note">There’s no universally best choice: round-robin is cheapest, least-connections handles uneven workloads, IP-hash
          gives session stickiness (at the cost of balance), and weighted lets you mix big and small servers. Real balancers also add health checks
          so a dead backend is removed from rotation.</p>
      </section>
    </div>
  );
}
