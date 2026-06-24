// Elliptic curves you can see whole. The toy curve has only 18 points, so the
// entire finite group fits on one grid. Walk kG and watch it hop around
// unpredictably (that's why the discrete log is hard); add two points and see the
// indices add mod the order; then run ECDH and watch both sides land on the same
// secret point. Real arithmetic from ecc.ts; teaching values only.
import { useMemo, useState } from 'react';
import { CURVE, add, mul, order, allPoints, subgroup, type Pt, type Point } from './ecc';

const ptEq = (a: Pt, b: Pt) => (a === null ? b === null : b !== null && a.x === b.x && a.y === b.y);
const show = (p: Pt) => (p === null ? 'O (∞)' : `(${p.x}, ${p.y})`);

interface Mark { p: Pt; cls: string; label: string }

function CurvePlot({ marks }: { marks: Mark[] }) {
  const pts = useMemo(() => allPoints(CURVE), []);
  const N = CURVE.p, cell = 17, mL = 22, mT = 8, mB = 18;
  const W = mL + N * cell + 6, H = mT + N * cell + mB;
  const cx = (x: number) => mL + x * cell + cell / 2;
  const cy = (y: number) => mT + (N - 1 - y) * cell + cell / 2;
  return (
    <svg className="ecc-plot" viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
      {Array.from({ length: N }, (_, i) => (
        <line key={`gx${i}`} x1={cx(i)} y1={mT} x2={cx(i)} y2={mT + N * cell} className="ecc-grid" />
      ))}
      {Array.from({ length: N }, (_, i) => (
        <line key={`gy${i}`} x1={mL} y1={cy(i)} x2={mL + N * cell} y2={cy(i)} className="ecc-grid" />
      ))}
      {pts.map((p, i) => <circle key={i} cx={cx(p.x)} cy={cy(p.y)} r={2.5} className="ecc-dot" />)}
      {marks.filter((m) => m.p !== null).map((m, i) => {
        const p = m.p as Point;
        return (
          <g key={i}>
            <circle cx={cx(p.x)} cy={cy(p.y)} r={6} className={`ecc-mark ${m.cls}`} />
            <text x={cx(p.x)} y={cy(p.y) - 9} className={`ecc-lab ${m.cls}`}>{m.label}</text>
          </g>
        );
      })}
      <text x={2} y={cy(0) + 3} className="ecc-axis">0</text>
      <text x={cx(0) - 2} y={H - 5} className="ecc-axis">0</text>
      <text x={cx(N - 1) - 4} y={H - 5} className="ecc-axis">{N - 1}</text>
    </svg>
  );
}

export function EccSection() {
  const ord = useMemo(() => order(CURVE), []);
  const sg = useMemo(() => subgroup(CURVE), []); // sg[k] = kG, sg[0] = O
  const [k, setK] = useState(5);
  const [k1, setK1] = useState(3);
  const [k2, setK2] = useState(5);
  const [a, setA] = useState(6);
  const [b, setB] = useState(13);

  const kSteps = useMemo(() => mul(k, CURVE.G, CURVE).steps, [k]);

  // panel 2: adding points adds indices mod order
  const Pp = sg[k1 % ord], Qp = sg[k2 % ord];
  const R = add(Pp, Qp, CURVE);
  const sumIdx = (k1 + k2) % ord;

  // panel 3: ECDH
  const A = sg[a % ord], B = sg[b % ord];
  const sharedA = mul(a, B, CURVE).point;
  const sharedB = mul(b, A, CURVE).point;

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>① The whole group on one grid</h2></div>
        <p className="jsec-sub">
          The curve <code>y² = x³ + 2x + 2 (mod 17)</code> has just <strong>{allPoints(CURVE).length} points</strong> plus the point
          at infinity O — order <strong>{ord}</strong>. Drag k and watch <strong>kG</strong> hop around: computing kG from k is
          easy (double-and-add), but recovering k from where the dot landed is the <em>elliptic-curve discrete log</em> — the hard
          problem all of ECC stands on.
        </p>
        <div className="ecc-stage">
          <CurvePlot marks={[{ p: CURVE.G, cls: 'g', label: 'G' }, { p: sg[k], cls: 'k', label: `${k}G` }]} />
          <div className="ecc-side">
            <label className="ecc-slider">k = {k}
              <input type="range" min={1} max={ord - 1} value={k} onChange={(e) => setK(Number(e.target.value))} /></label>
            <div className="ecc-readout"><strong>{k}G</strong> = {show(sg[k])}</div>
            <div className="ecc-trace">
              double-and-add ({k.toString(2)}):
              <div className="ecc-chips">
                {kSteps.map((s, i) => <span key={i} className={`ecc-chip ${s.op === 'double+add' ? 'add' : ''}`}>{s.op === 'double+add' ? '2×+G' : '2×'} → {show(s.point)}</span>)}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="jsec">
        <div className="jsec-head"><h2>② Adding points adds their indices</h2></div>
        <p className="jsec-sub">
          The chord-and-tangent rule makes the points a cyclic group: <code>(k₁G) + (k₂G) = (k₁+k₂)G</code> (mod the order). Pick two
          multiples and confirm the sum lands exactly on index k₁+k₂.
        </p>
        <div className="ecc-stage">
          <CurvePlot marks={[{ p: Pp, cls: 'p', label: `${k1}G` }, { p: Qp, cls: 'q', label: `${k2}G` }, { p: R, cls: 'r', label: 'P+Q' }]} />
          <div className="ecc-side">
            <label className="ecc-slider">k₁ = {k1}<input type="range" min={1} max={ord - 1} value={k1} onChange={(e) => setK1(Number(e.target.value))} /></label>
            <label className="ecc-slider">k₂ = {k2}<input type="range" min={1} max={ord - 1} value={k2} onChange={(e) => setK2(Number(e.target.value))} /></label>
            <div className="ecc-readout">{k1}G + {k2}G = {show(R)}</div>
            <div className="ecc-readout small">= {sumIdx === 0 ? 'O' : `${sumIdx}G`} = {show(sg[sumIdx])} {ptEq(R, sg[sumIdx]) ? '✓' : '✗'}</div>
          </div>
        </div>
      </section>

      <section className="jsec">
        <div className="jsec-head"><h2>③ ECDH — a shared secret over an open wire</h2></div>
        <p className="jsec-sub">
          Alice keeps a, Bob keeps b. They swap public points A = aG and B = bG, then each multiplies by their own secret:
          a·B = b·A = (ab)G. An eavesdropper sees G, A and B but would need the discrete log to find a or b — so the shared point
          stays secret. This is the same security as far larger RSA keys, with ~256-bit keys.
        </p>
        <div className="ecc-stage">
          <CurvePlot marks={[{ p: CURVE.G, cls: 'g', label: 'G' }, { p: A, cls: 'p', label: 'A=aG' }, { p: B, cls: 'q', label: 'B=bG' }, { p: sharedA, cls: 'r', label: 'shared' }]} />
          <div className="ecc-side">
            <label className="ecc-slider">Alice a = {a}<input type="range" min={1} max={ord - 1} value={a} onChange={(e) => setA(Number(e.target.value))} /></label>
            <label className="ecc-slider">Bob b = {b}<input type="range" min={1} max={ord - 1} value={b} onChange={(e) => setB(Number(e.target.value))} /></label>
            <div className="ecc-readout">A = aG = {show(A)} · B = bG = {show(B)}</div>
            <div className={`ecc-shared ${ptEq(sharedA, sharedB) ? 'good' : 'bad'}`}>
              a·B = {show(sharedA)} &nbsp;=&nbsp; b·A = {show(sharedB)}<br />
              🔑 shared secret = x-coord <strong>{sharedA === null ? '—' : (sharedA as Point).x}</strong>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
