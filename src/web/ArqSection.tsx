// ARQ retransmission — Go-Back-N vs Selective Repeat on the same dropped frame.
// Both windows slide; the difference is the receiver. Drag which frame is lost and
// watch GBN throw away and resend everything after the gap, while Selective Repeat
// buffers and resends only the hole. Deterministic model from arq.ts (tested).
import { useState } from 'react';
import { simulate, wasted, type ArqRun, type Slot } from './arq';

const OUT: Record<Slot['outcome'], { sym: string; cls: string }> = {
  acked: { sym: '✓', cls: 'ok' },
  lost: { sym: '✗', cls: 'lost' },
  discarded: { sym: '⌫', cls: 'disc' },
  buffered: { sym: '▣', cls: 'buf' },
  resent: { sym: '↻', cls: 'resent' },
};

function Timeline({ run }: { run: ArqRun }) {
  const p1 = run.slots.filter((s) => s.pass === 1);
  const p2 = run.slots.filter((s) => s.pass === 2);
  return (
    <div className="arq-tl">
      <div className="arq-tl-row">
        {p1.map((s, i) => <Cell key={i} s={s} />)}
        <div className="arq-timeout">⏱ timeout</div>
        {p2.map((s, i) => <Cell key={`r${i}`} s={s} />)}
      </div>
    </div>
  );
}
const Cell = ({ s }: { s: Slot }) => (
  <div className={`arq-cell ${OUT[s.outcome].cls}`} title={s.outcome}>
    <span className="arq-fn">{s.frame}</span><span className="arq-sym">{OUT[s.outcome].sym}</span>
  </div>
);

export function ArqSection() {
  const [n, setN] = useState(6);
  const [lost, setLost] = useState(2);
  const L = Math.min(lost, n - 1);
  const gbn = simulate(n, L, 'GBN');
  const sr = simulate(n, L, 'SR');

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>ARQ — recovering a lost frame two ways</h2></div>
        <p className="jsec-sub">
          Reliable transport numbers frames and slides a window. When frame <strong>{L}</strong> is dropped, the two classic
          strategies pay very differently — because their <em>receivers</em> behave differently. Drag the loss and compare.
        </p>
        <div className="arq-controls">
          <label>frames: {n}<input type="range" min={4} max={10} value={n} onChange={(e) => { setN(Number(e.target.value)); }} /></label>
          <label>drop frame #: {L}<input type="range" min={0} max={n - 1} value={L} onChange={(e) => setLost(Number(e.target.value))} /></label>
        </div>

        <div className="arq-proto">
          <div className="arq-proto-h"><strong>Go-Back-N</strong> — receiver window = 1; cumulative ACKs</div>
          <Timeline run={gbn} />
          <div className="arq-stat">sent <strong>{gbn.total}</strong> frames · <strong>{gbn.retransmits}</strong> retransmitted · <strong>{wasted(gbn)}</strong> discarded by the receiver (wasted)</div>
        </div>

        <div className="arq-proto">
          <div className="arq-proto-h"><strong>Selective Repeat</strong> — receiver window = N; per-frame ACKs</div>
          <Timeline run={sr} />
          <div className="arq-stat">sent <strong>{sr.total}</strong> frames · <strong>{sr.retransmits}</strong> retransmitted · <strong>0</strong> discarded (the rest were buffered)</div>
        </div>

        <div className="arq-legend">
          <span className="arq-cell ok"><span className="arq-sym">✓</span></span> acked
          <span className="arq-cell lost"><span className="arq-sym">✗</span></span> lost
          <span className="arq-cell disc"><span className="arq-sym">⌫</span></span> discarded (GBN)
          <span className="arq-cell buf"><span className="arq-sym">▣</span></span> buffered (SR)
          <span className="arq-cell resent"><span className="arq-sym">↻</span></span> resent
        </div>

        <p className="arq-note">
          Go-Back-N keeps the receiver trivially simple (no buffering, one expected frame) but wastes the wire: a single loss forces
          re-sending the whole window. Selective Repeat adds receiver buffering and per-frame ACKs to resend only the gap — far more
          efficient on lossy or high-latency links, which is why it underlies modern transports. TCP’s SACK option is the same idea
          bolted onto cumulative ACKs.
        </p>
      </section>
    </div>
  );
}
