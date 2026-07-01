// Bresenham's line algorithm — how a computer draws a straight line on a grid of pixels, and one of the oldest
// tricks still running in every GPU, plotter, and drawing library (Jack Bresenham, IBM, 1962). The naive way uses
// the equation y = y0 + slope·(x − x0): step x by one, compute the real y, round it. But that needs a floating-
// point multiply and a round at every pixel — expensive on 1962 hardware and still wasteful today. Bresenham's
// insight is to track only an integer ERROR term: the signed distance between the true line and the pixel you last
// lit. Each step you ask a single question — does advancing keep the error small, or has it grown enough that you
// must step in the minor axis too? — and update the error with just additions and comparisons. No multiply, no
// divide, no floating point, no rounding: the exact same pixels the "round the real y" method would pick, computed
// with nothing but integer add/subtract/compare. That's why it was fast enough to rasterize in real time on early
// machines and why the idea (an accumulating error you correct in whole steps) reappears everywhere — circle and
// ellipse drawing, the DDA, even audio resampling and Bresenham-style timing loops. This models the integer
// algorithm (general form, all eight octants) and its decision variable. Reference: Bresenham, IBM Systems
// Journal (1965).

export interface Pixel { x: number; y: number; err: number }

/** The general integer Bresenham line from (x0,y0) to (x1,y1): only add/subtract/compare, no float. */
export function bresenham(x0: number, y0: number, x1: number, y1: number): Pixel[] {
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy, x = x0, y = y0;
  const pixels: Pixel[] = [];
  for (;;) {
    pixels.push({ x, y, err });
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; } // error allows an x step
    if (e2 < dx) { err += dx; y += sy; }  // error forces a y step
  }
  return pixels;
}

/** The exact real-line y (or x) for comparison — the value Bresenham approximates without ever computing it. */
export const trueY = (x: number, x0: number, y0: number, x1: number, y1: number): number =>
  x1 === x0 ? y0 : y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
