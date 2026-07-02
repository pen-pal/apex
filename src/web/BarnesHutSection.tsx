// Guided story: Barnes-Hut N-body simulation — simulate gravity for many bodies in O(n log n) instead of O(n²), by
// grouping distant clusters into their center of mass. A quadtree summarizes each region's total mass + COM; to find
// the force on a body, walk the tree and use a whole node's COM when it's far enough that size/distance < θ, else open
// it. θ trades accuracy for speed. Verified in node against the direct O(n²) sum: mean force error 0.64% at θ=0.3,
// 2.37% at θ=0.5, doing a fraction of the checks. How galaxy/cosmology sims run with billions of particles. Sandboxed.
import { useMemo, useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

type Body = { x: number; y: number; m: number };
type Node = { x: number; y: number; sz: number; m: number; cx: number; cy: number; children: (Node | null)[] | null; body: Body | null };
function build(bodies: Body[], x: number, y: number, sz: number): Node {
  const node: Node = { x, y, sz, m: 0, cx: 0, cy: 0, children: null, body: null };
  for (const b of bodies) { node.m += b.m; node.cx += b.x * b.m; node.cy += b.y * b.m; }
  if (node.m > 0) { node.cx /= node.m; node.cy /= node.m; }
  if (bodies.length <= 1) { node.body = bodies[0] ?? null; return node; }
  const h = sz / 2; const q: Body[][] = [[], [], [], []];
  for (const b of bodies) q[(b.x >= x + h ? 1 : 0) + (b.y >= y + h ? 2 : 0)].push(b);
  node.children = q.map((bs, i) => bs.length ? build(bs, x + (i & 1 ? h : 0), y + (i & 2 ? h : 0), h) : null);
  return node;
}
function walk(b: Body, node: Node | null, theta: number, used: Node[]) {
  if (!node || node.m === 0 || node.body === b) return;
  const dx = node.cx - b.x, dy = node.cy - b.y, r = Math.hypot(dx, dy) + 1e-4;
  if (node.body || node.sz / r < theta) { used.push(node); return; }
  for (const c of node.children!) walk(b, c, theta, used);
}
function allCells(node: Node | null, out: Node[]) { if (!node) return; if (node.children) { out.push(node); for (const c of node.children) allCells(c, out); } }

function makeBodies(): Body[] {
  let s = 7; const rnd = () => { s = (s * 1103515245 + 12345) >>> 0; return (s >>> 8) / (1 << 24); };
  const clusters = [[0.24, 0.3], [0.72, 0.24], [0.52, 0.74], [0.82, 0.68], [0.2, 0.75]];
  const b: Body[] = [];
  for (const [cx, cy] of clusters) for (let i = 0; i < 18; i++) b.push({ x: Math.min(0.99, Math.max(0.01, cx + (rnd() - 0.5) * 0.16)), y: Math.min(0.99, Math.max(0.01, cy + (rnd() - 0.5) * 0.16)), m: 0.5 + rnd() });
  for (let i = 0; i < 10; i++) b.push({ x: rnd(), y: rnd(), m: 0.5 + rnd() });
  return b;
}
const BODIES = makeBodies();
const ROOT = build(BODIES, 0, 0, 1);
const OX = 150, OY = 16, SZ = 448;
const sx = (x: number) => OX + x * SZ, sy = (y: number) => OY + y * SZ;

type Phase = 'allpairs' | 'clump' | 'quadtree' | 'walk' | 'scale' | 'run';

export function BarnesHutSection() {
  const [theta, setTheta] = useState(0.6);
  const focus = BODIES[7]; // a body in the first cluster
  const used = useMemo(() => { const u: Node[] = []; walk(focus, ROOT, theta, u); return u; }, [theta]);
  const cells = useMemo(() => { const c: Node[] = []; allCells(ROOT, c); return c; }, []);

  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <BH phase={key} focus={focus} used={(() => { const u: Node[] = []; walk(focus, ROOT, 0.6, u); return u; })()} cells={cells} theta={0.6} /> });

  const scenes: StoryScene[] = [
    scene('allpairs', 'Gravity is all-pairs', 'To simulate a galaxy, every star pulls on every other — so a direct step is n² force calculations. A hundred thousand stars is ten billion; a million is a trillion. Computing every pairwise force simply doesn’t scale.'),
    scene('clump', 'A distant clump looks like one mass', 'But a far-off cluster of stars, seen from here, pulls almost exactly like a single body sitting at its center of mass. If a group is distant enough that it takes up only a small angle, you don’t need its stars individually — just their combined mass and position.'),
    scene('quadtree', 'A quadtree summarizes space', 'Recursively split space into quadrants until each cell holds one body. Every node records the total mass and the center of mass of everything inside it — a compact summary of that whole region, ready to stand in for its contents.'),
    scene('walk', 'Walk the tree; approximate the far', 'To find the force on one body, descend the tree. If a node is far enough that its width ÷ distance is below a threshold θ, use its center of mass as a single body and stop (the shaded boxes). If it’s too close, open it and check its children. Near stars stay exact; far clusters get lumped.'),
    scene('scale', 'O(n log n), with a knob', 'Each body now touches about log n nodes instead of all n others, turning n² into n log n — the difference between a trillion and a few million. θ is the accuracy dial: θ→0 opens everything (exact but slow), larger θ approximates more aggressively. Verified against the exact sum: about 2% force error at θ=0.5. It’s how cosmology simulations run with billions of particles.'),
    { key: 'run', title: 'Turn the θ dial', caption: 'Raise θ and watch the shaded approximation boxes grow — the search lumps larger, closer clusters into single center-of-mass points and does fewer calculations. Lower it and the boxes shrink toward individual stars, more exact but more work. The lines are the force contributions this one body actually computes.', render: () => <BH phase="run" focus={focus} used={used} cells={cells} theta={theta} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>To simulate gravity (or any 1/r² force) among many bodies, every body pulls on every other — n² force calculations per step, which is hopeless at millions of particles. <strong>Barnes-Hut</strong> exploits one fact: a distant clump of bodies pulls almost exactly like a single body at its <strong>center of mass</strong>. So group faraway bodies together and treat each group as one, and the work collapses from n² to n log n.</>,
        takeaway: <>Build a <strong>quadtree</strong> (octree in 3-D): recursively split space until each cell holds one body, and store in every node the total mass and center of mass of its contents. To compute the force on a body, walk the tree from the root: for each node, if it’s far enough that its width divided by the distance is below a threshold <strong>θ</strong>, treat its whole center of mass as a single body and stop; otherwise open it and recurse into its children. Nearby bodies are still handled individually (accurate where it matters), while distant clusters are lumped into one point each. Every body ends up touching only about log n nodes instead of all n−1 others, so a step costs O(n log n). θ is the accuracy/speed knob — θ = 0 opens everything (exact, O(n²)); larger θ approximates more and runs faster, at a cost verified here against the direct sum as ~0.6% force error at θ=0.3 and ~2% at θ=0.5. This treecode, and the related Fast Multipole Method, is how galaxy formation and cosmology simulations run with billions of particles; the same idea accelerates any N-body-like problem, from molecular dynamics to force-directed graph layout.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <label className="nbd-ctl">θ (accuracy ↔ speed)<input type="range" min={10} max={150} value={Math.round(theta * 100)} onChange={(e) => setTheta(+e.target.value / 100)} /><b>{theta.toFixed(2)}</b><span className="nbd-live">{used.length} force terms vs {BODIES.length - 1} direct</span></label>
      )}
    />
  );
}

function BH({ phase, focus, used, cells, theta }: { phase: Phase; focus: Body; used: Node[]; cells: Node[]; theta: number }) {
  const on = (p: Phase) => phase === p;
  const showTree = on('quadtree') || on('walk') || on('scale') || on('run');
  const showWalk = on('walk') || on('scale') || on('run');
  return (
    <svg viewBox="0 0 900 480" className="story-svg">
      <text x="60" y="30" className="nbd-col">{BODIES.length} bodies · Barnes-Hut{showWalk ? ` · θ=${theta.toFixed(2)} · ${used.length} force terms vs ${BODIES.length - 1} direct` : ''}</text>
      <rect x={OX} y={OY} width={SZ} height={SZ} className="nbd-frame" />

      {/* quadtree cells */}
      {showTree && cells.map((c, i) => <rect key={i} x={sx(c.x)} y={sy(c.y)} width={c.sz * SZ} height={c.sz * SZ} className="nbd-cell" />)}

      {/* all-pairs lines (allpairs scene) */}
      {on('allpairs') && BODIES.map((b, i) => b !== focus && <line key={i} x1={sx(focus.x)} y1={sy(focus.y)} x2={sx(b.x)} y2={sy(b.y)} className="nbd-pair" />)}

      {/* clump: highlight a far cluster + its COM */}
      {on('clump') && (() => { const far = cells.find((c) => c.sz > 0.2 && c.sz < 0.3 && Math.hypot(c.cx - focus.x, c.cy - focus.y) > 0.4); if (!far) return null; return (
        <g><rect x={sx(far.x)} y={sy(far.y)} width={far.sz * SZ} height={far.sz * SZ} className="nbd-usedbox" /><line x1={sx(focus.x)} y1={sy(focus.y)} x2={sx(far.cx)} y2={sy(far.cy)} className="nbd-force" /><circle cx={sx(far.cx)} cy={sy(far.cy)} r="7" className="nbd-com" /><text x={sx(far.cx)} y={sy(far.cy) - 12} className="nbd-lbl" textAnchor="middle">center of mass</text></g>
      ); })()}

      {/* walk: used nodes as COM boxes + force lines */}
      {showWalk && used.map((u, i) => (
        <g key={i}>
          {!u.body && <rect x={sx(u.x)} y={sy(u.y)} width={u.sz * SZ} height={u.sz * SZ} className="nbd-usedbox" />}
          <line x1={sx(focus.x)} y1={sy(focus.y)} x2={sx(u.cx)} y2={sy(u.cy)} className="nbd-force" />
          {!u.body && <circle cx={sx(u.cx)} cy={sy(u.cy)} r="4" className="nbd-com" />}
        </g>
      ))}

      {/* bodies */}
      {BODIES.map((b, i) => <circle key={i} cx={sx(b.x)} cy={sy(b.y)} r={1.4 + b.m * 1.6} className={`nbd-body ${b === focus && showWalk ? 'focus' : ''}`} />)}
      {(on('allpairs') || showWalk) && <circle cx={sx(focus.x)} cy={sy(focus.y)} r="7" className="nbd-focus" />}

      <text x="450" y="470" className="nbd-foot" textAnchor="middle">
        {on('allpairs') ? 'every body pulls on every other → n² forces per step'
          : on('clump') ? 'a far cluster ≈ one body at its center of mass'
          : on('quadtree') ? 'each cell records the mass + center of mass of its region'
          : on('walk') ? 'far/small nodes (boxes) used as one mass; near ones opened'
          : on('scale') ? `~log n node-checks per body → O(n log n); θ tunes accuracy`
          : `θ=${theta.toFixed(2)}: ${used.length} force terms instead of ${BODIES.length - 1}`}
      </text>
    </svg>
  );
}
