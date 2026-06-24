// Distance-vector routing & count-to-infinity, made visible. A line A—B—C—D
// converges to hop-count routes by neighbour gossip. Cut the A—B link and, without
// split-horizon, the routers keep believing each other's stale "I can reach A" and
// the cost to A crawls up one hop per round until it hits 16 = unreachable. Flip on
// poison-reverse and it dies immediately. Model in dv.ts (tested).
import { useMemo, useState } from 'react';
import { run, brokenLinkTimeline, INF, type Edge, type Tables } from './dv';

const NODES = ['A', 'B', 'C', 'D'];
const EDGES: Edge[] = [
  { a: 'A', b: 'B', cost: 1 },
  { a: 'B', b: 'C', cost: 1 },
  { a: 'C', b: 'D', cost: 1 },
];
const DEST = 'A'; // the router that gets cut off
const FROM = ['B', 'C', 'D'];
const cost = (t: Tables, x: string) => (t[x][DEST].cost >= INF ? '∞' : t[x][DEST].cost);

export function DistanceVectorSection() {
  const [split, setSplit] = useState(false);
  const [broke, setBroke] = useState(false);
  const [round, setRound] = useState(0);

  const converged = useMemo(() => run(NODES, EDGES, false).pop()!, []);
  const timeline = useMemo(() => brokenLinkTimeline(NODES, EDGES, ['A', 'B'], split).timeline, [split]);
  const r = Math.min(round, timeline.length - 1);
  const now = broke ? timeline[r] : converged;

  const cut = () => { setBroke(true); setRound(0); };
  const reset = () => { setBroke(false); setRound(0); };

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Distance-vector routing &amp; count-to-infinity</h2></div>
        <p className="jsec-sub">
          Each router advertises its <em>distance vector</em> to neighbours and keeps the cheapest route it hears. The line below
          converges to hop counts. Then cut the <strong>A—B</strong> link: with plain RIP the bad news travels <em>slowly</em> — B
          and C keep echoing stale routes and the cost to A counts upward to 16 (unreachable). Poison-reverse stops it cold.
        </p>

        <div className="dv-net">
          {NODES.map((n, i) => (
            <span key={n} className="dv-link-wrap">
              <span className={`dv-node ${n === DEST ? 'dest' : ''}`}>{n}</span>
              {i < NODES.length - 1 && (
                <span className={`dv-link ${broke && i === 0 ? 'cut' : ''}`}>{broke && i === 0 ? '✂' : '—1—'}</span>
              )}
            </span>
          ))}
        </div>

        <div className="dv-controls">
          {!broke
            ? <button className="dv-btn primary" onClick={cut}>✂ cut the A—B link</button>
            : <button className="dv-btn" onClick={reset}>↺ restore link</button>}
          <label className="dv-toggle"><input type="checkbox" checked={split} onChange={(e) => { setSplit(e.target.checked); setRound(0); }} /> split horizon / poison reverse</label>
        </div>

        <div className="dv-cards">
          {FROM.map((x) => {
            const c = now[x][DEST];
            const cls = c.cost >= INF ? 'inf' : broke && c.cost > (x === 'B' ? 1 : x === 'C' ? 2 : 3) ? 'climb' : 'ok';
            return (
              <div key={x} className={`dv-card ${cls}`}>
                <div className="dv-card-h">{x} → {DEST}</div>
                <div className="dv-card-cost">{cost(now, x)}</div>
                <div className="dv-card-via">{c.via ? `via ${c.via}` : c.cost >= INF ? 'unreachable' : 'direct'}</div>
              </div>
            );
          })}
        </div>

        {broke && (
          <>
            <div className="dv-stepper">
              <button onClick={() => setRound(Math.max(0, r - 1))} disabled={r === 0}>◀</button>
              <input type="range" min={0} max={timeline.length - 1} value={r} onChange={(e) => setRound(Number(e.target.value))} />
              <button onClick={() => setRound(Math.min(timeline.length - 1, r + 1))} disabled={r === timeline.length - 1}>▶</button>
              <span className="dv-stepno">round {r} / {timeline.length - 1}</span>
            </div>
            <table className="dv-table">
              <thead><tr><th>round</th>{FROM.map((x) => <th key={x}>{x}→A</th>)}</tr></thead>
              <tbody>
                {timeline.map((t, i) => (
                  <tr key={i} className={i === r ? 'on' : ''} onClick={() => setRound(i)}>
                    <td>{i}</td>
                    {FROM.map((x) => <td key={x} className={t[x][DEST].cost >= INF ? 'inf' : ''}>{t[x][DEST].cost >= INF ? '∞' : t[x][DEST].cost}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        <p className="dv-note">
          {split
            ? 'Poison reverse: a router advertises a route back to its own next hop as ∞, so B never believes C can still reach A through B. The loop never forms — it converges in a round or two.'
            : 'Plain distance-vector has no such guard: B hears C say “A, cost 2”, C hears B say “A, cost 3”, and the estimate inches up every round. RIP only survives because it caps the climb at 16 and calls it unreachable. Link-state protocols (OSPF) avoid this by flooding the whole topology instead of gossiping summaries.'}
        </p>
      </section>
    </div>
  );
}
