import { describe, it, expect } from 'vitest';
import { dist, nearestSite, voronoiGrid, type Site, type Metric } from '../src/web/voronoi';

const S = (x: number, y: number): Site => ({ x, y });
const sites = [S(10, 10), S(40, 10), S(25, 35)];

describe('the nearest-site rule', () => {
  it('a site owns its own location', () => {
    expect(nearestSite(sites, 10, 10)).toBe(0);
    expect(nearestSite(sites, 25, 35)).toBe(2);
  });
  it('an equidistant point is a boundary; ties resolve to the lower index deterministically', () => {
    expect(dist('euclidean', 25, 10, 10, 10)).toBe(dist('euclidean', 25, 10, 40, 10)); // equidistant to sites 0,1
    expect(nearestSite(sites, 25, 10)).toBe(0);
  });
  it('distance metrics: euclidean squared, manhattan sum, chebyshev max', () => {
    expect(dist('euclidean', 0, 0, 3, 4)).toBe(25);
    expect(dist('manhattan', 0, 0, 3, 4)).toBe(7);
    expect(dist('chebyshev', 0, 0, 3, 4)).toBe(4);
  });
});

describe('correctness over 60000 random queries (all three metrics)', () => {
  it('the assigned site is always the true nearest, and the grid agrees', () => {
    let s = 1; const rnd = (n: number) => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s % n; };
    for (const m of ['euclidean', 'manhattan', 'chebyshev'] as Metric[]) {
      for (let t = 0; t < 20000; t++) {
        const n = 2 + rnd(8); const st: Site[] = [];
        for (let i = 0; i < n; i++) st.push(S(rnd(60), rnd(60)));
        const qx = rnd(60), qy = rnd(60);
        const a = nearestSite(st, qx, qy, m);
        const dA = dist(m, qx, qy, st[a].x, st[a].y);
        for (const site of st) expect(dist(m, qx, qy, site.x, site.y)).toBeGreaterThanOrEqual(dA);
      }
    }
    const g = voronoiGrid(sites, 50, 50);
    for (let y = 0; y < 50; y++) for (let x = 0; x < 50; x++) expect(g[y * 50 + x]).toBe(nearestSite(sites, x, y));
  });
});

describe('monotonicity', () => {
  it('adding a site never reassigns a point between two pre-existing sites (it only carves out the new cell)', () => {
    const base = voronoiGrid(sites, 40, 40);
    const g2 = voronoiGrid([...sites, S(30, 20)], 40, 40); // new site index 3
    for (let i = 0; i < base.length; i++) {
      if (g2[i] !== 3) expect(g2[i]).toBe(base[i]); // unchanged unless captured by the new site
    }
  });
});
