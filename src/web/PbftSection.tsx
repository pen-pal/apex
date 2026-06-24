// PBFT, made visible. Slide the replica count n and the number of Byzantine liars f, and
// watch the ring of nodes (honest vs Byzantine), the three quorum phases succeeding or
// stalling, and the n≥3f+1 verdict with the quorum-intersection argument. Real quorum math
// in pbft.ts (tested).
import { useMemo, useState } from 'react';
import { analyze, simulate } from './pbft';

export function PbftSection() {
  const [n, setN] = useState(4);
  const [f, setF] = useState(1);
  const a = useMemo(() => analyze(n, f), [n, f]);
  const r = useMemo(() => simulate(n, f), [n, f]);

  const R = 88, CX = 110, CY = 110;
  const pos = (i: number) => {
    const ang = (i / n) * 2 * Math.PI - Math.PI / 2;
    return { x: CX + R * Math.cos(ang), y: CY + R * Math.sin(ang) };
  };

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>PBFT — agreeing despite liars</h2></div>
        <p className="jsec-sub">
          Crash-tolerant consensus (Paxos, Raft) assumes a failed node simply goes silent. PBFT assumes the worst: up to <strong>f</strong>
          nodes are <strong>Byzantine</strong> — actively malicious, sending different messages to different peers. To stay safe it needs
          <strong> n ≥ 3f+1</strong> replicas and a <strong>2f+1</strong> quorum at each step. Slide n and f and see why.
        </p>

        <div className="pbft-controls">
          <label>replicas n <input type="range" min={1} max={13} value={n} onChange={(e) => setN(+e.target.value)} /><b>{n}</b></label>
          <label>Byzantine f <input type="range" min={0} max={4} value={f} onChange={(e) => setF(+e.target.value)} /><b>{f}</b></label>
        </div>

        <div className="pbft-stage">
          <svg viewBox="0 0 220 220" width={220} height={220} className="pbft-ring">
            <circle cx={CX} cy={CY} r={R} className="pbft-orbit" />
            {Array.from({ length: n }, (_, i) => {
              const p = pos(i);
              const byzantine = i < f;
              const primary = i === 0;
              return (
                <g key={i}>
                  <circle cx={p.x} cy={p.y} r={15} className={`pbft-node ${byzantine ? 'byz' : 'honest'}`} />
                  <text x={p.x} y={p.y + 4} className="pbft-nlabel" textAnchor="middle">{byzantine ? '😈' : primary ? '★' : '✓'}</text>
                </g>
              );
            })}
          </svg>
          <div className="pbft-readout">
            <div className="pbft-fact"><span>quorum (2f+1)</span><b>{a.quorum}</b></div>
            <div className="pbft-fact"><span>honest replicas (n−f)</span><b className={a.honest >= a.quorum ? 'ok' : 'bad'}>{a.honest}</b></div>
            <div className="pbft-fact"><span>two quorums overlap in</span><b>{a.intersectionMin}</b></div>
            <div className="pbft-fact"><span>…honest nodes in that overlap</span><b className={a.honestInIntersection >= 1 ? 'ok' : 'bad'}>{a.honestInIntersection}</b></div>
          </div>
        </div>

        <div className="pbft-phases">
          {r.phases.map((p) => (
            <div key={p.name} className={`pbft-phase ${p.reached ? 'ok' : 'bad'}`}>
              <b>{p.name}</b>
              <span>{p.reached ? '✓' : '✗'} {p.name === 'pre-prepare' ? 'primary proposes' : `needs ${p.needed}, ${p.honestCanSend} honest can send`}</span>
            </div>
          ))}
        </div>

        <div className={`pbft-verdict ${r.agreement ? 'ok' : 'bad'}`}>
          {r.agreement ? '✅ Byzantine agreement reached. ' : '⛔ Cannot tolerate f faults. '}{r.reason}
        </div>

        <p className="pbft-foot">
          The honest node in every quorum-overlap is the whole trick: it would refuse to vote for two different values, so two
          conflicting requests can never both gather a 2f+1 commit quorum — that’s safety. PBFT’s cost is O(n²) messages per request
          (everyone talks to everyone in the prepare/commit phases), which limits it to tens of nodes; modern BFT (Tendermint, HotStuff,
          and the consensus behind many blockchains) keeps the 3f+1 bound but streamlines the communication to scale further.
        </p>
      </section>
    </div>
  );
}
