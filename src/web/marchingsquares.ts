// Marching squares — how you turn a grid of numbers into a smooth outline. Given a scalar FIELD sampled on a grid
// (elevation on a map, brightness in a scan, a "density" summed from a few sources) and a THRESHOLD, it draws the
// contour where the field equals that value: the coastline between above-water and below-water. The trick is
// purely local. Look at one cell — its four corners are each either above or below the threshold, giving 2^4 = 16
// possible cases. In every case the contour must enter and leave through the edges that separate an above corner
// from a below corner, and you know exactly which edges those are, so you just draw the segment(s) connecting
// them. Do that for every cell independently and the pieces join up into closed curves. For a smooth result you
// don't cut edges at their midpoints — you LINEAR-INTERPOLATE the crossing to where the field actually equals the
// threshold, so a corner at 0.9 and a corner at 1.1 crosses a threshold of 1.0 right in the middle, but 0.2 and
// 1.8 crosses much closer to the low end. It's embarrassingly parallel (each cell is independent — great for the
// GPU) and it's the 2-D sibling of MARCHING CUBES, which does the same per-cube to build 3-D surfaces from
// medical CT/MRI volumes and from metaballs in graphics. This models the field, the per-cell cases, and the
// interpolated contour segments. Reference: Lorensen & Cline, marching cubes, SIGGRAPH (1987); the 2-D case is
// folklore of the same era.

export interface Seg { x1: number; y1: number; x2: number; y2: number }
export interface Blob { x: number; y: number; r: number }

/** A metaball scalar field: each cell gets the summed 1/dist² "influence" of the blobs. field[r][c]. */
export function metaballField(cols: number, rows: number, blobs: Blob[]): number[][] {
  return Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => {
    let v = 0;
    for (const b of blobs) v += (b.r * b.r) / ((c - b.x) ** 2 + (r - b.y) ** 2 + 0.0001);
    return v;
  }));
}

/** Extract the contour at `threshold` as line segments, with linear-interpolated crossings. */
export function marchingSquares(f: number[][], threshold: number): Seg[] {
  const rows = f.length, cols = f[0].length, segs: Seg[] = [];
  const lerp = (x1: number, y1: number, v1: number, x2: number, y2: number, v2: number): [number, number] => {
    const t = (threshold - v1) / (v2 - v1);
    return [x1 + t * (x2 - x1), y1 + t * (y2 - y1)];
  };
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const tl = f[r][c], tr = f[r][c + 1], br = f[r + 1][c + 1], bl = f[r + 1][c];
      const above = (v: number) => v >= threshold;
      const pts: { x: number; y: number }[] = []; // crossings in edge order T,R,B,L
      if (above(tl) !== above(tr)) { const [x, y] = lerp(c, r, tl, c + 1, r, tr); pts.push({ x, y }); }       // top
      if (above(tr) !== above(br)) { const [x, y] = lerp(c + 1, r, tr, c + 1, r + 1, br); pts.push({ x, y }); } // right
      if (above(br) !== above(bl)) { const [x, y] = lerp(c + 1, r + 1, br, c, r + 1, bl); pts.push({ x, y }); } // bottom
      if (above(bl) !== above(tl)) { const [x, y] = lerp(c, r + 1, bl, c, r, tl); pts.push({ x, y }); }         // left
      if (pts.length === 2) {
        segs.push({ x1: pts[0].x, y1: pts[0].y, x2: pts[1].x, y2: pts[1].y });
      } else if (pts.length === 4) { // saddle: disambiguate by the cell's average vs threshold
        const center = (tl + tr + br + bl) / 4;
        if (above(center) === above(tl)) { // connect T-L and R-B
          segs.push({ x1: pts[0].x, y1: pts[0].y, x2: pts[3].x, y2: pts[3].y });
          segs.push({ x1: pts[1].x, y1: pts[1].y, x2: pts[2].x, y2: pts[2].y });
        } else { // connect T-R and B-L
          segs.push({ x1: pts[0].x, y1: pts[0].y, x2: pts[1].x, y2: pts[1].y });
          segs.push({ x1: pts[2].x, y1: pts[2].y, x2: pts[3].x, y2: pts[3].y });
        }
      }
    }
  }
  return segs;
}

/** The 4-bit case index of a cell (TL,TR,BR,BL corners above threshold): 0 and 15 emit no contour. */
export function cellCase(tl: number, tr: number, br: number, bl: number, threshold: number): number {
  return (tl >= threshold ? 8 : 0) + (tr >= threshold ? 4 : 0) + (br >= threshold ? 2 : 0) + (bl >= threshold ? 1 : 0);
}
