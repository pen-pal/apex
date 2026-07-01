// Marching squares, made visible. A scalar field from three "metaball" sources; each grid point is dotted green
// (above the threshold) or faint (below). Marching squares weaves the contour between them, cell by cell, cutting
// each edge exactly where the field crosses the threshold. Slide the threshold and watch the blobs grow, merge,
// and split. Real logic from marchingsquares.ts.
import { useMemo, useState } from 'react';
import { metaballField, marchingSquares, type Blob } from './marchingsquares';

const COLS = 40, ROWS = 26, CELL = 13;
const BLOBS: Blob[] = [{ x: 12, y: 12, r: 6 }, { x: 26, y: 10, r: 6.5 }, { x: 20, y: 19, r: 5.5 }];

export function MarchSquaresSection() {
  const [threshold, setThreshold] = useState(1.0);
  const field = useMemo(() => metaballField(COLS, ROWS, BLOBS), []);
  const segs = useMemo(() => marchingSquares(field, threshold), [field, threshold]);

  const W = (COLS - 1) * CELL, H = (ROWS - 1) * CELL;
  const sx = (x: number) => x * CELL, sy = (y: number) => y * CELL;

  return (
    <div className="msq">
      <p className="msq-intro">
        A <strong>scalar field</strong> is just a number at every grid point (here, summed "density" from three
        sources). To draw the <strong>contour</strong> where the field equals a threshold, marching squares looks
        at each little square of four corners: the contour must pass between corners that disagree (one above, one
        below), and it cuts each such edge at the exact <strong>interpolated</strong> crossing. Every cell decided
        independently, the pieces join into curves. Slide the threshold:
      </p>

      <svg viewBox={`${-CELL} ${-CELL} ${W + 2 * CELL} ${H + 2 * CELL}`} className="msq-plane">
        {field.map((row, r) => row.map((v, c) => (
          <circle key={`${r}-${c}`} cx={sx(c)} cy={sy(r)} r={v >= threshold ? 2 : 1.2} className={`msq-dot ${v >= threshold ? 'above' : 'below'}`} />
        )))}
        {segs.map((s, i) => <line key={i} x1={sx(s.x1)} y1={sy(s.y1)} x2={sx(s.x2)} y2={sy(s.y2)} className="msq-seg" />)}
      </svg>

      <div className="msq-controls">
        <label>threshold <input type="range" min={0.3} max={3} step={0.05} value={threshold} onChange={(e) => setThreshold(+e.target.value)} /> <b>{threshold.toFixed(2)}</b></label>
        <div className="msq-stat"><span>contour segments</span> <b>{segs.length}</b></div>
        <span className="msq-hint">low threshold → blobs merge · high → they shrink apart</span>
      </div>

      <p className="msq-foot">
        Two details make it work. First, the <em>interpolation</em>: cutting each edge at the true crossing (a
        corner at 0.9 and one at 1.1 crosses a threshold of 1.0 dead center; 0.2 and 1.8 crosses near the low end)
        is what turns a blocky staircase into a smooth curve — without it you'd get the jagged outline of the pixel
        grid. Second, the <em>ambiguous cases</em>: when two diagonally-opposite corners are above and the other
        two below (a saddle), the contour could connect either way, and choosing wrong tears the curve; the fix is
        to check the cell's center value and pair the crossings consistently. Because every cell is judged on its
        own four corners, the whole thing is trivially parallel — perfect for a GPU — and it's the exact 2-D
        shadow of <strong>marching cubes</strong>, which runs the same idea over 8-corner cubes with a 256-entry
        case table to build the 3-D surfaces you see in every CT/MRI reconstruction and every metaball or
        fluid-surface render. The same "classify corners, look up the crossing geometry" pattern also powers
        isoline maps (weather fronts, terrain contours) and level-set methods. (Lorensen &amp; Cline, SIGGRAPH 1987.)
      </p>
    </div>
  );
}
