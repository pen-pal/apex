// Tunable quorum, made visible. N nodes on a ring; slide R and W and watch the read
// window and write window placed as far apart as possible (the adversarial worst case).
// The instant R + W > N they are forced to overlap — pigeonhole — and the shared node,
// which holds the latest write, lights up. Two inequalities drive everything; both are
// shown live. Real logic in quorumrw.ts (tested against the Dynamo configurations).
import { useMemo, useState } from 'react';
import { analyze, worstCase } from './quorumrw';

export function QuorumSection() {
  const [n, setN] = useState(5);
  const [r, setR] = useState(3);
  const [w, setW] = useState(3);

  // keep R,W within [1,N] as N changes
  const R = Math.min(r, n), W = Math.min(w, n);
  const a = useMemo(() => analyze({ n, r: R, w: W }), [n, R, W]);
  const placement = useMemo(() => worstCase({ n, r: R, w: W }), [n, R, W]);
  const writeSet = new Set(placement.writeSet);
  const readSet = new Set(placement.readSet);
  const shared = new Set(placement.shared);

  const RAD = 96, CX = 130, CY = 130;
  const nodePos = (i: number) => {
    const ang = (i / n) * 2 * Math.PI - Math.PI / 2;
    return { x: CX + RAD * Math.cos(ang), y: CY + RAD * Math.sin(ang) };
  };

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Quorum consistency — turn the R + W &gt; N dial</h2></div>
        <p className="jsec-sub">
          Replicate to <strong>N</strong> nodes, acknowledge a write on <strong>W</strong>, gather a read from <strong>R</strong>. If
          <code> R + W &gt; N</code>, the read set and the write set <em>cannot</em> avoid each other — they always share a node, and
          that node has the latest value. Below, the windows are placed as far apart as possible; raise R or W until they collide.
        </p>

        <div className="quo-controls">
          <label>N&nbsp;nodes <input type="range" min={3} max={7} value={n} onChange={(e) => setN(+e.target.value)} /><b>{n}</b></label>
          <label>R&nbsp;(read) <input type="range" min={1} max={n} value={R} onChange={(e) => setR(+e.target.value)} /><b>{R}</b></label>
          <label>W&nbsp;(write) <input type="range" min={1} max={n} value={W} onChange={(e) => setW(+e.target.value)} /><b>{W}</b></label>
        </div>

        <div className="quo-stage">
          <svg viewBox="0 0 260 260" width={260} height={260} className="quo-ring">
            <circle cx={CX} cy={CY} r={RAD} className="quo-orbit" />
            {Array.from({ length: n }, (_, i) => {
              const p = nodePos(i);
              const inW = writeSet.has(i), inR = readSet.has(i), both = shared.has(i);
              const cls = both ? 'both' : inW ? 'w' : inR ? 'r' : '';
              return (
                <g key={i}>
                  <circle cx={p.x} cy={p.y} r={19} className={`quo-node ${cls}`} />
                  <text x={p.x} y={p.y + 4} className="quo-nlabel" textAnchor="middle">{i}</text>
                  {both && <text x={p.x} y={p.y - 26} className="quo-star" textAnchor="middle">★</text>}
                </g>
              );
            })}
          </svg>

          <div className="quo-readout">
            <div className={`quo-ineq ${a.strongRead ? 'on' : 'off'}`}>
              <code>R + W &gt; N</code><span>{R} + {W} {a.strongRead ? '>' : '≤'} {n}</span>
              <em>{a.strongRead ? 'reads always see the latest write' : 'a read can miss a recent write'}</em>
            </div>
            <div className={`quo-ineq ${a.writeConflictFree ? 'on' : 'off'}`}>
              <code>2W &gt; N</code><span>{2 * W} {a.writeConflictFree ? '>' : '≤'} {n}</span>
              <em>{a.writeConflictFree ? 'two writes always overlap → one order' : 'concurrent writes can diverge'}</em>
            </div>
            <div className="quo-overlap">guaranteed read∩write overlap: <b>{a.overlap}</b> node{a.overlap === 1 ? '' : 's'}</div>
            <div className="quo-profile">{a.profile}</div>
          </div>
        </div>

        <div className="quo-legend">
          <span><i className="quo-node w" /> write set (W)</span>
          <span><i className="quo-node r" /> read set (R)</span>
          <span><i className="quo-node both" /> ★ shared — holds the latest write</span>
        </div>

        <p className="quo-foot">
          This is why Cassandra/DynamoDB let you choose per-operation: <code>R=1,W=N</code> for fast reads, <code>R=N,W=1</code> for
          fast writes, <code>R=W=⌈(N+1)/2⌉</code> (majority) for strong consistency with one node down. Drop below
          <code> R+W&gt;N</code> and you’re in eventual consistency — fast, but a read can return stale data until anti-entropy and
          read-repair catch up.
        </p>
      </section>
    </div>
  );
}
