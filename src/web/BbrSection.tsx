// TCP BBR, made visible. Pick a link (bandwidth, RTT, buffer) and compare two flows on it:
// BBR holds inflight at one BDP so the bottleneck buffer stays empty and latency equals the
// propagation delay, while a loss-based flow fills the buffer (bufferbloat) before it backs
// off — both get full throughput, but their latency differs sharply. The STARTUP probe is
// shown doubling until it finds the bottleneck bandwidth. Real model in bbr.ts (tested).
import { useMemo, useState } from 'react';
import { bdpKB, bbrSteady, lossBasedSteady, startup, type Link } from './bbr';

export function BbrSection() {
  const [bw, setBw] = useState(100);
  const [rtt, setRtt] = useState(40);
  const [buf, setBuf] = useState(250);
  const link: Link = { btlBwMbps: bw, rtPropMs: rtt, bufferKB: buf };

  const bdp = useMemo(() => bdpKB(link), [link]);
  const bbr = useMemo(() => bbrSteady(link), [link]);
  const loss = useMemo(() => lossBasedSteady(link), [link]);
  const su = useMemo(() => startup(link), [link]);

  const maxRtt = Math.max(bbr.rttMs, loss.rttMs) * 1.05;

  const flow = (name: string, f: typeof bbr, cls: string, note: string) => (
    <div className={`bbr-flow ${cls}`}>
      <div className="bbr-flow-head"><b>{name}</b><span>{Math.round(f.throughputMbps)} Mbps · {f.rttMs.toFixed(1)} ms RTT</span></div>
      <div className="bbr-bar"><div className="bbr-bar-fill" style={{ width: `${(f.rttMs / maxRtt) * 100}%` }} />
        <span className="bbr-bar-prop" style={{ left: `${(rtt / maxRtt) * 100}%` }} title="propagation delay" /></div>
      <div className="bbr-flow-note">inflight {f.inflightKB.toFixed(0)} KB · queue {f.queueKB.toFixed(0)} KB — {note}</div>
    </div>
  );

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>TCP BBR — fill the pipe, not the buffer</h2></div>
        <p className="jsec-sub">
          Loss-based controllers (Reno, CUBIC) treat a full buffer as the signal to slow down — so they keep the buffer <em>full</em>,
          adding delay for everyone (bufferbloat). BBR instead measures the bottleneck bandwidth and the minimum RTT, and keeps just one
          <strong> BDP</strong> in flight: enough to saturate the link, little enough that the buffer stays empty. Same throughput, far
          lower latency.
        </p>

        <div className="bbr-controls">
          <label>bandwidth <input type="range" min={10} max={1000} step={10} value={bw} onChange={(e) => setBw(+e.target.value)} /><b>{bw} Mbps</b></label>
          <label>RTprop <input type="range" min={5} max={200} value={rtt} onChange={(e) => setRtt(+e.target.value)} /><b>{rtt} ms</b></label>
          <label>buffer <input type="range" min={50} max={1000} step={10} value={buf} onChange={(e) => setBuf(+e.target.value)} /><b>{buf} KB</b></label>
        </div>
        <div className="bbr-bdp">BDP = bandwidth × RTprop = <b>{bdp.toFixed(0)} KB</b> — BBR’s inflight target</div>

        {flow('BBR', bbr, 'good', 'buffer stays empty → latency = propagation delay')}
        {flow('Loss-based (CUBIC/Reno)', loss, 'bad', 'buffer full before backoff → +queueing delay')}
        <div className="bbr-axis"><span>0</span><span className="bbr-axis-prop" style={{ left: `${(rtt / maxRtt) * 100}%` }}>RTprop</span><span style={{ float: 'right' }}>{maxRtt.toFixed(0)} ms</span></div>

        <div className="bbr-startup">
          <h3>STARTUP — finding the bottleneck bandwidth</h3>
          <div className="bbr-su-row">
            {su.map((r) => (
              <div key={r.round} className={`bbr-su-cell ${r.plateau ? 'plateau' : ''}`}>
                <div className="bbr-su-bar" style={{ height: `${(r.estBwMbps / bw) * 100}%` }} />
                <span>{Math.round(r.estBwMbps)}</span>
              </div>
            ))}
          </div>
          <div className="bbr-su-note">delivery-rate estimate (Mbps) doubles each round until it plateaus at {bw} Mbps — that’s BtlBw; BBR then drains the queue it built.</div>
        </div>

        <p className="bbr-foot">
          BBR cycles through PROBE_BW (briefly speeding up to 1.25× to check for more bandwidth, then 0.75× to drain) and periodically
          PROBE_RTT (cutting inflight to re-measure the true minimum RTT). Because it ignores loss as a signal, it keeps throughput up on
          lossy paths (long-haul, wireless) where CUBIC collapses — but early BBRv1 could be unfair to loss-based flows sharing a link,
          which BBRv2/v3 work to fix. It’s deployed across Google, YouTube, and increasingly the wider internet.
        </p>
      </section>
    </div>
  );
}
