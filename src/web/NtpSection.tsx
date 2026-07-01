// NTP clock sync, made visible. Slide the true clock offset and the (possibly
// asymmetric) path delays and watch the four-timestamp exchange recover both the
// round-trip delay and the offset. The reveal: the server's processing time cancels,
// and the offset is EXACT whenever the path is symmetric — the only error is half the
// up/down asymmetry. Model in ntp.ts (tested).
import { useState } from 'react';
import { simulate, compute, asymmetryError } from './ntp';

export function NtpSection() {
  const [off, setOff] = useState(40);
  const [dUp, setDUp] = useState(8);
  const [dDown, setDDown] = useState(8);
  const [proc, setProc] = useState(4);

  const s = simulate(off, dUp, dDown, proc, 1000);
  const r = compute(s);
  const err = r.offset - off;

  // geometry on a true-time axis (client clock is the reference)
  const tT1 = 0, tT2 = dUp, tT3 = dUp + proc, tT4 = dUp + proc + dDown;
  const W = 540, H = 150, pad = 50, span = Math.max(tT4, 1);
  const x = (t: number) => pad + (t / span) * (W - pad - 20);
  const yC = 36, yS = H - 36;
  const dot = (t: number, y: number, label: string, val: number) => (
    <g>
      <circle cx={x(t)} cy={y} r={4} className="ntp-dot" />
      <text x={x(t)} y={y === yC ? y - 10 : y + 18} className="ntp-tlabel">{label}</text>
      <text x={x(t)} y={y === yC ? y - 22 : y + 30} className="ntp-tval">{val}</text>
    </g>
  );

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>NTP — setting your clock across an unknown network</h2></div>
        <p className="jsec-sub">
          The client stamps four times — <strong>T1</strong> send, <strong>T2</strong> server-receive, <strong>T3</strong>{' '}
          server-reply, <strong>T4</strong> client-receive — and two subtractions give the round-trip delay and the clock offset.
          The server’s own delay cancels, and the offset is exact if the path is symmetric.
        </p>

        <div className="ntp-controls">
          <label>server offset = {off}<input type="range" min={-100} max={100} value={off} onChange={(e) => setOff(Number(e.target.value))} /></label>
          <label>delay ↑ = {dUp}<input type="range" min={1} max={30} value={dUp} onChange={(e) => setDUp(Number(e.target.value))} /></label>
          <label>delay ↓ = {dDown}<input type="range" min={1} max={30} value={dDown} onChange={(e) => setDDown(Number(e.target.value))} /></label>
          <label>server proc = {proc}<input type="range" min={0} max={20} value={proc} onChange={(e) => setProc(Number(e.target.value))} /></label>
        </div>

        <svg className="ntp-tl" viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W }}>
          <line x1={pad} y1={yC} x2={W - 20} y2={yC} className="ntp-line" />
          <line x1={pad} y1={yS} x2={W - 20} y2={yS} className="ntp-line" />
          <text x={6} y={yC + 4} className="ntp-role">client</text>
          <text x={6} y={yS + 4} className="ntp-role">server</text>
          <line x1={x(tT1)} y1={yC} x2={x(tT2)} y2={yS} className="ntp-arrow" markerEnd="url(#ah)" />
          <line x1={x(tT3)} y1={yS} x2={x(tT4)} y2={yC} className="ntp-arrow" markerEnd="url(#ah)" />
          <line x1={x(tT2)} y1={yS} x2={x(tT3)} y2={yS} className="ntp-proc" />
          <defs><marker id="ah" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" className="ntp-ah" /></marker></defs>
          {dot(tT1, yC, 'T1', s.t1)}
          {dot(tT2, yS, 'T2', s.t2)}
          {dot(tT3, yS, 'T3', s.t3)}
          {dot(tT4, yC, 'T4', s.t4)}
        </svg>

        <div className="ntp-calc">
          <div className="ntp-formula">delay δ = (T4−T1) − (T3−T2) = ({s.t4}−{s.t1}) − ({s.t3}−{s.t2}) = <strong>{r.delay}</strong></div>
          <div className="ntp-formula">offset θ = ((T2−T1) + (T3−T4)) / 2 = <strong>{r.offset}</strong></div>
        </div>
        <div className={`ntp-verdict ${err === 0 ? 'ok' : 'mid'}`}>
          recovered offset <strong>{r.offset}</strong> vs true <strong>{off}</strong> →{' '}
          {err === 0
            ? 'exact — the path is symmetric, so the delay cancels perfectly.'
            : <>off by <strong>{err}</strong> = half the path asymmetry ({dUp}−{dDown})/2 = {asymmetryError(dUp, dDown)}. NTP can’t see one-way asymmetry.</>}
        </div>

        <p className="ntp-foot">
          That’s why NTP cares about <strong>symmetric</strong> routes and why it polls many servers and filters outliers — a route
          that’s faster one way than the other biases the clock by half the difference. The same four-timestamp trick (plus the proc
          cancellation you can see by dragging “server proc”) underlies PTP, which reaches sub-microsecond accuracy on LANs.
        </p>
      </section>
    </div>
  );
}
