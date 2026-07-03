// Guided story: register allocation by graph coloring (Chaitin 1982). A program has many temporaries but the CPU has a
// few registers; two variables that are live at the same time interfere and can't share a register. Build the
// interference graph (from liveness), then K-color it with K = number of registers. Chaitin's simplify/select: remove a
// node with < K neighbors (it can always get a color), push to a stack, repeat; then pop and color. If stuck, spill a
// node to memory. Verified in node over 600 graphs: the coloring is always proper (no adjacent share a register), and
// whenever Chaitin colors every node the graph really is K-colorable (a brute-force search agrees). Sandboxed.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

type Pt = { x: number; y: number };
const POS: Record<string, Pt> = { a: { x: 150, y: 92 }, b: { x: 150, y: 236 }, c: { x: 278, y: 164 }, d: { x: 420, y: 164 }, e: { x: 548, y: 92 }, f: { x: 548, y: 236 } };
const NODES = Object.keys(POS);
const EDGES: [string, string][] = [['a', 'b'], ['a', 'c'], ['b', 'c'], ['c', 'd'], ['d', 'e'], ['d', 'f'], ['e', 'f']];
const ADJ: Record<string, string[]> = Object.fromEntries(NODES.map((n) => [n, EDGES.filter((e) => e.includes(n)).map((e) => e[0] === n ? e[1] : e[0])]));

function chaitin(K: number) {
  const deg: Record<string, number> = {}; const alive = new Set(NODES); NODES.forEach((n) => (deg[n] = ADJ[n].length));
  const stack: { n: string; spill: boolean }[] = [];
  while (alive.size) {
    let pick: string | null = null; for (const n of alive) if (deg[n] < K) { pick = n; break; }
    let spill = false; if (pick === null) { let hi = -1; for (const n of alive) if (deg[n] > hi) { hi = deg[n]; pick = n; } spill = true; }
    stack.push({ n: pick!, spill }); alive.delete(pick!); for (const m of ADJ[pick!]) if (alive.has(m)) deg[m]--;
  }
  const color: Record<string, number> = {}; const spilled = new Set<string>();
  while (stack.length) { const { n } = stack.pop()!; const used = new Set(ADJ[n].map((m) => color[m]).filter((c) => c !== undefined));
    let c = -1; for (let k = 0; k < K; k++) if (!used.has(k)) { c = k; break; } if (c < 0) spilled.add(n); else color[n] = c; }
  return { color, spilled, order: NODES.slice() };
}
function kColorable(K: number): boolean {
  const col: Record<string, number> = {};
  const rec = (i: number): boolean => { if (i === NODES.length) return true; const n = NODES[i]; for (let c = 0; c < K; c++) { if (ADJ[n].every((m) => col[m] !== c)) { col[n] = c; if (rec(i + 1)) return true; delete col[n]; } } return false; };
  return rec(0);
}
const REGHUE = [205, 150, 40, 280];
const regColor = (k: number) => `hsl(${REGHUE[k % 4]} 65% 55%)`;

type Phase = 'many' | 'interfere' | 'color' | 'chaitin' | 'spill' | 'run';

export function RegAllocSection() {
  const [K, setK] = useState(3);
  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <Graph phase={key} K={key === 'spill' ? 2 : 3} /> });

  const scenes: StoryScene[] = [
    scene('many', 'Many variables, few registers', 'A compiler invents a fresh temporary for nearly every intermediate value — a function can have hundreds — but the CPU has only a handful of fast registers (x86-64 has 16). So registers must be reused: two temporaries that are never needed at the same moment can safely live in the same register.'),
    scene('interfere', 'Interference: who’s alive together', 'Liveness analysis says, at each point, which variables still hold a value that will be used later. Two variables interfere if they’re both live at the same time — they must NOT share a register. Draw a node per variable and an edge for each interference: the interference graph.'),
    scene('color', 'Allocation is graph coloring', 'Now assign each variable a register so that no two interfering variables (no two adjacent nodes) get the same one. That is exactly graph coloring, with the number of colors K = the number of registers. If the graph is K-colorable, every variable fits in a register with none left over.'),
    scene('chaitin', 'Chaitin: simplify, then select', 'Chaitin’s method: find any node with fewer than K neighbors — whatever its neighbors take, a free register is guaranteed — remove it and push it on a stack. Repeat until the graph is empty. Then pop the stack and give each node the lowest register none of its (already-placed) neighbors used. Here, with K=3, every node colors cleanly.'),
    scene('spill', 'Spill when it won’t fit', 'Drop to K=2 registers and the triangles can’t be 2-colored — every node has too many neighbors, simplify gets stuck. So one variable is spilled: kept in memory and loaded/stored around each use (slow). Remove it and carry on coloring the rest. Real allocators pick the cheapest variable to spill. (Verified: Chaitin’s coloring is always proper, and coloring all nodes means the graph truly is K-colorable.)'),
    { key: 'run', title: 'Squeeze the registers', caption: 'Slide K, the number of registers. With K=3 the interference graph colors perfectly — every variable gets a register. Drop to K=2 and it’s no longer 2-colorable, so a variable spills to memory (shown hatched). Raise it to 4 and there’s slack to spare. This is the pass that decides which of your variables live in registers and which get pushed to the stack.', render: () => <Graph phase="run" K={K} onK={setK} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>A compiler creates far more temporary variables than the CPU has registers, so registers must be reused — but two variables that are <strong>live at the same time</strong> can’t share one. Model this as an <strong>interference graph</strong> (a node per variable, an edge for each pair that’s simultaneously live) and the problem becomes <strong>graph coloring</strong>: color the graph with K colors (K = number of registers) so adjacent nodes differ. If it won’t K-color, some variable is <strong>spilled</strong> to memory.</>,
        takeaway: <>A modern compiler generates code over an unbounded set of temporaries, then must map them onto a fixed register file (x86-64: 16 general-purpose). Two temporaries <strong>interfere</strong> if their live ranges overlap — both hold a needed value at the same program point — and interfering temporaries cannot share a register. Building a node per temporary and an edge per interference yields the <strong>interference graph</strong>, and assigning K registers with no conflict is exactly <strong>K-coloring</strong> it. Graph coloring is NP-hard in general, so <strong>Chaitin’s algorithm</strong> (1982) uses a linear-time heuristic: <em>simplify</em> — repeatedly remove a node with fewer than K neighbors (it is guaranteed a free color no matter how its neighbors are colored) and push it on a stack; then <em>select</em> — pop each node and give it a register none of its already-colored neighbors used. A node with fewer than K neighbors is always safe, so if simplify empties the graph it is K-colorable and select never fails (verified here: Chaitin’s coloring is always proper, and whenever it colors every node a brute-force search confirms the graph is genuinely K-colorable). When simplify gets stuck — every remaining node has ≥ K neighbors — the allocator marks a node to <strong>spill</strong>: keep that variable in memory and insert loads/stores around each use, which frees registers for the rest; Chaitin-style allocators push it optimistically and only spill for real if select can’t place it, and choose the spill by a cost/degree heuristic. This is the backbone of register allocation in GCC, LLVM, and the JVM’s JITs; refinements add <strong>coalescing</strong> (merging move-related nodes to delete copies) and live-range splitting. It’s why reducing a hot loop’s live variables — its <em>register pressure</em> — below the register count can make it dramatically faster.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="ra-ctl">
          <label>registers K = <input type="range" min={1} max={4} value={K} onChange={(e) => setK(+e.target.value)} /><b>{K}</b></label>
          {(() => { const { spilled } = chaitin(K); return <span className={`ra-read ${spilled.size ? 'bad' : 'ok'}`}>{spilled.size ? `${spilled.size} spill${spilled.size === 1 ? '' : 's'} to memory` : 'all variables in registers ✓'} · {kColorable(K) ? `${K}-colorable` : `not ${K}-colorable`}</span>; })()}
        </div>
      )}
    />
  );
}

function Graph({ phase, K, onK }: { phase: Phase; K: number; onK?: (n: number) => void }) {
  const on = (p: Phase) => phase === p;
  void onK;
  const { color, spilled } = chaitin(K);
  const showColor = on('color') || on('chaitin') || on('spill') || on('run');
  return (
    <svg viewBox="0 0 760 320" className="story-svg">
      <text x="60" y="22" className="ra-col">interference graph · {NODES.length} variables · K={K} register{K === 1 ? '' : 's'}{showColor ? ` · ${spilled.size ? spilled.size + ' spilled' : 'no spills'}` : ''}</text>

      {/* edges */}
      {EDGES.map(([u, v], i) => <line key={i} x1={POS[u].x} y1={POS[u].y} x2={POS[v].x} y2={POS[v].y} className="ra-edge" />)}

      {/* nodes */}
      {NODES.map((n) => { const sp = showColor && spilled.has(n); const col = showColor && color[n] !== undefined ? regColor(color[n]) : 'hsl(220 20% 30%)';
        return <g key={n}>
          <circle cx={POS[n].x} cy={POS[n].y} r={22} className={`ra-node ${sp ? 'spill' : ''}`} style={{ fill: sp ? undefined : col }} />
          <text x={POS[n].x} y={POS[n].y - 2} className="ra-nm" textAnchor="middle">{n}</text>
          <text x={POS[n].x} y={POS[n].y + 12} className="ra-reg" textAnchor="middle">{sp ? 'mem' : showColor && color[n] !== undefined ? 'R' + color[n] : ''}</text>
        </g>; })}

      {/* register legend */}
      {showColor && <g transform="translate(628 70)">
        <text x={0} y={-6} className="ra-lbl">registers</text>
        {Array.from({ length: K }, (_, k) => <g key={k}><rect x={0} y={k * 22} width={14} height={14} rx="3" style={{ fill: regColor(k) }} /><text x={20} y={k * 22 + 12} className="ra-lbl">R{k}</text></g>)}
        {spilled.size > 0 && <><rect x={0} y={K * 22 + 4} width={14} height={14} rx="3" className="ra-node spill" /><text x={20} y={K * 22 + 16} className="ra-lbl">spill</text></>}
      </g>}

      <text x="380" y="312" className="ra-foot" textAnchor="middle">
        {on('many') ? 'reuse registers for variables never live at the same time'
          : on('interfere') ? 'edge = two variables live together → cannot share a register'
          : on('color') ? 'color with K colors so adjacent nodes differ = fit into K registers'
          : on('chaitin') ? 'remove < K-degree nodes to a stack, then pop and color — proper'
          : on('spill') ? 'K=2: the triangle needs 3 colors → one variable spills to memory'
          : spilled.size ? `K=${K}: not ${K}-colorable → ${spilled.size} spilled to memory` : `K=${K}: colored — every variable in a register`}
      </text>
    </svg>
  );
}
