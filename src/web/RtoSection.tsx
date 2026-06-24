// TCP's retransmit timeout, made visible. Send packets to feed RTT samples and watch
// SRTT track the mean while the RTO sits a few RTTVAR above it as the deadline. Drop a
// packet and the RTO doubles (backoff) without taking a sample from the ambiguous
// retransmit — Karn's algorithm. Real RFC 6298 math (rto.ts, tested).
import { useState } from 'react';
import { measure, type RtoState } from './rto';

interface Pt { i: number; rtt: number | null; srtt: number; rto: number; lost: boolean }

export function RtoSection() {
  const [base, setBase] = useState(120);
  const [st, setSt] = useState<RtoState | null>(null);
  const [hist, setHist] = useState<Pt[]>([]);

  const push = (rtt: number | null, ns: RtoState, lost: boolean) =>
    setHist((h) => [...h, { i: h.length, rtt, srtt: ns.srtt, rto: ns.rto, lost }].slice(-22));

  const send = () => {
    const rtt = Math.max(5, Math.round(base + (Math.random() * 2 - 1) * (base * 0.35)));
    const ns = measure(st, rtt, false); setSt(ns); push(rtt, ns, false);
  };
  const lose = () => { if (!st) return; const ns = measure(st, 0, true); setSt(ns); push(null, ns, true); };
  const reset = () => { setSt(null); setHist([]); };

  const W = 560, H = 200, padL = 40, padB = 22, padT = 10;
  const maxY = Math.max(...hist.flatMap((p) => [p.rto, p.rtt ?? 0]), base * 3, 1) * 1.05;
  const x = (i: number) => padL + (hist.length <= 1 ? 0 : (i / (hist.length - 1)) * (W - padL - 10));
  const y = (v: number) => H - padB - (v / maxY) * (H - padB - padT);
  const line = (sel: (p: Pt) => number) => hist.map((p) => `${x(p.i)},${y(sel(p))}`).join(' ');

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>TCP retransmit timeout — RTO = SRTT + 4·RTTVAR</h2></div>
        <p className="jsec-sub">
          A fixed timeout can’t work: too short and TCP retransmits needlessly, too long and it stalls on a real loss. So TCP tracks a
          smoothed RTT and its variation, and parks the <strong>RTO</strong> a few RTTVAR above the mean. Send packets to feed
          samples, then drop one to see the backoff.
        </p>

        <div className="rto-controls">
          <label>path RTT ≈ {base} ms<input type="range" min={20} max={400} value={base} onChange={(e) => setBase(Number(e.target.value))} /></label>
          <button onClick={send}>✉ send packet</button>
          <button className="rto-loss" onClick={lose} disabled={!st}>💥 packet lost</button>
          <button className="rto-ghost" onClick={reset} disabled={!hist.length}>↺ reset</button>
        </div>

        {st && (
          <div className="rto-stats">
            <span>SRTT <strong>{st.srtt.toFixed(0)} ms</strong></span>
            <span>RTTVAR <strong>{st.rttvar.toFixed(0)} ms</strong></span>
            <span>raw RTO <strong>{st.rawRto.toFixed(0)} ms</strong></span>
            <span className="rto-eff">effective RTO <strong>{st.rto.toFixed(0)} ms</strong> (≥1s floor)</span>
          </div>
        )}

        <svg className="rto-chart" viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W }}>
          <line x1={padL} y1={H - padB} x2={W - 10} y2={H - padB} className="rto-axis" />
          {hist.length > 1 && <>
            <polyline points={line((p) => p.rto)} className="rto-rto" />
            <polyline points={line((p) => p.srtt)} className="rto-srtt" />
          </>}
          {hist.map((p) => p.rtt !== null
            ? <circle key={p.i} cx={x(p.i)} cy={y(p.rtt)} r={3} className="rto-sample" />
            : <text key={p.i} x={x(p.i)} y={y(0) - 4} className="rto-lost">✕</text>)}
          <text x={4} y={y(maxY) + 8} className="rto-ylab">{Math.round(maxY)}ms</text>
          {hist.length > 1 && <>
            <text x={x(hist.length - 1)} y={y(hist[hist.length - 1].rto) - 5} className="rto-leg rto">RTO</text>
            <text x={x(hist.length - 1)} y={y(hist[hist.length - 1].srtt) + 12} className="rto-leg srtt">SRTT</text>
          </>}
        </svg>

        <p className="rto-foot">
          Watch the RTO ride above the samples — wide when the path is jittery, tight when it’s steady (RTTVAR collapses). On a loss,
          <strong> Karn’s algorithm</strong> refuses to sample the retransmit (you can’t tell which copy the ACK answered) and instead
          <strong> doubles the RTO</strong> until a clean ACK arrives — the same exponential backoff that keeps a congested network
          from collapsing. The 1-second floor is why a single drop on a fast LAN still costs a noticeable pause.
        </p>
      </section>
    </div>
  );
}
