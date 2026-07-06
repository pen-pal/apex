// Guided story: k-means clustering (Lloyd's algorithm) — assign each point to its nearest center, then move each
// center to the mean of its points; both steps only lower the total squared distance (inertia), so it decreases
// monotonically and converges. DEEPENED so you PRODUCE and BREAK its two real limitations, not just read them:
//  · pick the dataset. On "blobs" (round, well-separated) k-means nails it: inertia ~0.79, ARI 1.00 at k=3.
//  · switch to "two rings" (concentric) and k-means FAILS no matter the seed or k — it cuts a straight line
//    through both rings (its objective, squared Euclidean distance, only carves convex cells), and the Adjusted
//    Rand Index (structure recovered vs chance) sits at ~0 at every k. The spherical-cluster assumption, felt —
//    and why density methods like DBSCAN (which chain dense neighbours) exist.
//  · re-seed to catch a bad start stranding a center in a worse local optimum (e.g. seed 42: inertia ~4.6, ARI ~0.44).
// Real Lloyd's-algorithm math, live; node-verified (blobs k=3 → inertia 0.795, ARI 1.00; rings → ARI ~0 at k=2..5).
import { useEffect, useMemo, useRef, useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

type Pt = [number, number];
const HUE = [210, 30, 150, 275, 45];

// three well-separated round blobs → k-means's happy case
function blobs(): { pts: Pt[]; truth: number[] } {
  let s = 17; const rnd = () => { s = (s * 1103515245 + 12345) >>> 0; return (s >>> 8) / (1 << 24); };
  const cen = [[0.26, 0.32], [0.72, 0.36], [0.5, 0.74]]; const pts: Pt[] = []; const truth: number[] = [];
  cen.forEach(([cx, cy], t) => { for (let i = 0; i < 34; i++) { pts.push([clamp(cx + (rnd() - 0.5) * 0.24), clamp(cy + (rnd() - 0.5) * 0.24)]); truth.push(t); } });
  return { pts, truth };
}
// two concentric rings → the shape k-means provably can't separate (its cells are convex)
function rings(): { pts: Pt[]; truth: number[] } {
  let s = 41; const rnd = () => { s = (s * 1103515245 + 12345) >>> 0; return (s >>> 8) / (1 << 24); };
  const pts: Pt[] = []; const truth: number[] = [];
  const ring = (r: number, n: number, t: number) => { for (let i = 0; i < n; i++) { const a = 2 * Math.PI * rnd(); const rr = r + (rnd() - 0.5) * 0.045; pts.push([clamp(0.5 + rr * Math.cos(a)), clamp(0.5 + rr * Math.sin(a))]); truth.push(t); } };
  ring(0.12, 44, 0); ring(0.34, 78, 1);
  return { pts, truth };
}
const clamp = (v: number) => Math.min(0.97, Math.max(0.03, v));
const DATASETS = { blobs, rings } as const;
type Ds = keyof typeof DATASETS;

const d2 = (a: Pt, b: number[]) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
const assign = (pts: Pt[], C: number[][]) => pts.map((p) => { let bi = 0, bd = 1e9; for (let k = 0; k < C.length; k++) { const dd = d2(p, C[k]); if (dd < bd) { bd = dd; bi = k; } } return bi; });
const inertia = (pts: Pt[], C: number[][], a: number[]) => pts.reduce((s, p, i) => s + d2(p, C[a[i]]), 0);
function update(pts: Pt[], a: number[], k: number): number[][] {
  const C: number[][] = [];
  for (let c = 0; c < k; c++) { const g = pts.filter((_, i) => a[i] === c); C.push(g.length ? [g.reduce((s, p) => s + p[0], 0) / g.length, g.reduce((s, p) => s + p[1], 0) / g.length] : [0.5, 0.5]); }
  return C;
}
const initC = (seed: number, k: number) => { let s = (seed * 2654435761) >>> 0; const r = () => { s = (s * 1103515245 + 12345) >>> 0; return (s >>> 8) / (1 << 24); }; return Array.from({ length: k }, () => [0.15 + r() * 0.7, 0.15 + r() * 0.7]); };

// Adjusted Rand Index: agreement between the clustering and the true labels, corrected for chance and robust to
// the number of clusters. ~1.0 = recovered the real groups; ~0 = no better than a random split of the same sizes.
const nc2 = (n: number) => (n * (n - 1)) / 2;
function ari(a: number[], truth: number[], k: number): number {
  const classes = [...new Set(truth)]; const ci = new Map(classes.map((c, i) => [c, i]));
  const tab = classes.map(() => new Array(k).fill(0));
  for (let i = 0; i < a.length; i++) tab[ci.get(truth[i])!][a[i]]++;
  const n = a.length; let idx = 0; for (const row of tab) for (const v of row) idx += nc2(v);
  const rows = tab.map((r) => r.reduce((s, v) => s + v, 0));
  const cols = Array.from({ length: k }, (_, j) => tab.reduce((s, r) => s + r[j], 0));
  const sa = rows.reduce((s, v) => s + nc2(v), 0), sb = cols.reduce((s, v) => s + nc2(v), 0);
  const exp = (sa * sb) / nc2(n), max = 0.5 * (sa + sb);
  return max - exp === 0 ? 0 : (idx - exp) / (max - exp);
}

const OX = 210, OY = 20, SZ = 400;
const sx = (x: number) => OX + x * SZ;
const syf = (y: number) => OY + y * SZ;

type Phase = 'group' | 'steps' | 'lower' | 'converge' | 'limits' | 'run';

export function KMeansSection() {
  const [ds, setDs] = useState<Ds>('blobs');
  const [k, setK] = useState(3);
  const seedRef = useRef(3);
  const st = useRef({ pts: [] as Pt[], truth: [] as number[], C: [] as number[][], A: [] as number[], it: 0, inert: 0, conv: false });
  const [, tick] = useState(0); const frame = useRef(0);

  const reset = (dataset: Ds, kk: number, seed: number) => {
    const { pts, truth } = DATASETS[dataset]();
    const C = initC(seed, kk); const A = assign(pts, C);
    st.current = { pts, truth, C, A, it: 0, inert: inertia(pts, C, A), conv: false };
  };
  useEffect(() => { reset(ds, k, seedRef.current); tick((t) => t + 1); }, [ds, k]);
  const reseed = () => { seedRef.current = Math.floor(Math.random() * 1e9); reset(ds, k, seedRef.current); tick((t) => t + 1); };
  const pickDs = (d: Ds) => { seedRef.current = 3; setK(d === 'rings' ? 2 : 3); setDs(d); };

  useEffect(() => {
    reset(ds, k, seedRef.current);
    let raf = 0; const loop = () => {
      frame.current++;
      const s = st.current;
      if (frame.current % 18 === 0 && !s.conv && s.pts.length) {
        const A0 = assign(s.pts, s.C); const C1 = update(s.pts, A0, s.C.length); const before = s.inert;
        const A1 = assign(s.pts, C1); const inert = inertia(s.pts, C1, A1);
        st.current = { ...s, C: C1, A: A1, it: s.it + 1, inert, conv: Math.abs(before - inert) < 1e-7 };
      }
      tick((t) => (t + 1) % 100000); raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf);
  }, []);

  const s = st.current;
  const q = useMemo(() => ari(s.A, s.truth, s.C.length), [s.A, s.truth, s.C.length]);

  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <KM phase={key} s={st.current} q={q} /> });

  const scenes: StoryScene[] = [
    scene('group', 'Grouping without labels', 'Here’s a cloud of unlabeled points — customers to segment, pixels to reduce to a palette, documents turned into vectors. You want k natural groups whose members sit close together, but nothing tells you which point belongs where. That’s the clustering problem k-means solves.'),
    scene('steps', 'Two steps, alternating', 'Drop k centers somewhere (a guess), then alternate two moves. Assign: colour every point by its nearest center. Update: slide each center to the average position of the points that chose it. The centers drift toward the dense clumps and the colours re-sort around them.'),
    scene('lower', 'Every step lowers the error', 'The objective is the total squared distance from points to their center — the inertia. Assigning each point to its nearest center can only shrink that sum; moving a center to its points’ mean can only shrink it too (the mean is the least-squares point). So inertia falls with every step, never rising.'),
    scene('converge', 'So it converges', 'Because inertia only decreases and can’t drop below zero, the alternation has to stop — usually within a handful of rounds, the moment no point switches cluster. The centers land on the cluster means and the colouring is stable. You’ve found a clustering.'),
    scene('limits', 'Two limits you can trigger', 'Now the honest part — and you can make both happen below. First, it finds A good clustering, not THE best: a poor initial guess settles into a lopsided local optimum, so in practice you re-seed and keep the lowest inertia (or spread the seeds apart, k-means++). Second, and deeper: its round objective can only carve convex cells, so a shape that isn’t roughly blobby — concentric rings, crescents — defeats it entirely, whatever k you pick.'),
    { key: 'run', title: 'Run it — then break it', caption: 'Watch the two steps run live: points recolour to their nearest center, centers glide to their means, inertia falls until it locks. Now use the controls. Re-seed to catch a bad start stranding a center — inertia jumps and the Adjusted Rand Index (real groups recovered, chance-corrected) drops from 1.0. Then switch to “two rings”: k-means cuts a straight line through both rings, the ARI collapses to ~0, and no seed or k rescues it — because its objective only knows round, convex cells. That failure is the whole reason density methods like DBSCAN exist.', render: () => <KM phase="run" s={st.current} q={q} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>Given a cloud of unlabeled points — customers to segment, pixels to quantize, documents as vectors — <strong>k-means</strong> finds k natural groups whose members sit close together, with no labels to guide it. It alternates two almost trivial steps until they stop changing anything: assign each point to its nearest cluster center, then move each center to the average of the points assigned to it. Simple — but it carries two assumptions you can trip on screen.</>,
        takeaway: <>k-means (Lloyd’s algorithm) minimizes the total squared distance from points to their assigned center — the <strong>inertia</strong>. Repeat: the <em>assignment</em> step puts every point with its nearest center, the <em>update</em> step moves each center to the mean of its points. Both steps can only decrease the inertia (assigning to the nearest center trivially lowers each distance; the mean is exactly the point minimizing the sum of squared distances), so inertia falls <strong>monotonically</strong> and, bounded below by zero, the algorithm converges to a fixed point. Two consequences you can trigger here: it converges only to a <strong>local</strong> optimum, so a poor seeding leaves a worse clustering at higher inertia — run it several times or use <strong>k-means++</strong> and keep the lowest; and because its objective is squared Euclidean distance, every cluster is a convex Voronoi cell, so <strong>non-convex structure</strong> (concentric rings, interleaved crescents) is impossible for it to separate regardless of k — the reason density-based (DBSCAN) and distribution-based (Gaussian mixture) methods exist. The same assign-then-recompute pattern is an instance of expectation-maximization, underlying GMMs, vector quantization, and image color reduction.</>,
      }}
      controls={(sc) => sc !== scenes.length - 1 ? null : (
        <div className="km-ctl">
          <div className="km-ctl-row">
            <span className="km-ctl-lbl">data</span>
            <button type="button" className={`km-btn ${ds === 'blobs' ? 'on' : ''}`} onClick={() => pickDs('blobs')}>round blobs</button>
            <button type="button" className={`km-btn ${ds === 'rings' ? 'on' : ''}`} onClick={() => pickDs('rings')}>two rings</button>
            <label className="km-k">k <input type="range" min={2} max={5} value={k} onChange={(e) => setK(+e.target.value)} /><b>{k}</b></label>
            <button type="button" className="km-btn" onClick={reseed}>↻ re-seed</button>
          </div>
          <span className={`km-live ${ds === 'rings' || q < 0.9 ? 'warn' : ''}`}>
            iteration {s.it} · inertia {s.inert.toFixed(3)}{s.conv ? ' · converged' : ''} · real groups recovered (ARI) <b>{q.toFixed(2)}</b>
            {ds === 'rings' ? ' — a straight cut can’t follow a ring; no k fixes a non-convex shape'
              : q > 0.9 ? ' ✓' : ' — a center is stranded in a worse local optimum; re-seed'}
          </span>
        </div>
      )}
    />
  );
}

function KM({ phase, s, q }: { phase: Phase; s: { pts: Pt[]; truth: number[]; C: number[][]; A: number[]; it: number; inert: number; conv: boolean }; q: number }) {
  const on = (p: Phase) => phase === p;
  const colored = !on('group');
  const k = s.C.length;
  return (
    <svg viewBox="0 0 900 440" className="story-svg">
      <text x="60" y="30" className="km-col">{s.pts.length} points, k={k}{colored ? ` · iteration ${s.it} · inertia ${s.inert.toFixed(3)}${s.conv ? ` · ARI ${q.toFixed(2)}` : ''}` : ' · unlabeled'}</text>
      <rect x={OX} y={OY} width={SZ} height={SZ} className="km-frame" />

      {(on('steps') || on('lower')) && s.pts.map((p, i) => <line key={'l' + i} x1={sx(p[0])} y1={syf(p[1])} x2={sx(s.C[s.A[i]][0])} y2={syf(s.C[s.A[i]][1])} className="km-link" style={{ stroke: `hsl(${HUE[s.A[i]]} 50% 55% / .3)` }} />)}

      {s.pts.map((p, i) => <circle key={i} cx={sx(p[0])} cy={syf(p[1])} r="3.5" className="km-pt" style={{ fill: colored ? `hsl(${HUE[s.A[i] % HUE.length]} 65% 62%)` : 'hsl(210 12% 60%)' }} />)}

      {colored && s.C.map((ct, c) => <g key={c}><line x1={sx(ct[0]) - 9} y1={syf(ct[1]) - 9} x2={sx(ct[0]) + 9} y2={syf(ct[1]) + 9} className="km-cen" style={{ stroke: `hsl(${HUE[c % HUE.length]} 80% 66%)` }} /><line x1={sx(ct[0]) - 9} y1={syf(ct[1]) + 9} x2={sx(ct[0]) + 9} y2={syf(ct[1]) - 9} className="km-cen" style={{ stroke: `hsl(${HUE[c % HUE.length]} 80% 66%)` }} /></g>)}

      <text x="450" y="424" className="km-foot" textAnchor="middle">
        {on('group') ? 'find k groups of nearby points — with no labels to guide you'
          : on('steps') ? 'assign points to nearest center, then move each center to its mean'
          : on('lower') ? 'both steps only shrink the total squared distance (inertia)'
          : on('converge') ? 'inertia falls to a floor → the clustering stops changing'
          : on('limits') ? 're-seed for local optima; switch to rings to break the round-cluster assumption'
          : q > 0.9 ? `recovered the real groups (ARI ${q.toFixed(2)}) · inertia ${s.inert.toFixed(3)}`
          : `ARI ${q.toFixed(2)} — a straight cut can’t follow this shape`}
      </text>
    </svg>
  );
}
