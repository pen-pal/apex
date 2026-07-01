// The fast inverse square root, made visible. Pick x and watch its float bits become an integer, get shifted and
// subtracted from the magic constant, and reinterpret back into an astonishingly good guess for 1/sqrt(x) — then
// one Newton step polishes it. The error meter shows the bit hack alone (~3.4%) collapsing to ~0.17%. Real logic
// from fastinvsqrt.ts.
import { useMemo, useState } from 'react';
import { MAGIC, bitsOf, fields, fastInvSqrt } from './fastinvsqrt';

const hex = (n: number) => '0x' + (n >>> 0).toString(16).padStart(8, '0');
const bin = (n: number, w: number) => (n >>> 0).toString(2).padStart(32, '0').slice(-w);

export function FastInvSqrtSection() {
  const [x, setX] = useState(2);
  const r = useMemo(() => fastInvSqrt(x, 2), [x]);
  const i = bitsOf(x);
  const shifted = i >>> 1;
  const magicked = (MAGIC - shifted) >>> 0;
  const f = fields(x);

  const iters = [
    { label: 'bit hack only', value: r.steps[0], err: Math.abs(r.steps[0] - r.trueValue) / r.trueValue },
    { label: '+ 1 Newton step', value: r.steps[1], err: Math.abs(r.steps[1] - r.trueValue) / r.trueValue },
    { label: '+ 2 Newton steps', value: r.steps[2], err: Math.abs(r.steps[2] - r.trueValue) / r.trueValue },
  ];

  return (
    <div className="fis">
      <p className="fis-intro">
        3D graphics normalizes millions of vectors a second, and every one needs <strong>1/√x</strong>. In 1999 a
        hardware square root was slow, so Quake III computed it with no <code>sqrt</code> and no division — just
        one integer subtraction and a refinement step. The trick: a float's raw bits, read as an integer, are
        almost exactly a scaled <strong>log₂(x)</strong>, so halving and negating that integer computes
        <strong> x<sup>−1/2</sup></strong> in log space.
      </p>

      <div className="fis-input">
        <label>x = <b>{x}</b></label>
        <input type="range" min={0.1} max={100} step={0.1} value={x} onChange={(e) => setX(+e.target.value)} />
        <span className="fis-true">1/√x = <b>{r.trueValue.toFixed(6)}</b></span>
      </div>

      <div className="fis-bits">
        <span className="fis-bl">float32 bits of x:</span>
        <span className="fis-bitrow">
          <span className="fis-field sign" title="sign">{bin(f.sign, 1)}</span>
          <span className="fis-field exp" title={`exponent ${f.exponent} (bias 127 → 2^${f.exponent - 127})`}>{bin(f.exponent, 8)}</span>
          <span className="fis-field man" title={`mantissa ${f.mantissa}`}>{bin(f.mantissa, 23)}</span>
        </span>
        <span className="fis-legend"><b className="sign">sign</b> · <b className="exp">exponent = int part of log₂</b> · <b className="man">mantissa ≈ frac part</b></span>
      </div>

      <div className="fis-code">
        <div className="fis-line"><span className="fis-c">i = *(int*)&amp;x;</span><span className="fis-v">i = {hex(i)}  (the bits as an integer ≈ log₂ x)</span></div>
        <div className="fis-line"><span className="fis-c">i = 0x5f3759df - (i &gt;&gt; 1);</span><span className="fis-v">{hex(MAGIC)} − {hex(shifted)} = {hex(magicked)}</span></div>
        <div className="fis-line"><span className="fis-c">y = *(float*)&amp;i;</span><span className="fis-v">y = {r.guess.toFixed(6)}  ← already this close</span></div>
        <div className="fis-line"><span className="fis-c">y = y*(1.5 - 0.5*x*y*y);</span><span className="fis-v">y = {r.steps[1].toFixed(6)}  (one Newton step)</span></div>
      </div>

      <div className="fis-iters">
        {iters.map((it) => (
          <div key={it.label} className={`fis-iter ${it.err < 0.01 ? 'good' : ''}`}>
            <span className="fis-il">{it.label}</span>
            <span className="fis-iv">{it.value.toFixed(6)}</span>
            <div className="fis-bar"><div className="fis-fill" style={{ width: `${Math.min(100, it.err * 100 * 12)}%` }} /></div>
            <span className="fis-ie">{(it.err * 100).toFixed(it.err < 0.001 ? 4 : 2)}% error</span>
          </div>
        ))}
      </div>

      <p className="fis-foot">
        The magic constant isn't magic — it's arithmetic. Writing x = 2<sup>e</sup>(1+m), its integer bit pattern is
        (E + e)·2²³ + m·2²³ where E=127 is the exponent bias, and that quantity is a piecewise-linear approximation
        of 2²³·(log₂x + 127). You want log₂(1/√x) = −½·log₂x, so you compute −(i≫1) — the shift halves the log, the
        minus negates it — and then add back a constant to fix the bias the shift mangled and to re-center the
        mantissa's linear fit. Optimizing that constant to minimize the worst-case error gives 0x5f3759df (Chris
        Lomont later showed 0x5f375a86 is very slightly better). The remaining ~3.4% is cleaned up by Newton-
        Raphson on f(y) = 1/y² − x, whose update happens to need only multiplies — no division — so the whole thing
        is a handful of cheap integer and float ops. Today it's a historical curiosity: since ~2003, SSE's
        <code> rsqrtss</code> instruction does this in hardware in one cycle, more accurately. But it remains the
        canonical example of the deepest trick in low-level programming — that a float's bits <em>are</em> a
        number you can do useful arithmetic on. (Quake III, 1999; Lomont 2003.)
      </p>
    </div>
  );
}
