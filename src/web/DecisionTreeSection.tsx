// Guided story: the decision tree — classify by a sequence of simple threshold questions ("is x > 0.45?"), each
// chosen greedily to most reduce class impurity (Gini), carving the plane into axis-aligned pure regions. Verified in
// node: every greedy split has positive information gain (parent impurity − weighted child impurity), and a tree hits
// 100% on the XOR the perceptron couldn't do (~50%). Deep trees overfit → limit depth / prune / random forests.
// Interpretable, no scaling needed, non-linear boundaries. Interactive depth slider. Sandboxed/CONCEPTUAL.
import { useMemo, useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const HUE = [210, 30, 150];
type Pt = [number, number, number];
function makeData(): Pt[] {
  let s = 91; const r = () => { s = (s * 1103515245 + 12345) >>> 0; return (s >>> 8) / (1 << 24); };
  const d: Pt[] = [];
  for (let i = 0; i < 26; i++) d.push([0.06 + r() * 0.32, 0.1 + r() * 0.8, 0]);
  for (let i = 0; i < 26; i++) d.push([0.52 + r() * 0.42, 0.54 + r() * 0.38, 1]);
  for (let i = 0; i < 26; i++) d.push([0.52 + r() * 0.42, 0.08 + r() * 0.38, 2]);
  return d;
}
const DATA = makeData();
function gini(pts: Pt[]): number { const n = pts.length; if (!n) return 0; const c: Record<number, number> = {}; for (const p of pts) c[p[2]] = (c[p[2]] || 0) + 1; let g = 1; for (const k in c) g -= (c[k] / n) ** 2; return g; }
function majority(pts: Pt[]): number { const c: Record<number, number> = {}; for (const p of pts) c[p[2]] = (c[p[2]] || 0) + 1; return +Object.keys(c).sort((a, b) => c[+b] - c[+a])[0]; }
function bestSplit(pts: Pt[]) { const parent = gini(pts); let best: { f: number; t: number; gain: number } | null = null;
  for (let f = 0; f < 2; f++) { const vals = [...new Set(pts.map((p) => p[f]))].sort((a, b) => a - b);
    for (let i = 0; i < vals.length - 1; i++) { const t = (vals[i] + vals[i + 1]) / 2; const L = pts.filter((p) => p[f] <= t), R = pts.filter((p) => p[f] > t); if (!L.length || !R.length) continue;
      const wg = (L.length * gini(L) + R.length * gini(R)) / pts.length; const gain = parent - wg; if (!best || gain > best.gain) best = { f, t, gain }; } }
  return best; }
type Box = [number, number, number, number];
type Node = { leaf: true; maj: number; imp: number; n: number; box: Box } | { leaf: false; f: number; t: number; L: Node; R: Node; box: Box };
function build(pts: Pt[], depth: number, maxD: number, box: Box): Node {
  if (gini(pts) < 1e-9 || depth >= maxD || pts.length < 2) return { leaf: true, maj: majority(pts), imp: gini(pts), n: pts.length, box };
  const sp = bestSplit(pts); if (!sp || sp.gain <= 1e-9) return { leaf: true, maj: majority(pts), imp: gini(pts), n: pts.length, box };
  const [x0, y0, x1, y1] = box; const L: Box = sp.f === 0 ? [x0, y0, sp.t, y1] : [x0, y0, x1, sp.t]; const R: Box = sp.f === 0 ? [sp.t, y0, x1, y1] : [x0, sp.t, x1, y1];
  return { leaf: false, f: sp.f, t: sp.t, box, L: build(pts.filter((p) => p[sp.f] <= sp.t), depth + 1, maxD, L), R: build(pts.filter((p) => p[sp.f] > sp.t), depth + 1, maxD, R) };
}
function leaves(n: Node, acc: Extract<Node, { leaf: true }>[] = []): Extract<Node, { leaf: true }>[] { if (n.leaf) acc.push(n); else { leaves(n.L, acc); leaves(n.R, acc); } return acc; }
function splits(n: Node, acc: Extract<Node, { leaf: false }>[] = []): Extract<Node, { leaf: false }>[] { if (!n.leaf) { acc.push(n); splits(n.L, acc); splits(n.R, acc); } return acc; }

const OX = 220, OY = 20, SZ = 360;
const sx = (x: number) => OX + x * SZ, sy = (y: number) => OY + (1 - y) * SZ;

type Phase = 'questions' | 'impurity' | 'greedy' | 'recurse' | 'overfit' | 'run';

export function DecisionTreeSection() {
  const [depth, setDepth] = useState(4);
  const tree = useMemo(() => build(DATA, 0, depth, [0, 0, 1, 1]), [depth]);
  const impurity = useMemo(() => { const N = DATA.length; return leaves(tree).reduce((s, l) => s + (l.n / N) * l.imp, 0); }, [tree]);

  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string, d: number): StoryScene =>
    ({ key, title, caption, render: () => <DT phase={key} tree={build(DATA, 0, d, [0, 0, 1, 1])} /> });

  const scenes: StoryScene[] = [
    scene('questions', 'Twenty questions for data', 'A decision tree classifies by asking a sequence of simple yes/no questions about the features — “is x greater than 0.45?”, then “is y below 0.5?” — each answer sending you left or right until you reach a leaf that predicts a class. Unlike most models, the result is a flowchart you can actually read.', 0),
    scene('impurity', 'Impurity: how mixed is a group?', 'To ask good questions you first need to measure how “mixed” a set of points is. Gini impurity is 0 when a group is all one class and rises as classes blend. A good split cuts the data into two groups that are each purer than the parent — less mixed, closer to a single colour.', 0),
    scene('greedy', 'Greedily pick the best split', 'At the root, try every feature and every threshold, and choose the single cut that reduces impurity the most — the biggest information gain. That is one axis-aligned line: here a vertical cut peels off the class-0 strip on the left cleanly, dropping the impurity in one stroke.', 1),
    scene('recurse', 'Recurse into pure regions', 'Apply the same rule to each side. The right block still mixes two classes, so a horizontal cut splits it into top and bottom. Keep going and the plane is carved into axis-aligned rectangles, each nearly one colour — and the tree of questions mirrors those boxes exactly.', 4),
    scene('overfit', 'The overfitting risk', 'Left unchecked, a tree keeps splitting until it boxes every single point — flawless on training data, useless on new data (it has memorized the noise). So you cap the depth, prune weak splits, or average many trees (a random forest) / add them in sequence (gradient boosting) to tame the variance.', 4),
    { key: 'run', title: 'Grow the tree', caption: 'Slide the depth up and watch each greedy split carve the plane into purer axis-aligned regions, the impurity dropping toward zero. One question is a single line; a few questions cleanly separate all three classes. Note a tree bends its boundary any way it likes — it even solves the XOR that stumped the perceptron.', render: () => <DT phase="run" tree={tree} depth={depth} impurity={impurity} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>A <strong>decision tree</strong> classifies by asking a sequence of simple threshold questions about the features — “is x &gt; 0.45?”, then “is y &lt; 0.5?” — each answer sending you left or right until you reach a leaf that predicts a class. It’s a flowchart, which makes it one of the few models you can read and explain. It’s built <strong>greedily</strong>: at every node, pick the single yes/no split that best separates the classes.</>,
        takeaway: <>A decision tree partitions the feature space with axis-aligned splits. To choose each split it measures node <strong>impurity</strong> — commonly the Gini impurity <code>1 − Σ p²</code> (0 when a node is one pure class, maximal when classes are evenly mixed) or entropy. At each node it tries every feature and every candidate threshold and picks the split maximizing <strong>information gain</strong>: the parent’s impurity minus the size-weighted average impurity of the two children (verified here — each chosen split strictly lowers the weighted impurity, and it’s the maximum-gain cut over a brute-force search of all candidates). Then it recurses, carving the plane into ever-purer rectangles until leaves are pure or a stopping rule fires. Its strengths: interpretability (the path to a leaf is a readable rule), no need for feature scaling, and non-linear boundaries — a tree cleanly solves the <strong>XOR</strong> that a single perceptron can’t (verified: 100% vs ~50%). Its weakness is variance: an unconstrained tree splits until it boxes every training point, memorizing noise, so you limit depth, prune, or — far more powerfully — average many decorrelated trees (a <strong>random forest</strong>) or add them sequentially to fix each other’s errors (<strong>gradient boosting</strong>). Those tree ensembles remain the go-to for tabular data.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <label className="dt-ctl">tree depth<input type="range" min={0} max={6} value={depth} onChange={(e) => setDepth(+e.target.value)} /><b>{depth}</b> · {splits(tree).length} splits · impurity <b>{impurity.toFixed(3)}</b>{impurity < 0.02 ? ' · pure ✓' : ''}</label>
      )}
    />
  );
}

function DT({ phase, tree, depth, impurity }: { phase: Phase; tree: Node; depth?: number; impurity?: number }) {
  const on = (p: Phase) => phase === p;
  const showRegions = !on('questions') && !on('impurity');
  const lvs = leaves(tree), sps = splits(tree);
  const imp = impurity ?? (() => { const N = DATA.length; return lvs.reduce((s, l) => s + (l.n / N) * l.imp, 0); })();
  return (
    <svg viewBox="0 0 900 420" className="story-svg">
      <text x="60" y="30" className="dt-col">3 classes{showRegions ? ` · ${sps.length} question${sps.length === 1 ? '' : 's'} · impurity ${imp.toFixed(3)}` : ' · ask threshold questions to separate them'}</text>
      <rect x={OX} y={OY} width={SZ} height={SZ} className="dt-frame" />

      {/* leaf regions shaded by majority class */}
      {showRegions && lvs.map((l, i) => { const [x0, y0, x1, y1] = l.box; return <rect key={i} x={sx(x0)} y={sy(y1)} width={(x1 - x0) * SZ} height={(y1 - y0) * SZ} className="dt-region" style={{ fill: `hsl(${HUE[l.maj]} 60% 55% / ${0.1 + (1 - l.imp) * 0.28})` }} />; })}

      {/* split lines */}
      {showRegions && sps.map((n, i) => { const [x0, y0, x1, y1] = n.box; return n.f === 0
        ? <line key={i} x1={sx(n.t)} y1={sy(y1)} x2={sx(n.t)} y2={sy(y0)} className="dt-split" />
        : <line key={i} x1={sx(x0)} y1={sy(n.t)} x2={sx(x1)} y2={sy(n.t)} className="dt-split" />; })}

      {/* points */}
      {DATA.map((p, i) => <circle key={i} cx={sx(p[0])} cy={sy(p[1])} r="3.6" className="dt-pt" style={{ fill: `hsl(${HUE[p[2]]} 70% 62%)` }} />)}

      <text x="450" y="406" className="dt-foot" textAnchor="middle">
        {on('questions') ? 'each internal node is a yes/no threshold question on one feature'
          : on('impurity') ? 'Gini impurity = 0 for a pure group, higher as classes mix'
          : on('greedy') ? 'the best first cut peels off a pure class → biggest impurity drop'
          : on('recurse') ? 'recurse on each side → axis-aligned rectangles, each near-pure'
          : on('overfit') ? 'unlimited depth boxes every point → overfit; cap depth / use forests'
          : `depth ${depth} · impurity ${imp.toFixed(3)}${imp < 0.02 ? ' — regions are pure' : ' and falling'}`}
      </text>
    </svg>
  );
}
