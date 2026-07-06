// Guided story: the decision tree — classify by a sequence of simple threshold questions ("is x > 0.45?"), each
// chosen greedily to most reduce class impurity (Gini), carving the plane into axis-aligned regions. DEEPENED to
// PRODUCE and BREAK the one thing that matters in practice: overfitting. The data is two classes split by a noisy
// diagonal, with a held-out TEST set. Slide the depth: TRAIN accuracy climbs monotonically to 100% (the tree boxes
// every point, memorizing the label noise), but TEST accuracy PEAKS shallow (~depth 2-3) and then DROPS as the tree
// fits noise that doesn't generalize — the classic train↑/test↓ divergence, shown as a live curve. The fix is to
// stop early (cap depth / prune) or average many trees (a random forest). Node-verified (train seed 91, test seed 7,
// 90 pts each): train 80→100%; test peaks 82% at depth 2, falls to ~68-74% by depth 6+; gap grows to ~26 points.
import { useMemo, useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const HUE = [210, 30];
type Pt = [number, number, number];
function rng(seed: number) { let s = seed >>> 0; return () => { s = (s * 1103515245 + 12345) >>> 0; return (s >>> 8) / (1 << 24); }; }
const gauss = (r: () => number) => { const a = Math.max(1e-9, r()), b = r(); return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * b); };
// two classes split by the diagonal y=x, with label noise near it — the overlap a deep tree will memorize
function gen(seed: number, n: number): Pt[] { const r = rng(seed); const p: Pt[] = []; for (let i = 0; i < n; i++) { const x = r(), y = r(); const t = ((y - x) + gauss(r) * 0.18) > 0 ? 0 : 1; p.push([x, y, t]); } return p; }
const TRAIN = gen(91, 90), TEST = gen(7, 90);
const MAXD = 10;

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
function predict(node: Node, p: Pt): number { while (!node.leaf) node = p[node.f] <= node.t ? node.L : node.R; return node.maj; }
const accOf = (node: Node, pts: Pt[]) => pts.filter((p) => predict(node, p) === p[2]).length / pts.length;
// train/test accuracy at every depth — the overfitting curve (constant, computed once)
const CURVE = Array.from({ length: MAXD }, (_, i) => { const d = i + 1; const t = build(TRAIN, 0, d, [0, 0, 1, 1]); return { d, train: accOf(t, TRAIN), test: accOf(t, TEST) }; });
const BEST = CURVE.reduce((b, c) => (c.test > b.test ? c : b)).d;

const OX = 196, OY = 40, SZ = 320;
const sx = (x: number) => OX + x * SZ, sy = (y: number) => OY + (1 - y) * SZ;
const CX = 590, CW = 288, CY = 66, CH = 268;
const xD = (d: number) => CX + ((d - 1) / (MAXD - 1)) * CW;
const yA = (a: number) => CY + (1 - (a - 0.5) / 0.5) * CH;

type Phase = 'questions' | 'impurity' | 'greedy' | 'recurse' | 'overfit' | 'run';

export function DecisionTreeSection() {
  const [depth, setDepth] = useState(2);
  const tree = useMemo(() => build(TRAIN, 0, depth, [0, 0, 1, 1]), [depth]);
  const trainAcc = CURVE[depth - 1]?.train ?? accOf(tree, TRAIN);
  const testAcc = CURVE[depth - 1]?.test ?? accOf(tree, TEST);

  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string, d: number): StoryScene =>
    ({ key, title, caption, render: () => <DT phase={key} depth={d} /> });

  const scenes: StoryScene[] = [
    scene('questions', 'Twenty questions for data', 'A decision tree classifies by asking a sequence of simple yes/no questions about the features — “is x greater than 0.45?”, then “is y below 0.5?” — each answer sending you left or right until you reach a leaf that predicts a class. Unlike most models, the result is a flowchart you can actually read.', 2),
    scene('impurity', 'Impurity: how mixed is a group?', 'To ask good questions you first measure how “mixed” a set of points is. Gini impurity is 0 when a group is all one class and rises as classes blend. A good split cuts the data into two groups each purer than the parent — closer to a single colour.', 2),
    scene('greedy', 'Greedily pick the best split', 'At the root, try every feature and every threshold and choose the single cut that reduces impurity the most — the biggest information gain. That is one axis-aligned line; here the true divide is the diagonal, so one cut can only approximate it.', 1),
    scene('recurse', 'Recurse into a staircase', 'Apply the same rule to each side. Since every cut is axis-aligned, the tree approximates the diagonal boundary with a staircase of little steps — more depth, finer steps. A few levels already track the divide well.', 3),
    scene('overfit', 'Train vs test — the real test', 'But the labels near the divide are noisy, and a tree can keep splitting until it boxes every training point perfectly. So hold out a fresh TEST set the tree never sees. The panel on the right plots accuracy on both as depth grows: train and test rise together at first — then they part ways.', 4),
    { key: 'run', title: 'Overfit it — watch test turn back', caption: 'Slide the depth up. TRAIN accuracy (purple) climbs all the way to 100% — the tree carves a tiny box around every point, memorizing even the noisy ones. But TEST accuracy (red) peaks shallow and then FALLS: those tiny boxes fit training noise that isn’t there in new data. The regions fracture into slivers around single points, and the train–test gap yawns open. That gap is overfitting. The best tree here is a shallow one; the fix is to stop early (cap depth / prune) or average many trees — a random forest.', render: () => <DT phase="run" depth={depth} trainAcc={trainAcc} testAcc={testAcc} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>A <strong>decision tree</strong> classifies by asking a sequence of simple threshold questions — “is x &gt; 0.45?”, then “is y &lt; 0.5?” — each answer sending you left or right until a leaf predicts a class. It’s a readable flowchart, built <strong>greedily</strong>: at every node, pick the split that best separates the classes. Its danger, which you can produce here, is that nothing stops it from splitting until it has boxed every single training point — memorizing noise instead of learning the pattern.</>,
        takeaway: <>A tree partitions the feature space with axis-aligned splits, choosing each by <strong>impurity</strong> — Gini <code>1 − Σ p²</code> (0 for a pure node) — and picking the split with the largest <strong>information gain</strong> (parent impurity minus the size-weighted impurity of the two children), then recursing. Strengths: interpretability, no feature scaling, non-linear boundaries. Its defining weakness is <strong>variance / overfitting</strong>: an unconstrained tree keeps splitting until every leaf is pure, so it reaches <strong>100% training accuracy by boxing each point individually</strong> — including the ones whose labels are just noise. You expose this by holding out a <strong>test set</strong>: as depth grows, training accuracy rises monotonically to 100%, but test accuracy <strong>peaks at a shallow depth and then declines</strong> (verified here: test tops out ~82% around depth 2–3 and falls toward ~70% while train hits 100%, a train–test gap of ~26 points). That divergence is the signature of overfitting, and the widening gap is your diagnostic. The cures are to constrain the tree — limit depth, require a minimum leaf size, or <strong>prune</strong> weak splits — or, far more powerfully, to average many decorrelated trees (a <strong>random forest</strong>) or add them sequentially to correct each other (<strong>gradient boosting</strong>), which keep the low bias of deep trees while cancelling their variance. Those ensembles remain the go-to for tabular data.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <label className="dt-ctl">tree depth<input type="range" min={1} max={MAXD} value={depth} onChange={(e) => setDepth(+e.target.value)} /><b>{depth}</b>
          <span className={`dt-acc ${testAcc < CURVE[BEST - 1].test - 0.04 ? 'warn' : ''}`}> · train <b>{(trainAcc * 100).toFixed(0)}%</b> · test <b>{(testAcc * 100).toFixed(0)}%</b> · gap {((trainAcc - testAcc) * 100).toFixed(0)}pts{depth > BEST + 1 ? ' — overfitting (test fell)' : depth <= BEST ? ' ✓' : ''}</span>
        </label>
      )}
    />
  );
}

function DT({ phase, depth, trainAcc, testAcc }: { phase: Phase; depth: number; trainAcc?: number; testAcc?: number }) {
  const on = (p: Phase) => phase === p;
  const tree = build(TRAIN, 0, depth, [0, 0, 1, 1]);
  const showRegions = !on('questions') && !on('impurity');
  const showCurve = on('overfit') || on('run');
  const lvs = leaves(tree), sps = splits(tree);
  const tr = trainAcc ?? accOf(tree, TRAIN), te = testAcc ?? accOf(tree, TEST);
  const trainLine = CURVE.map((c) => `${xD(c.d).toFixed(0)},${yA(c.train).toFixed(0)}`).join(' ');
  const testLine = CURVE.map((c) => `${xD(c.d).toFixed(0)},${yA(c.test).toFixed(0)}`).join(' ');
  return (
    <svg viewBox="0 0 900 420" className="story-svg">
      <text x="52" y="30" className="dt-col">two classes · a noisy diagonal divide{showRegions ? ` · depth ${depth} · ${sps.length} split${sps.length === 1 ? '' : 's'}` : ''}</text>
      <rect x={OX} y={OY} width={SZ} height={SZ} className="dt-frame" />

      {showRegions && lvs.map((l, i) => { const [x0, y0, x1, y1] = l.box; return <rect key={i} x={sx(x0)} y={sy(y1)} width={(x1 - x0) * SZ} height={(y1 - y0) * SZ} className="dt-region" style={{ fill: `hsl(${HUE[l.maj]} 60% 55% / ${0.12 + (1 - l.imp) * 0.3})` }} />; })}
      {showRegions && sps.map((n, i) => { const [x0, y0, x1, y1] = n.box; return n.f === 0
        ? <line key={i} x1={sx(n.t)} y1={sy(y1)} x2={sx(n.t)} y2={sy(y0)} className="dt-split" />
        : <line key={i} x1={sx(x0)} y1={sy(n.t)} x2={sx(x1)} y2={sy(n.t)} className="dt-split" />; })}

      {/* training points define the tree; test points (hollow) are the fresh check */}
      {TRAIN.map((p, i) => <circle key={'tr' + i} cx={sx(p[0])} cy={sy(p[1])} r="3.2" className="dt-pt" style={{ fill: `hsl(${HUE[p[2]]} 70% 62%)` }} />)}
      {showCurve && TEST.map((p, i) => <circle key={'te' + i} cx={sx(p[0])} cy={sy(p[1])} r="3" className="dt-pt test" style={{ stroke: `hsl(${HUE[p[2]]} 70% 66%)` }} />)}

      {/* the overfitting curve: train (rising) vs test (peaks then falls) */}
      {showCurve && <g>
        <rect x={CX} y={CY} width={CW} height={CH} className="dt-cv-frame" />
        <text x={CX + CW / 2} y={CY - 8} className="dt-cv-title" textAnchor="middle">accuracy vs depth</text>
        {[0.5, 0.75, 1.0].map((a) => <g key={a}><line x1={CX} y1={yA(a)} x2={CX + CW} y2={yA(a)} className="dt-cv-grid" /><text x={CX - 6} y={yA(a) + 4} className="dt-cv-ax" textAnchor="end">{(a * 100).toFixed(0)}</text></g>)}
        <line x1={xD(BEST)} y1={CY} x2={xD(BEST)} y2={CY + CH} className="dt-cv-best" />
        <text x={xD(BEST)} y={CY + CH + 15} className="dt-cv-best-lbl" textAnchor="middle">best d={BEST}</text>
        <polyline points={trainLine} className="dt-cv-train" />
        <polyline points={testLine} className="dt-cv-test" />
        <line x1={xD(depth)} y1={CY} x2={xD(depth)} y2={CY + CH} className="dt-cv-now" />
        <circle cx={xD(depth)} cy={yA(tr)} r="4" className="dt-cv-dot train" />
        <circle cx={xD(depth)} cy={yA(te)} r="4" className="dt-cv-dot test" />
        <text x={CX + CW} y={yA(CURVE[MAXD - 1].train) - 6} className="dt-cv-lbl train" textAnchor="end">train</text>
        <text x={CX + CW} y={yA(CURVE[MAXD - 1].test) + 16} className="dt-cv-lbl test" textAnchor="end">test</text>
      </g>}

      <text x={showCurve ? OX + SZ / 2 : 450} y="404" className={`dt-foot ${showCurve && te < CURVE[BEST - 1].test - 0.04 ? 'warn' : ''}`} textAnchor="middle">
        {on('questions') ? 'each internal node is a yes/no threshold question on one feature'
          : on('impurity') ? 'Gini impurity = 0 for a pure group, higher as classes mix'
          : on('greedy') ? 'one axis-aligned cut can only approximate the diagonal divide'
          : on('recurse') ? 'recurse → a staircase of axis-aligned steps tracks the diagonal'
          : on('overfit') ? 'hold out a fresh test set — then grow the tree and watch both curves'
          : te < CURVE[BEST - 1].test - 0.04 ? `depth ${depth}: train ${(tr * 100).toFixed(0)}% but test only ${(te * 100).toFixed(0)}% — memorizing noise`
          : `depth ${depth}: train ${(tr * 100).toFixed(0)}% · test ${(te * 100).toFixed(0)}% — still generalizing`}
      </text>
    </svg>
  );
}
