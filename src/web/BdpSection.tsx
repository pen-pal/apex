// Bandwidth-Delay Product, made visible. Three sliders — bandwidth, RTT, window — and a
// "pipe" whose fill shows how much of the link the current window can actually use. Crank
// the bandwidth up on a high-latency link and watch throughput stay flat until you scale
// the window past the BDP. Real arithmetic in bdp.ts (tested on the 1 Gbps / 100 ms case).
import { useMemo, useState } from 'react';
import { compute, UNSCALED_MAX_KB } from './bdp';

const fmtBytes = (b: number) => b >= 1e6 ? `${(b / 1e6).toFixed(1)} MB` : b >= 1e3 ? `${(b / 1e3).toFixed(0)} KB` : `${b} B`;

export function BdpSection() {
  const [bw, setBw] = useState(1000);   // Mbps
  const [rtt, setRtt] = useState(100);  // ms
  const [winKB, setWinKB] = useState(64);

  const r = useMemo(() => compute(bw, rtt, winKB), [bw, rtt, winKB]);
  const pct = Math.round(r.utilization * 100);

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Bandwidth-Delay Product — why a fast link can be slow</h2></div>
        <p className="jsec-sub">
          To keep a pipe full you must have one round-trip of data in flight at all times: the <strong>BDP = bandwidth × RTT</strong>.
          TCP can only have one <em>window</em> of unacknowledged data outstanding, so a window smaller than the BDP caps you at
          <code> window / RTT</code> — no matter how fast the link is.
        </p>

        <div className="bdp-controls">
          <label>bandwidth <input type="range" min={10} max={10000} step={10} value={bw} onChange={(e) => setBw(+e.target.value)} /><b>{bw >= 1000 ? `${bw / 1000} Gbps` : `${bw} Mbps`}</b></label>
          <label>RTT <input type="range" min={1} max={300} value={rtt} onChange={(e) => setRtt(+e.target.value)} /><b>{rtt} ms</b></label>
          <label>window <input type="range" min={8} max={16384} step={8} value={winKB} onChange={(e) => setWinKB(+e.target.value)} /><b>{fmtBytes(winKB * 1024)}</b></label>
        </div>

        <div className="bdp-pipe">
          <div className="bdp-fill" style={{ width: `${Math.max(2, pct)}%` }} />
          <div className="bdp-pipe-label">{pct}% of link used</div>
        </div>

        <div className="bdp-stats">
          <div className="bdp-stat"><span>BDP (pipe capacity)</span><b>{fmtBytes(r.bdpBytes)}</b></div>
          <div className="bdp-stat"><span>your window</span><b>{fmtBytes(r.windowBytes)}</b></div>
          <div className="bdp-stat"><span>throughput</span><b>{r.effectiveMbps >= 1000 ? `${(r.effectiveMbps / 1000).toFixed(2)} Gbps` : `${r.effectiveMbps.toFixed(1)} Mbps`}</b></div>
          <div className={`bdp-stat ${pct >= 95 ? 'good' : pct < 25 ? 'bad' : ''}`}><span>utilization</span><b>{pct}%</b></div>
        </div>

        <div className={`bdp-verdict ${r.windowLimited ? 'bad' : 'ok'}`}>
          {r.windowLimited
            ? <>🐌 <b>Window-limited.</b> To fill this pipe you’d need a <b>{fmtBytes(r.windowNeededKB * 1024)}</b> window — {(r.windowNeededKB / winKB).toFixed(0)}× larger. The classic 64 KB un-scaled window {winKB <= UNSCALED_MAX_KB ? 'is what you have' : 'would be far too small'} here.</>
            : <>🚀 <b>Link-limited.</b> The window covers the BDP, so you’re using the full link bandwidth.</>}
        </div>

        <p className="bdp-foot">
          The original TCP window field is 16 bits → max 64 KB, which fills a pipe only up to BDP = 64 KB. On a 1 Gbps / 100 ms path the
          BDP is 12.5 MB, so 64 KB yields ~0.5% utilization. <strong>Window Scaling</strong> (RFC 7323) multiplies the window by up to
          2¹⁴, reaching gigabytes, which is why bulk transfers over satellite or intercontinental links became practical. Note throughput
          falls as RTT rises for a fixed window — distance literally costs speed.
        </p>
      </section>
    </div>
  );
}
