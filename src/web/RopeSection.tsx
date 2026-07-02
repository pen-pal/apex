// The rope, made visible. The document is the leaves of a tree; each internal node shows the length of its left
// subtree (the weight) that guides navigation. Insert or delete text and watch the tree splice in O(log n) —
// only a handful of nodes change, and the old version stays alive (free undo). Real logic from rope.ts.
import { useMemo, useState } from 'react';
import { fromChunks, insert, del, toStr, depth, length, type Rope } from './rope';

interface Placed { id: string; x: number; y: number; leaf: boolean; label: string }
interface Edge { x1: number; y1: number; x2: number; y2: number }

function layout(r: Rope): { nodes: Placed[]; edges: Edge[]; w: number; h: number } {
  const nodes: Placed[] = [], edges: Edge[] = [];
  let leafX = 0, maxD = 0;
  const place = (n: Rope, d: number, id: string): number => {
    maxD = Math.max(maxD, d);
    if ('text' in n) { const x = leafX++; nodes.push({ id, x, y: d, leaf: true, label: n.text || '∅' }); return x; }
    const lx = place(n.left, d + 1, id + 'L');
    const rx = place(n.right, d + 1, id + 'R');
    const x = (lx + rx) / 2;
    nodes.push({ id, x, y: d, leaf: false, label: `${n.weight}` });
    edges.push({ x1: x, y1: d, x2: lx, y2: d + 1 }); edges.push({ x1: x, y1: d, x2: rx, y2: d + 1 });
    return x;
  };
  place(r, 0, 'r');
  return { nodes, edges, w: Math.max(1, leafX), h: maxD };
}

export function RopeSection() {
  const [rope, setRope] = useState<Rope>(() => fromChunks(['The_quick_', 'brown_', 'fox']));
  const [pos, setPos] = useState(10);
  const [insText, setInsText] = useState('lazy_');
  const [note, setNote] = useState('a rope built from 3 chunks');

  const str = toStr(rope);
  const { nodes, edges, w, h } = useMemo(() => layout(rope), [rope]);

  const doInsert = () => { const p = Math.min(pos, str.length); setRope((r) => insert(r, p, insText)); setNote(`inserted "${insText}" at ${p} — split, graft a leaf, join (O(log n)); old rope kept for undo`); };
  const doDelete = () => { const p = Math.min(pos, str.length); const q = Math.min(p + 5, str.length); setRope((r) => del(r, p, q)); setNote(`deleted [${p}, ${q}) — split twice, join the ends`); };
  const reset = () => { setRope(fromChunks(['The_quick_', 'brown_', 'fox'])); setNote('reset'); };

  const W = 640, H = 40 + h * 62, PAD = 24;
  const nx = (x: number) => PAD + (w <= 1 ? (W - 2 * PAD) / 2 : (x / (w - 1)) * (W - 2 * PAD));
  const ny = (y: number) => 26 + y * 62;

  return (
    <div className="rpe">
      <p className="rpe-intro">
        A flat string makes inserting one character in the middle O(n) — every later byte shifts. A rope stores the
        text as the <strong>leaves of a tree</strong>; each internal node caches the length of its <strong>left
        subtree</strong> (its weight). To find character <em>i</em>, compare it to the weight and go left or right —
        so index, split, insert, and delete are all <strong>O(log n)</strong>. Edit the text:
      </p>

      <div className="rpe-str">{str.split('').map((ch, i) => <span key={i} className={`rpe-ch ${i === Math.min(pos, str.length) ? 'cursor' : ''}`}>{ch === '_' ? '␣' : ch}</span>)}</div>

      <div className="rpe-controls">
        <label>at <input type="range" min={0} max={str.length} value={Math.min(pos, str.length)} onChange={(e) => setPos(+e.target.value)} /> <b>{Math.min(pos, str.length)}</b></label>
        <input className="rpe-in" value={insText} onChange={(e) => setInsText(e.target.value)} spellCheck={false} />
        <button type="button" className="rpe-btn" onClick={doInsert}>insert</button>
        <button type="button" className="rpe-btn" onClick={doDelete}>delete 5</button>
        <button type="button" className="rpe-btn ghost" onClick={reset}>reset</button>
      </div>

      <div className="rpe-caption">{note}</div>

      <svg viewBox={`0 0 ${W} ${H}`} className="rpe-tree">
        {edges.map((e, i) => <line key={i} x1={nx(e.x1)} y1={ny(e.y1)} x2={nx(e.x2)} y2={ny(e.y2)} className="rpe-edge" />)}
        {nodes.map((n) => n.leaf
          ? <g key={n.id}><rect x={nx(n.x) - 30} y={ny(n.y) - 11} width={60} height={22} rx={4} className="rpe-leaf" /><text x={nx(n.x)} y={ny(n.y) + 4} className="rpe-lt" textAnchor="middle">{n.label.replace(/_/g, '␣').slice(0, 9)}</text></g>
          : <g key={n.id}><circle cx={nx(n.x)} cy={ny(n.y)} r={13} className="rpe-int" /><text x={nx(n.x)} y={ny(n.y) + 4} className="rpe-it" textAnchor="middle">{n.label}</text></g>)}
      </svg>

      <div className="rpe-stats">
        <div className="rpe-stat"><span>length</span><b>{length(rope)}</b></div>
        <div className="rpe-stat"><span>tree depth</span><b>{depth(rope)}</b></div>
        <div className="rpe-stat"><span>leaves (chunks)</span><b>{nodes.filter((n) => n.leaf).length}</b></div>
      </div>

      <p className="rpe-foot">
        The weight is the key: because a node knows only how long its left side is, a search never has to
        look inside the right subtree to decide which way to go, and an edit only rewrites the nodes on one
        root-to-leaf path — a handful, not the whole document. Immutability comes for free: since edits build new
        nodes and share the untouched ones, every version of the document persists, which is exactly how an editor
        gets unlimited undo without copying the file. The honest caveat is balance: plain concatenation can grow a
        lopsided tree that degrades to O(n), so real ropes rebalance (or bound leaf sizes and rebuild), trading a
        little edit cost for guaranteed log-depth. Ropes aren't the only answer — a <strong>gap buffer</strong>
        keeps a movable hole at the cursor so local typing is O(1) (great for one edit point, bad for many), and a
        <strong> piece table</strong> represents the document as a list of spans into an append-only buffer (which
        also gives cheap undo, and is what VS Code uses). They're all the same idea: never store the text as one
        contiguous block you have to shove around. (Boehm, Atkinson &amp; Plass, 1995.)
      </p>
    </div>
  );
}
