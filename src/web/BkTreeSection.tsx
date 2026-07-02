// Guided story: the BK-tree — the metric tree behind fuzzy search and spell-checkers. Find all dictionary words within
// edit distance k of a typo without scanning the whole dictionary, by exploiting the triangle inequality: edit distance
// is a proper metric, so a word within k of the query must lie within [d−k, d+k] of any node at distance d — every
// other child subtree is provably too far and is pruned. Real BK-tree + search, verified in node (same matches as
// brute force, fewer nodes visited). Sandboxed/CONCEPTUAL.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

function edit(a: string, b: string): number {
  const m = a.length, n = b.length; const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}
type Node = { w: string; ch: Map<number, Node> };
const WORDS = ['book', 'books', 'boo', 'boon', 'cook', 'cape', 'cart', 'boa', 'bake', 'bark', 'caps', 'hook', 'hooks', 'cake'];
let root: Node | null = null;
for (const w of WORDS) { if (!root) { root = { w, ch: new Map() }; continue; } let n = root; for (;;) { const dd = edit(w, n.w); if (dd === 0) break; if (n.ch.has(dd)) n = n.ch.get(dd)!; else { n.ch.set(dd, { w, ch: new Map() }); break; } } }

// layout: post-order x by leaf counter, y by depth
type Placed = { w: string; x: number; y: number; parent?: string; edge?: number };
const placed: Placed[] = []; let leafX = 0;
(function lay(n: Node, depth: number, parent?: string, edge?: number): number {
  const kids = [...n.ch.entries()];
  let x: number;
  if (kids.length === 0) x = leafX++;
  else { const xs = kids.map(([e, c]) => lay(c, depth + 1, n.w, e)); x = xs.reduce((a, b) => a + b, 0) / xs.length; }
  placed.push({ w: n.w, x, y: depth, parent, edge }); return x;
})(root!, 0);
const maxX = leafX - 1, maxY = Math.max(...placed.map((p) => p.y));
const px = (x: number) => 80 + (x / maxX) * 740, py = (y: number) => 80 + (y / maxY) * 300;
const POS = new Map(placed.map((p) => [p.w, p]));

const QUERIES: [string, number][] = [['bood', 1], ['cok', 1], ['boo', 2], ['carts', 1]];
function search(q: string, k: number) {
  const matches = new Set<string>(), visited = new Set<string>(); const dAt = new Map<string, number>();
  (function rec(n: Node) { visited.add(n.w); const d = edit(q, n.w); dAt.set(n.w, d); if (d <= k) matches.add(n.w); for (const [e, c] of n.ch) if (e >= d - k && e <= d + k) rec(c); })(root!);
  return { matches, visited, dAt };
}

type Phase = 'fuzzy' | 'tree' | 'triangle' | 'prune' | 'cheap' | 'run';

export function BkTreeSection() {
  const [qi, setQi] = useState(0);
  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <Bk phase={key} qi={0} /> });

  const scenes: StoryScene[] = [
    scene('fuzzy', 'Fuzzy search needs distance', 'A spell-checker must find dictionary words close to a typo — “bood” should suggest boo, book, boon — where close means a small edit distance (a few inserts, deletes, or substitutions). Comparing the typo to every one of 100,000 words is too slow. A BK-tree skips almost all of them.'),
    scene('tree', 'A tree keyed by distance', 'Build a tree where each edge is labelled with the edit distance between a word and its parent. To insert a word, walk down following the edge equal to its distance from the current node, and attach it wherever no child sits at that distance. Every edge is a distance, not a letter.'),
    scene('triangle', 'Edit distance obeys the triangle inequality', 'The key fact: edit distance is a proper metric, so for any three words d(a,c) ≤ d(a,b) + d(b,c). That means if your query is distance d from a node, any word within k of the query must be within d−k and d+k of that same node — no further, no nearer.'),
    scene('prune', 'Prune whole subtrees', 'So the search is cheap. At each node compute d(query, node); if d ≤ k it’s a match. Then descend only the children whose edge label lies in [d−k, d+k] — every other child, and its entire subtree, is provably too far to hold a match. One comparison rules out a whole branch.'),
    scene('cheap', 'The same answers, far fewer comparisons', 'The search returns exactly the words a brute-force scan of the whole dictionary would — the identical matches — while touching only a small fraction of the nodes. That’s how spell-checkers and fuzzy finders search huge word lists in real time.'),
    { key: 'run', title: 'Search the tree', caption: 'Pick a query and watch the search walk the tree: each visited node shows its distance to the query, matches (within k) glow green, and the branches the triangle inequality rules out are greyed — never even looked at. The count shows how few nodes it actually touches.', render: () => <Bk phase="run" qi={qi} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>A spell-checker has to find dictionary words close to a typo — “bood” should suggest boo, book, boon — where <em>close</em> means a small <strong>edit distance</strong> (few inserts, deletes, or substitutions). Comparing the typo against every one of 100,000 words is too slow. A BK-tree exploits one fact about edit distance — it is a proper <strong>metric</strong>, obeying the triangle inequality — to skip most of the dictionary.</>,
        takeaway: <>The tree is keyed by distance: each edge is labelled with the edit distance between a word and its parent, and inserting a word means walking down the edge equal to its distance from the current node until no child sits there. To find everything within k of a query, compute the distance d from the query to the current node (a match if d ≤ k), then — the pruning step — descend only the children whose edge label lies in <code>[d−k, d+k]</code>. The triangle inequality guarantees the rest cannot contain a match: any word w hanging off an edge of length e has d(query, w) ≥ |d(query, node) − e|, so if that lower bound exceeds k the whole subtree is too far to bother with. The result is the <strong>exact same matches</strong> a brute-force scan would return, while touching a small fraction of the nodes — which is how spell-checkers, fuzzy finders, and approximate-match search run over large word lists in real time. The same metric-tree idea (VP-trees, cover trees) generalizes to any distance obeying the triangle inequality.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="bk-ctl">
          {QUERIES.map(([q, k], i) => <button key={i} type="button" className={`bk-pick ${qi === i ? 'on' : ''}`} onClick={() => setQi(i)}>“{q}” within {k}</button>)}
          <span className="bk-live">{(() => { const { matches, visited } = search(QUERIES[qi][0], QUERIES[qi][1]); return `matches: ${[...matches].join(', ') || '—'} · visited ${visited.size}/${WORDS.length}`; })()}</span>
        </div>
      )}
    />
  );
}

function Bk({ phase, qi }: { phase: Phase; qi: number }) {
  const on = (p: Phase) => phase === p;
  const [q, k] = QUERIES[qi];
  const active = on('prune') || on('cheap') || on('run');
  const { matches, visited, dAt } = active ? search(q, k) : { matches: new Set<string>(), visited: new Set<string>(), dAt: new Map<string, number>() };
  return (
    <svg viewBox="0 0 900 480" className="story-svg">
      <text x="60" y="34" className="bk-col">BK-tree of {WORDS.length} words{active ? ` · query “${q}” within ${k} · visited ${visited.size}/${WORDS.length}` : ''}</text>

      {/* edges with distance labels */}
      {placed.map((p) => p.parent && (() => {
        const a = POS.get(p.parent)!; const pruned = active && !visited.has(p.w);
        return <g key={'e' + p.w}>
          <line x1={px(a.x)} y1={py(a.y)} x2={px(p.x)} y2={py(p.y)} className={`bk-edge ${pruned ? 'pruned' : ''}`} />
          <text x={(px(a.x) + px(p.x)) / 2 + 6} y={(py(a.y) + py(p.y)) / 2} className={`bk-edist ${pruned ? 'pruned' : ''}`}>{p.edge}</text>
        </g>;
      })())}

      {/* nodes */}
      {placed.map((p) => {
        const match = matches.has(p.w), vis = visited.has(p.w), pruned = active && !vis;
        return <g key={'n' + p.w}>
          <rect x={px(p.x) - 30} y={py(p.y) - 13} width="60" height="26" rx="6" className={`bk-node ${match ? 'match' : pruned ? 'pruned' : vis ? 'vis' : ''}`} />
          <text x={px(p.x)} y={py(p.y) + 5} className={`bk-word ${pruned ? 'pruned' : ''}`} textAnchor="middle">{p.w}</text>
          {active && vis && <text x={px(p.x)} y={py(p.y) - 18} className={`bk-d ${match ? 'match' : ''}`} textAnchor="middle">d={dAt.get(p.w)}</text>}
        </g>;
      })}

      {on('triangle') && <text x="450" y="430" className="bk-tri" textAnchor="middle">d(query, word) ≤ d(query, node) + d(node, word) → matches live in [d−k, d+k]</text>}

      <text x="450" y="462" className="bk-foot" textAnchor="middle">
        {on('fuzzy') ? 'find words within a small edit distance — without scanning all of them'
          : on('tree') ? 'every edge is the edit distance between a word and its parent'
          : on('triangle') ? 'edit distance is a metric: the triangle inequality bounds where matches can be'
          : on('prune') ? 'descend only children with edge in [d−k, d+k]; grey branches are ruled out'
          : on('cheap') ? `same matches as brute force, visiting ${visited.size} of ${WORDS.length} nodes`
          : `matches glow green; greyed subtrees were pruned unseen`}
      </text>
    </svg>
  );
}
