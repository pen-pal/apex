// Voronoi, made visible. Every pixel is painted the colour of its nearest site, so the plane tiles into cells —
// click to drop a new site and watch the territories re-carve; switch the distance metric and the straight
// bisector edges become taxicab diamonds or chessboard squares. Real logic from voronoi.ts.
import { useEffect, useRef, useState } from 'react';
import { nearestSite, type Metric, type Site } from './voronoi';

const CW = 340, CH = 236;
const seed = (): Site[] => {
  let s = 5; const rnd = (n: number) => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return (s / 0x80000000) * n; };
  return Array.from({ length: 8 }, () => ({ x: 20 + rnd(CW - 40), y: 20 + rnd(CH - 40) }));
};
// distinct dark-mode-friendly cell colour per site, from the golden angle
const rgb = (i: number): [number, number, number] => {
  const h = (i * 137.508) % 360, s = 0.42, l = 0.34;
  const k = (n: number) => (n + h / 30) % 12;
  const f = (n: number) => l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
};

export function VoronoiSection() {
  const [sites, setSites] = useState<Site[]>(seed);
  const [metric, setMetric] = useState<Metric>('euclidean');
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d'); if (!ctx) return;
    const img = ctx.createImageData(CW, CH);
    for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
      const i = nearestSite(sites, x, y, metric);
      const [r, g, b] = rgb(i < 0 ? 0 : i);
      const nbrDiff = (x + 1 < CW && nearestSite(sites, x + 1, y, metric) !== i) || (y + 1 < CH && nearestSite(sites, x, y + 1, metric) !== i);
      const o = (y * CW + x) * 4;
      const edge = nbrDiff ? 0.45 : 1;
      img.data[o] = r * edge; img.data[o + 1] = g * edge; img.data[o + 2] = b * edge; img.data[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    for (const st of sites) { ctx.beginPath(); ctx.arc(st.x, st.y, 3.5, 0, 7); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#0b0e14'; ctx.stroke(); }
  }, [sites, metric]);

  const add = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setSites((s) => [...s, { x: ((e.clientX - r.left) / r.width) * CW, y: ((e.clientY - r.top) / r.height) * CH }]);
  };

  return (
    <div className="vor">
      <p className="vor-intro">
        A Voronoi diagram carves a plane into one <strong>cell per site</strong>, where every point belongs to its
        <strong> nearest</strong> site. Under straight-line (Euclidean) distance the edge between two cells is the
        <strong> perpendicular bisector</strong> of their sites — the equidistant line — so each cell is an
        intersection of half-planes and hence convex (other metrics bend those edges, as you'll see). It's how you
        answer "which is closest" instantly, and it's the exact dual of the Delaunay triangulation. Click
        to add a site; change the distance metric to reshape the cells.
      </p>

      <div className="vor-tabs">
        {(['euclidean', 'manhattan', 'chebyshev'] as Metric[]).map((m) => (
          <button key={m} type="button" className={`vor-tab ${metric === m ? 'on' : ''}`} onClick={() => setMetric(m)}>{m}</button>
        ))}
        <button type="button" className="vor-tab ghost" onClick={() => setSites(seed())}>reset</button>
        <span className="vor-count">{sites.length} sites</span>
      </div>

      <canvas ref={canvas} width={CW} height={CH} className="vor-canvas" onClick={add} />

      <p className="vor-foot">
        The picture is deceptively deep. Because the boundaries are perpendicular bisectors, the cells meet three
        at a time at points equidistant from three sites — the circumcenters of the Delaunay triangles — and that
        duality is why computing one gives you the other: connect sites whose cells share an edge and you get the
        triangulation that avoids skinny triangles, the gold standard for meshing a surface for simulation or
        graphics. Building it naively (every pixel scans every site, as here) is O(pixels·sites), fine for a demo
        but wasteful; Fortune's <em>sweepline</em> does it in O(n log n) by sweeping a line down the plane and
        tracking a "beach line" of parabolas, and there's an equally clever incremental method via the Delaunay
        dual. The metric matters more than it looks: under Euclidean distance you get the familiar straight edges,
        but Manhattan (taxicab) distance — the right model when you can only move along a grid, like city blocks or
        chip routing — bends the boundaries into diagonal diamonds, and Chebyshev (king's-move) distance squares
        them off. Same "nearest wins" rule, a different geometry of nearness. Voronoi cells show up wherever that
        rule governs nature or engineering: cell-tower coverage, crystal grain growth, the territories of trees
        competing for light, and nearest-neighbour classifiers in machine learning. (Voronoi 1908; Fortune 1986.)
      </p>
    </div>
  );
}
