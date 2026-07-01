// Bellman–Ford, made visible. Left: watch relaxation settle the distances pass by pass — the negative
// edge C→B pulls B below the greedy value in a later round, which is exactly the case Dijkstra gets wrong.
// Right: the same negative-cycle machinery as an arbitrage detector — edit the exchange rates and see a
// risk-free trading loop appear the moment the rates multiply past 1. Real model from bellmanford.ts.
import { useMemo, useState } from 'react';
import { bellmanFord, detectArbitrage, type Edge, type Rate } from './bellmanford';

const NODES = ['A', 'B', 'C', 'D'];
// A genuine Dijkstra-failure graph: A→B=6 looks best for B, but A→C→B (7−5=2) is cheaper — and Dijkstra
// would finalize B=6 before ever processing C. Edges are ordered worst-case so it takes 3 passes to settle.
const EDGES: Edge[] = [
  { u: 1, v: 3, w: 3 },  // B→D
  { u: 2, v: 1, w: -5 }, // C→B  (the negative edge Dijkstra mishandles)
  { u: 0, v: 2, w: 7 },  // A→C
  { u: 0, v: 1, w: 6 },  // A→B
];
const fmt = (d: number) => (d === Infinity ? '∞' : `${d}`);

const CURRENCIES = ['USD', 'EUR', 'GBP'];

export function BellmanFordSection() {
  const result = useMemo(() => bellmanFord(NODES.length, EDGES, 0), []);
  const [pass, setPass] = useState(0); // 0 = init, n = final — start at init so it builds up
  const shown = pass === 0 ? NODES.map((_, i) => (i === 0 ? 0 : Infinity)) : result.rounds[Math.min(pass, result.rounds.length) - 1];

  // Arbitrage: three editable directed rates that form a loop USD→EUR→GBP→USD.
  const [r1, setR1] = useState(0.9); // USD→EUR
  const [r2, setR2] = useState(0.9); // EUR→GBP
  const [r3, setR3] = useState(1.3); // GBP→USD
  const rates: Rate[] = [
    { from: 'USD', to: 'EUR', rate: r1 }, { from: 'EUR', to: 'GBP', rate: r2 }, { from: 'GBP', to: 'USD', rate: r3 },
    // back-edges with a spread so the only possible arbitrage is the forward loop
    { from: 'EUR', to: 'USD', rate: (1 / r1) * 0.98 }, { from: 'GBP', to: 'EUR', rate: (1 / r2) * 0.98 }, { from: 'USD', to: 'GBP', rate: (1 / r3) * 0.98 },
  ];
  const arb = useMemo(() => detectArbitrage(CURRENCIES, rates), [r1, r2, r3]);
  const loopProduct = r1 * r2 * r3;

  return (
    <div className="bford">
      <p className="bford-intro">
        Dijkstra is greedy: it finalizes the closest node and never revisits it — which breaks the instant an
        edge is <strong>negative</strong>. Bellman–Ford instead just <strong>relaxes every edge V−1 times</strong>.
        It's slower (O(V·E)), but it handles negative weights and, with one extra pass, <strong>detects a
        negative cycle</strong> — a loop you could ride forever getting cheaper.
      </p>

      <div className="bford-grid">
        <div className="bford-panel">
          <div className="bford-ph">Relaxation — distances from A</div>
          <div className="bford-graph">
            {EDGES.map((e, i) => (
              <span key={i} className={`bford-edge ${e.w < 0 ? 'neg' : ''}`}>{NODES[e.u]}→{NODES[e.v]} <b>{e.w > 0 ? `+${e.w}` : e.w}</b></span>
            ))}
          </div>
          <div className="bford-dist">
            {NODES.map((nm, i) => (
              <div key={nm} className={`bford-cell ${shown[i] === Infinity ? 'inf' : ''}`}>
                <span className="bford-node">{nm}</span>
                <b>{fmt(shown[i])}</b>
              </div>
            ))}
          </div>
          <div className="bford-passes">
            <button type="button" className="bford-pbtn" disabled={pass === 0} onClick={() => setPass((p) => Math.max(0, p - 1))}>‹</button>
            <span className="bford-plabel">{pass === 0 ? 'initial' : `after pass ${pass} of ${result.rounds.length}`}</span>
            <button type="button" className="bford-pbtn" disabled={pass >= result.rounds.length} onClick={() => setPass((p) => Math.min(result.rounds.length, p + 1))}>›</button>
          </div>
          <div className="bford-note">
            Pass 2 fires the negative edge <b>C→B (−5)</b>, dropping B from 6 to 2 via A→C→B; pass 3
            propagates that and corrects D from 9 to 5. Dijkstra would finalize B=6 the moment it popped it
            and report D=9 — both wrong. The final row is the true answer.
          </div>
        </div>

        <div className="bford-panel">
          <div className="bford-ph">Arbitrage detector — a negative cycle in −ln(rate)</div>
          <div className="bford-rates">
            {[['USD→EUR', r1, setR1], ['EUR→GBP', r2, setR2], ['GBP→USD', r3, setR3]].map(([lbl, v, set]: any) => (
              <label key={lbl} className="bford-rate">
                <span>{lbl}</span>
                <input type="range" min={0.5} max={1.6} step={0.01} value={v} onChange={(e) => set(+e.target.value)} />
                <b>{v.toFixed(2)}</b>
              </label>
            ))}
          </div>
          <div className="bford-loop">
            round-trip USD→EUR→GBP→USD multiplies to <b className={loopProduct > 1 ? 'win' : ''}>{loopProduct.toFixed(4)}</b>
          </div>
          <div className={`bford-arb ${arb ? 'yes' : 'no'}`}>
            {arb ? (
              <>
                <div className="bford-arb-h">⚠ arbitrage found</div>
                <div className="bford-arb-cycle">{arb.cycle.join(' → ')}</div>
                <div className="bford-arb-profit">$100 → ${(100 * arb.profit).toFixed(2)} per loop ({((arb.profit - 1) * 100).toFixed(2)}% risk-free)</div>
              </>
            ) : (
              <div className="bford-arb-h">no arbitrage — every loop loses to the spread</div>
            )}
          </div>
          <div className="bford-note">
            Set each trade's rate, then read off whether the cycle pays. Modeling rate <i>r</i> as an edge of
            weight <code>−ln(r)</code> turns "product of rates &gt; 1" into "cycle weight &lt; 0", so the same
            negative-cycle test finds free money. Real desks run this across thousands of pairs in microseconds.
          </div>
        </div>
      </div>

      <p className="bford-foot">
        Bellman–Ford is the relaxation core of the <strong>distance-vector</strong> routing family (RIP):
        routers exchange their distance tables and relax, which is also why DV suffers
        <strong> count-to-infinity</strong> when a link drops — the "negative cycle" of routing. It also
        seeds the Johnson all-pairs algorithm (a Bellman–Ford reweighting pass lets Dijkstra run safely on a
        graph that had negative edges). Use Dijkstra when all weights are non-negative (it's faster); reach
        for Bellman–Ford when they can go negative or you need to <em>detect</em> a negative cycle.
      </p>
    </div>
  );
}
