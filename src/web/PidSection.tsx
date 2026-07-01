// PID controller, made visible. Drag the three gains and watch a positioning system respond to a step setpoint
// against a constant load: pure P overshoots and leaves a droop; adding I closes the droop; adding D damps the
// oscillation. The setpoint, the ±2% settling band, and the response curve update live, with steady-error,
// overshoot, and settling-time metrics. Real model from pid.ts.
import { useMemo, useState } from 'react';
import { simulate } from './pid';

const SETPOINT = 10, LOAD = 2, DT = 0.05, STEPS = 400;
const PRESETS: { name: string; kp: number; ki: number; kd: number }[] = [
  { name: 'P only (droop)', kp: 3, ki: 0, kd: 0 },
  { name: 'P + I (no droop)', kp: 3, ki: 1, kd: 0 },
  { name: 'P + D (damped)', kp: 3, ki: 0, kd: 2 },
  { name: 'tuned PID', kp: 3, ki: 1, kd: 2 },
];

export function PidSection() {
  const [kp, setKp] = useState(3);
  const [ki, setKi] = useState(1);
  const [kd, setKd] = useState(2);

  const res = useMemo(() => simulate({ kp, ki, kd, setpoint: SETPOINT, load: LOAD, steps: STEPS, dt: DT }), [kp, ki, kd]);

  const W = 620, Hh = 240, PL = 34, PB = 24, PT = 10, PR = 10;
  const yMax = Math.max(SETPOINT * 1.6, Math.max(...res.series.map((s) => s.x)) * 1.05);
  const px = (t: number) => PL + (t / (STEPS - 1)) * (W - PL - PR);
  const py = (v: number) => Hh - PB - (Math.max(0, v) / yMax) * (Hh - PB - PT);
  const line = res.series.map((s) => `${px(s.t).toFixed(1)},${py(s.x).toFixed(1)}`).join(' ');
  const band = SETPOINT * 0.02;

  return (
    <div className="pidc">
      <p className="pidc-intro">
        A controller holds a process at a <strong>setpoint</strong> by adjusting a knob from the error. Here a
        positioning system must reach <b>{SETPOINT}</b> and hold it against a constant load of <b>{LOAD}</b>.
        Tune the three gains: <span className="pidc-kk p">P</span> pushes proportionally,
        <span className="pidc-kk i">I</span> accumulates to kill droop, <span className="pidc-kk d">D</span> damps
        overshoot. Try the presets, then tune by hand:
      </p>

      <div className="pidc-presets">
        {PRESETS.map((p) => <button key={p.name} type="button" className={`pidc-preset ${kp === p.kp && ki === p.ki && kd === p.kd ? 'on' : ''}`} onClick={() => { setKp(p.kp); setKi(p.ki); setKd(p.kd); }}>{p.name}</button>)}
      </div>

      <svg viewBox={`0 0 ${W} ${Hh}`} className="pidc-chart">
        <line x1={PL} y1={Hh - PB} x2={W - PR} y2={Hh - PB} className="pidc-axis" />
        <line x1={PL} y1={PT} x2={PL} y2={Hh - PB} className="pidc-axis" />
        {/* settling band */}
        <rect x={PL} y={py(SETPOINT + band)} width={W - PL - PR} height={py(SETPOINT - band) - py(SETPOINT + band)} className="pidc-band" />
        {/* setpoint */}
        <line x1={PL} y1={py(SETPOINT)} x2={W - PR} y2={py(SETPOINT)} className="pidc-setpoint" />
        <text x={W - PR} y={py(SETPOINT) - 4} className="pidc-splabel" textAnchor="end">setpoint {SETPOINT}</text>
        {/* response */}
        <polyline points={line} className="pidc-curve" />
        <text x={PL - 5} y={py(yMax * 0.9)} className="pidc-axlabel" textAnchor="end">value</text>
        <text x={W - PR} y={Hh - 6} className="pidc-axlabel" textAnchor="end">time →</text>
      </svg>

      <div className="pidc-knobs">
        {[['Kp', kp, setKp, 8, 'p'], ['Ki', ki, setKi, 5, 'i'], ['Kd', kd, setKd, 6, 'd']].map(([label, val, set, max, cls]) => (
          <label key={label as string} className={`pidc-knob ${cls}`}>
            <span>{label as string} <b>{(val as number).toFixed(1)}</b></span>
            <input type="range" min={0} max={max as number} step={0.1} value={val as number} onChange={(e) => (set as (n: number) => void)(+e.target.value)} />
          </label>
        ))}
      </div>

      <div className="pidc-stats">
        <div className={`pidc-stat ${Math.abs(res.steadyError) < 0.05 ? 'ok' : 'warn'}`}><span>steady-state error (droop)</span><b>{res.steadyError.toFixed(2)}</b></div>
        <div className={`pidc-stat ${res.overshoot < 0.5 ? 'ok' : res.overshoot > 3 ? 'bad' : 'warn'}`}><span>overshoot</span><b>{res.overshoot.toFixed(2)}</b></div>
        <div className="pidc-stat"><span>settling time (2%)</span><b>{res.settleStep >= STEPS ? '—' : (res.settleStep * DT).toFixed(1) + 's'}</b></div>
      </div>

      <p className="pidc-foot">
        The behaviours you just tuned are why PID is everywhere. <strong>Only-P</strong> is a spring: strong pull
        when far, but it can never fully arrive because holding position against the load needs a nonzero push,
        which needs a nonzero error — the droop. <strong>Add I</strong> and the accumulated error winds the output
        up until it delivers exactly the load force with zero error — but integrators overshoot and can "wind up"
        badly if the actuator saturates (real controllers clamp the integral, "anti-windup"). <strong>Add D</strong>
        and you get a shock absorber that pushes back against fast changes, taming overshoot — but it amplifies
        sensor noise, so it's usually filtered or dropped (many loops run as PI). Tuning is the craft:
        Ziegler–Nichols gives a starting recipe from the point where pure-P just begins to oscillate. The same
        loop scales up: cruise control and drones are textbook PID; TCP congestion control and BBR are feedback
        controllers on the round-trip time; and Kubernetes' autoscaler is a (mostly P) controller driving replica
        count toward a CPU setpoint — where the "plant" is a fleet of servers with minutes of lag, which is
        exactly why aggressive gains there cause the oscillation you can reproduce above. (Åström &amp; Murray;
        Ziegler–Nichols 1942.)
      </p>
    </div>
  );
}
