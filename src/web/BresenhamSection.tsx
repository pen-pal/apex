// Bresenham, made visible. Click anywhere on the grid to set the line's endpoint and watch the algorithm light up
// exactly the pixels closest to the true line — the staircase — using only integer add/subtract/compare. The
// faint diagonal is the real line the algorithm never actually computes. Real logic from bresenham.ts.
import { useMemo, useState } from 'react';
import { bresenham } from './bresenham';

const COLS = 24, ROWS = 15, CELL = 22, START: [number, number] = [3, 11];

export function BresenhamSection() {
  const [end, setEnd] = useState<[number, number]>([20, 3]);
  const pixels = useMemo(() => bresenham(START[0], START[1], end[0], end[1]), [end]);
  const lit = useMemo(() => new Set(pixels.map((p) => `${p.x},${p.y}`)), [pixels]);

  const W = COLS * CELL, H = ROWS * CELL;
  const cx = (x: number) => x * CELL + CELL / 2;
  const cy = (y: number) => y * CELL + CELL / 2;
  const ySteps = pixels.filter((p, i) => i > 0 && p.y !== pixels[i - 1].y).length;

  const onClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(COLS - 1, Math.floor(((e.clientX - r.left) / r.width) * COLS)));
    const y = Math.max(0, Math.min(ROWS - 1, Math.floor(((e.clientY - r.top) / r.height) * ROWS)));
    setEnd([x, y]);
  };

  return (
    <div className="brz">
      <p className="brz-intro">
        To draw a line on a pixel grid, the obvious method computes <code>y = y₀ + slope·(x−x₀)</code> and rounds —
        a floating-point multiply and a round at every pixel. Bresenham instead tracks one integer
        <strong> error term</strong> and asks a single yes/no question per step, updating with only additions and
        comparisons. It lights up the <em>exact same pixels</em> with <strong>no multiply, divide, float, or
        round</strong>. Click the grid to move the endpoint.
      </p>

      <svg viewBox={`0 0 ${W} ${H}`} className="brz-grid" onClick={onClick}>
        {Array.from({ length: ROWS }, (_, r) => Array.from({ length: COLS }, (_, c) => (
          <rect key={`${r}-${c}`} x={c * CELL} y={r * CELL} width={CELL} height={CELL} className={`brz-cell ${lit.has(`${c},${r}`) ? 'lit' : ''}`} />
        )))}
        <line x1={cx(START[0])} y1={cy(START[1])} x2={cx(end[0])} y2={cy(end[1])} className="brz-line" />
        <circle cx={cx(START[0])} cy={cy(START[1])} r={5} className="brz-start" />
        <circle cx={cx(end[0])} cy={cy(end[1])} r={5} className="brz-end" />
      </svg>

      <div className="brz-stats">
        <div className="brz-stat"><span>pixels drawn</span><b>{pixels.length}</b></div>
        <div className="brz-stat"><span>minor-axis steps</span><b>{ySteps}</b><small>the staircase’s risers</small></div>
        <div className="brz-stat good"><span>multiplies · divides · floats</span><b>0 · 0 · 0</b><small>integer add/compare only</small></div>
      </div>

      <p className="brz-foot">
        Watch the error term work: as you sweep along the major axis, each step subtracts the minor delta from the
        error; when the error would cross zero, the line has drifted a full pixel and the algorithm takes one step
        in the minor axis and adds the major delta back — that's a riser in the staircase. Because every quantity
        stays an integer, there's no rounding drift to accumulate and the two endpoints are always hit exactly. The
        same accumulate-and-correct idea generalizes directly: swap the linear error for one based on the circle
        equation x²+y²=r² and you get Bresenham's <em>circle</em> algorithm, still integer-only; the midpoint line
        and ellipse algorithms are the same trick reframed. It's also the discrete cousin of the DDA (digital
        differential analyzer), which does use floating point — Bresenham is what you reach for when every cycle
        counts, which in 1962 was always and on a GPU rasterizing billions of pixels is again. The deeper lesson is
        one you'll see across systems: replacing a per-step multiply-and-round with an incrementally-maintained
        integer accumulator is one of the most reliable ways to make a hot loop fast and exact. (Bresenham, IBM
        Systems Journal, 1965.)
      </p>
    </div>
  );
}
