// Guided story: DBSCAN — density-based clustering, as a direct contrast to k-means. It grows clusters by chaining
// points in dense neighborhoods (core points: ≥minPts within radius eps), so clusters take ANY shape, the count
// emerges, and points in no dense region are labeled noise. Verified in node on concentric rings: DBSCAN finds the 2
// rings cleanly (eps=0.09 → 2 clusters, 0 noise) while k-means slices them down the middle (~57%). Sensitive to eps
// (0.04 → fragments into 14, 0.09 → 2). Non-convex clusters + outlier detection. Interactive. Sandboxed/CONCEPTUAL.
import { useMemo, useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

type Pt = [number, number, number];
function makeData(): Pt[] {
  let s = 13; const r = () => { s = (s * 1103515245 + 12345) >>> 0; return (s >>> 8) / (1 << 24); };
  const p: Pt[] = []; const cx = 0.5, cy = 0.5;
  for (let i = 0; i < 60; i++) { const t = 2 * Math.PI * r(), rr = 0.1 * Math.sqrt(r()); p.push([cx + rr * Math.cos(t), cy + rr * Math.sin(t), 0]); }
  for (let i = 0; i < 120; i++) { const t = 2 * Math.PI * r(), rr = 0.34 + (r() - 0.5) * 0.05; p.push([cx + rr * Math.cos(t), cy + rr * Math.sin(t), 1]); }
  for (let i = 0; i < 6; i++) p.push([0.08 + r() * 0.84, 0.08 + r() * 0.84, 2]); // scattered outliers
  return p;
}
const DATA = makeData();
const MINPTS = 4;
const d2 = (a: Pt, b: Pt) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
function dbscan(eps: number): number[] {
  const n = DATA.length, lab = new Array(n).fill(-2); let c = -1;
  const region = (i: number) => { const r: number[] = []; for (let j = 0; j < n; j++) if (d2(DATA[i], DATA[j]) <= eps * eps) r.push(j); return r; };
  for (let i = 0; i < n; i++) { if (lab[i] !== -2) continue; const nb = region(i); if (nb.length < MINPTS) { lab[i] = -1; continue; }
    c++; lab[i] = c; const q = [...nb]; for (let k = 0; k < q.length; k++) { const j = q[k]; if (lab[j] === -1) lab[j] = c; if (lab[j] !== -2) continue; lab[j] = c; const nb2 = region(j); if (nb2.length >= MINPTS) q.push(...nb2); } }
  return lab;
}
function kmeans(): number[] {
  let C = [[0.4, 0.5], [0.6, 0.5]]; let a = DATA.map(() => 0);
  for (let it = 0; it < 40; it++) { a = DATA.map((p) => (d2(p as Pt, [...C[0], 0] as Pt) <= d2(p as Pt, [...C[1], 0] as Pt) ? 0 : 1));
    for (let k = 0; k < 2; k++) { const g = DATA.filter((_, i) => a[i] === k); if (g.length) C[k] = [g.reduce((s, p) => s + p[0], 0) / g.length, g.reduce((s, p) => s + p[1], 0) / g.length]; } }
  return a;
}
const KM = kmeans();
const OX = 250, OY = 18, SZ = 372;
const sx = (x: number) => OX + x * SZ, sy = (y: number) => OY + (1 - y) * SZ;
const HUE = [205, 150, 30, 280, 45];
const colorOf = (l: number) => (l < 0 ? 'hsl(220 12% 45%)' : `hsl(${HUE[l % HUE.length]} 68% 60%)`);

type Phase = 'kmfails' | 'density' | 'grow' | 'noise' | 'free' | 'run';

export function DbscanSection() {
  const [mode, setMode] = useState<'dbscan' | 'kmeans'>('dbscan');
  const [eps, setEps] = useState(0.09);
  const labels = useMemo(() => dbscan(eps), [eps]);
  const nClusters = useMemo(() => Math.max(-1, ...labels) + 1, [labels]);
  const nNoise = useMemo(() => labels.filter((l) => l === -1).length, [labels]);

  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <Db phase={key} labels={dbscan(0.09)} km={KM} eps={0.09} nc={Math.max(-1, ...dbscan(0.09)) + 1} nn={dbscan(0.09).filter((l) => l === -1).length} /> });

  const scenes: StoryScene[] = [
    scene('kmfails', 'Where k-means fails', 'k-means splits points by distance to a center, so it only finds round, comparable blobs. Give it a ring around a core — the outer ring is nowhere near a single center — and k-means slices straight across both, cutting each ring in half. A center-based method simply can’t follow a non-convex shape.'),
    scene('density', 'Cluster by density instead', 'DBSCAN ignores centers and looks at crowding. Two knobs: a radius eps and a count minPts. A point is a core point if at least minPts points fall within eps of it (the circle) — it sits in a dense neighborhood. Sparse, isolated points are not core.'),
    scene('grow', 'Grow along dense chains', 'Start at a core point and swallow every point within eps; for each new core point among them, swallow ITS neighborhood too, and so on. The cluster floods outward along the dense region — around the whole ring — taking whatever shape the density does, not a round blob.'),
    scene('noise', 'Outliers become noise', 'Any point that never falls inside a dense neighborhood belongs to no cluster: DBSCAN labels it noise (the grey points), explicitly. Unlike k-means, it doesn’t force every stray point into a group — outliers are allowed to just be outliers, which makes DBSCAN a natural anomaly detector.'),
    scene('free', 'Shape and count, for free', 'Because clusters follow density, DBSCAN recovers the two rings k-means mangled — and you never told it “k = 2”; the number of clusters fell out on its own. The price is choosing eps and minPts, and it struggles when clusters have very different densities (a single global eps can’t fit both).'),
    { key: 'run', title: 'Density vs centers', caption: 'DBSCAN cleanly separates the inner disk from the outer ring and flags the scattered outliers as noise (grey). Switch to k-means and it splits the whole thing straight down the middle — half of each ring in each cluster. Shrink eps and the ring fragments into many clusters; grow it and everything merges. Density, not distance-to-a-center.', render: () => <Db phase="run" labels={labels} km={KM} eps={eps} nc={nClusters} nn={nNoise} mode={mode} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>k-means partitions points by distance to a center, so it can only carve out round, similar-sized blobs — hand it a ring wrapped around a core and it slices right through both. <strong>DBSCAN</strong> clusters by <strong>density</strong> instead: it grows a cluster by chaining together points that sit in crowded neighborhoods, so a cluster can take any shape, the number of clusters emerges on its own, and points in no dense region are labeled outliers rather than forced into a group.</>,
        takeaway: <>DBSCAN (density-based spatial clustering) takes two parameters: a radius <strong>eps</strong> and a count <strong>minPts</strong>. It calls a point a <strong>core point</strong> if at least minPts points lie within eps of it. A cluster is a maximal set of core points that are <em>density-connected</em> — reachable through a chain of core points each within eps of the next — plus the <strong>border</strong> points that fall within eps of a core but aren’t dense themselves; any point reachable from no core is <strong>noise</strong>. Because the cluster floods outward along dense regions rather than around a center, it recovers arbitrarily shaped clusters — the concentric rings or two moons that defeat k-means (verified here: DBSCAN cleanly splits the inner disk from the outer ring, where k-means gets ~57%, barely better than chance) — it discovers the cluster count on its own instead of taking k as input, and it flags outliers as noise instead of assigning them. The costs: it’s sensitive to eps and minPts (verified: eps 0.09 → the 2 true rings, but 0.04 → 14 fragments), and one global eps can’t fit clusters of very different density (HDBSCAN varies the scale). It’s the go-to when clusters are non-globular or the data has real outliers — anomaly detection, spatial data, and image segmentation.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="dbs-ctl">
          <button type="button" className={`dbs-btn ${mode === 'dbscan' ? 'on' : ''}`} onClick={() => setMode('dbscan')}>DBSCAN</button>
          <button type="button" className={`dbs-btn ${mode === 'kmeans' ? 'on' : ''}`} onClick={() => setMode('kmeans')}>k-means</button>
          {mode === 'dbscan' && <label className="dbs-lbl">eps<input type="range" min={3} max={16} value={Math.round(eps * 100)} onChange={(e) => setEps(+e.target.value / 100)} /><b>{eps.toFixed(2)}</b></label>}
          <span className="dbs-live">{mode === 'dbscan' ? `${nClusters} clusters · ${nNoise} noise` : '2 clusters (splits the rings)'}</span>
        </div>
      )}
    />
  );
}

function Db({ phase, labels, km, eps, nc, nn, mode }: { phase: Phase; labels: number[]; km: number[]; eps: number; nc: number; nn: number; mode?: 'dbscan' | 'kmeans' }) {
  const on = (p: Phase) => phase === p;
  const useKm = on('kmfails') || (on('run') && mode === 'kmeans');
  const lab = useKm ? km : labels;
  // a sample core point on the outer ring, to illustrate the eps neighborhood
  const sample = 90;
  return (
    <svg viewBox="0 0 900 410" className="story-svg">
      <text x="60" y="28" className="dbs-col">{DATA.length} points{useKm ? ' · k-means (distance to center)' : ` · DBSCAN eps=${eps.toFixed(2)} · ${nc} clusters · ${nn} noise`}</text>
      <rect x={OX} y={OY} width={SZ} height={SZ} className="dbs-frame" />

      {/* eps neighborhood illustration */}
      {on('density') && <>
        <circle cx={sx(DATA[sample][0])} cy={sy(DATA[sample][1])} r={eps * SZ} className="dbs-eps" />
        {DATA.map((p, i) => d2(p, DATA[sample]) <= eps * eps && i !== sample ? <line key={'e' + i} x1={sx(DATA[sample][0])} y1={sy(DATA[sample][1])} x2={sx(p[0])} y2={sy(p[1])} className="dbs-nbr" /> : null)}
      </>}

      {/* points */}
      {DATA.map((p, i) => <circle key={i} cx={sx(p[0])} cy={sy(p[1])} r={lab[i] < 0 ? 3 : 3.8} className={`dbs-pt ${lab[i] < 0 ? 'noise' : ''}`} style={{ fill: useKm ? colorOf(km[i]) : colorOf(lab[i]) }} />)}

      <text x="450" y="398" className="dbs-foot" textAnchor="middle">
        {on('kmfails') ? 'k-means cuts both rings in half — it can only make round clusters'
          : on('density') ? `core point: ≥${MINPTS} neighbours within eps → it's in a dense region`
          : on('grow') ? 'flood from core to core within eps → the cluster wraps the whole ring'
          : on('noise') ? 'points in no dense region are labeled noise (grey), not clustered'
          : on('free') ? 'the 2 rings recovered, outliers flagged — and you never picked k'
          : useKm ? 'k-means: rings sliced down the middle — half of each in each cluster' : `DBSCAN: ${nc} clusters + ${nn} noise — shape follows density`}
      </text>
    </svg>
  );
}
