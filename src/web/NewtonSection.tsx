// Newton's method, made visible. Pick a function and step the iteration: at each guess the tangent line
// is drawn, and where it crosses zero becomes the next guess — visibly homing in on the root. The error
// table shows the quadratic convergence, the number of correct digits roughly doubling each step. Real
// iteration from newton.ts.
import { useMemo, useState } from 'react';
import { newton, FUNCTIONS } from './newton';

export function NewtonSection() {
  const [key, setKey] = useState('√2  (x²−2)');
  const [step, setStep] = useState(0);
  const fn = FUNCTIONS[key];

  const steps = useMemo(() => newton(fn.f, fn.fprime, fn.x0, 8, fn.root), [fn]);
  const cur = steps[Math.min(step, steps.length - 1)];

  const xmin = Math.min(fn.x0, fn.root) - 0.9, xmax = Math.max(fn.x0, fn.root) + 0.9;
  const ys = Array.from({ length: 90 }, (_, k) => fn.f(xmin + (k / 89) * (xmax - xmin)));
  const ymin = Math.min(0, ...ys) - 0.5, ymax = Math.max(0, ...ys) + 0.5;
  const W = 520, H = 240, pad = 26;
  const PX = (x: number) => pad + ((x - xmin) / (xmax - xmin)) * (W - 2 * pad);
  const PY = (y: number) => H - pad - ((y - ymin) / (ymax - ymin)) * (H - 2 * pad);
  const curve = ys.map((y, k) => `${PX(xmin + (k / 89) * (xmax - xmin)).toFixed(1)},${PY(y).toFixed(1)}`).join(' ');

  // tangent at cur.x: y = f(x) + f'(x)(t - x); draw across the plot
  const tx1 = xmin, tx2 = xmax;
  const ty = (t: number) => cur.fx + cur.fpx * (t - cur.x);

  const pick = (k: string) => { setKey(k); setStep(0); };

  return (
    <div className="nw">
      <div className="nw-fns">
        {Object.keys(FUNCTIONS).map((k) => <button key={k} type="button" className={`nw-fn ${key === k ? 'on' : ''}`} onClick={() => pick(k)}>{k}</button>)}
      </div>

      <div className="nw-plot">
        <svg viewBox={`0 0 ${W} ${H}`} className="nw-svg">
          <line x1={pad} y1={PY(0)} x2={W - pad} y2={PY(0)} className="nw-axis" />
          <polyline points={curve} className="nw-curve" />
          {/* tangent line and the construction */}
          <line x1={PX(tx1)} y1={PY(ty(tx1))} x2={PX(tx2)} y2={PY(ty(tx2))} className="nw-tangent" />
          <line x1={PX(cur.x)} y1={PY(0)} x2={PX(cur.x)} y2={PY(cur.fx)} className="nw-drop" />
          <circle cx={PX(cur.x)} cy={PY(cur.fx)} r={4} className="nw-pt" />
          <circle cx={PX(cur.x)} cy={PY(0)} r={3.5} className="nw-xn" />
          <text x={PX(cur.x)} y={PY(0) + 16} className="nw-lbl">x{cur.i}</text>
          {Number.isFinite(cur.next) && cur.next >= xmin && cur.next <= xmax && (
            <>
              <circle cx={PX(cur.next)} cy={PY(0)} r={4} className="nw-next" />
              <text x={PX(cur.next)} y={PY(0) + 16} className="nw-lbl next">x{cur.i + 1}</text>
            </>
          )}
          <circle cx={PX(fn.root)} cy={PY(0)} r={3} className="nw-root" />
        </svg>
      </div>

      <div className="nw-steps">
        <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>◀</button>
        <button type="button" className="primary" onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))} disabled={step >= steps.length - 1}>step ▶</button>
        <button type="button" onClick={() => setStep(0)} disabled={step === 0}>reset</button>
        <span className="nw-now">x{cur.i} = {cur.x.toFixed(8)} → x{cur.i + 1} = {cur.next.toFixed(8)}</span>
      </div>

      <div className="nw-table">
        <div className="nw-table-h">convergence — error to the true root (≈ {fn.root.toFixed(8)})</div>
        <table>
          <thead><tr><th>n</th><th>xₙ</th><th>error</th><th>correct digits</th></tr></thead>
          <tbody>
            {steps.slice(0, 7).map((s) => {
              const digits = s.error > 0 ? Math.max(0, Math.floor(-Math.log10(s.error))) : 15;
              return (
                <tr key={s.i} className={s.i === step ? 'on' : ''}>
                  <td>{s.i}</td><td>{s.x.toFixed(10)}</td><td>{s.error.toExponential(2)}</td>
                  <td><div className="nw-digbar" style={{ width: `${Math.min(15, digits) * 8}px` }} />{Math.min(15, digits)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="nw-foot">
        Each step replaces the curve with its tangent and solves that exactly — and because a smooth function looks like its tangent up close,
        the next guess is dramatically better: the error squares, so two correct digits become four, then eight, then sixteen. That’s why it
        underlies fast <code>sqrt</code>, division, and reciprocal routines, and optimizers (Newton’s method on the gradient finds where the slope
        is zero). The flip side is fragility: if <strong>f′ is near zero</strong>, the tangent is nearly flat and the next guess flies far away;
        a bad start can land in a cycle or diverge. Production solvers keep the speed but add a safety net — bracket the root and fall back to
        <em> bisection</em> when a Newton step misbehaves. (Newton-Raphson.)
      </p>
    </div>
  );
}
