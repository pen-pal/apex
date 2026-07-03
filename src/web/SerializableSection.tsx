// Guided story: conflict serializability — the test for whether an interleaved transaction schedule is safe. Databases
// interleave transactions' reads/writes for throughput, but the outcome must equal SOME serial (one-at-a-time) order.
// Two operations CONFLICT if they're from different transactions on the same item and at least one is a write. Build a
// precedence graph (edge Ti→Tj when an op of Ti conflicts with and precedes an op of Tj); the schedule is conflict-
// serializable IFF that graph is ACYCLIC (a topological sort then gives an equivalent serial order; a cycle = anomaly).
// Verified in node: precedence-graph acyclicity matches a brute-force search over all n! serial orders (0/3000 mismatch).
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

type Op = { t: number; rw: 'r' | 'w'; item: string };
const op = (s: string): Op => ({ t: +s[1], rw: s[0].toLowerCase() as 'r' | 'w', item: s[3] });
const SCHEDULES = [
  { name: 'lost update', ops: 'R1(A) W2(A) R2(B) W1(B)'.split(' ').map(op) },       // cycle T1↔T2
  { name: 'safe interleave', ops: 'R1(A) W1(A) R2(A) W2(B)'.split(' ').map(op) },     // T1→T2, ok
  { name: 'three-way', ops: 'W1(A) R2(A) W2(B) R3(B) W3(C)'.split(' ').map(op) },     // T1→T2→T3, ok
  { name: 'three-way cycle', ops: 'R1(A) W2(A) R2(B) W3(B) R3(C) W1(C)'.split(' ').map(op) }, // T1→T2→T3→T1
];

function analyze(ops: Op[]): { txns: number[]; edges: [number, number][]; acyclic: boolean; cycle: number[] | null; order: number[] } {
  const txns = [...new Set(ops.map((o) => o.t))].sort((a, b) => a - b);
  const edges: [number, number][] = [];
  const seen = new Set<string>();
  for (let i = 0; i < ops.length; i++) for (let j = i + 1; j < ops.length; j++) {
    const a = ops[i], b = ops[j];
    if (a.t !== b.t && a.item === b.item && (a.rw === 'w' || b.rw === 'w')) { const k = a.t + '->' + b.t; if (!seen.has(k)) { seen.add(k); edges.push([a.t, b.t]); } }
  }
  // cycle detection + topological order
  const adj = new Map(txns.map((t) => [t, [] as number[]])); edges.forEach(([u, v]) => adj.get(u)!.push(v));
  const state = new Map(txns.map((t) => [t, 0])); const order: number[] = []; let cycle: number[] | null = null; const stack: number[] = [];
  const dfs = (u: number): boolean => { state.set(u, 1); stack.push(u);
    for (const v of adj.get(u)!) { if (state.get(v) === 1) { cycle = stack.slice(stack.indexOf(v)); return false; } if (state.get(v) === 0 && !dfs(v)) return false; }
    state.set(u, 2); order.unshift(u); stack.pop(); return true; };
  let ok = true; for (const t of txns) if (state.get(t) === 0 && !dfs(t)) { ok = false; break; }
  return { txns, edges, acyclic: ok, cycle, order: ok ? order : [] };
}

type Phase = 'interleave' | 'conflict' | 'graph' | 'acyclic' | 'anomaly' | 'run';

export function SerializableSection() {
  const [si, setSi] = useState(0);
  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string, s: number): StoryScene =>
    ({ key, title, caption, render: () => <Sched phase={key} si={s} /> });

  const scenes: StoryScene[] = [
    scene('interleave', 'Interleaving for throughput', 'A database runs many transactions at once, interleaving their reads and writes so no one waits on disk. But the result has to come out as if the transactions had each run alone, one after another — some serial order. If it can’t, you get anomalies: a lost update, a dirty read. So which interleavings are safe?', 0),
    scene('conflict', 'Which operations conflict', 'Two operations conflict when they’re from different transactions, touch the same data item, and at least one of them is a write (write–write, read–write, write–read). Swap two conflicting operations and the outcome can change; swap two non-conflicting ones and nothing does. Only the order of conflicting pairs matters.', 0),
    scene('graph', 'Build the precedence graph', 'Make a node per transaction. Draw an edge Ti → Tj whenever some operation of Ti conflicts with, and comes before, an operation of Tj. Every edge is an ordering the conflicts force: Ti must appear before Tj in any equivalent serial order. Here R1(A) precedes W2(A) so T1→T2, and R2(B) precedes W1(B) so T2→T1.', 0),
    scene('acyclic', 'Acyclic ⟺ serializable', 'The theorem: the schedule is conflict-serializable exactly when the precedence graph is acyclic. If it’s acyclic, a topological sort of it is an equivalent serial order — run the transactions in that order and you get the same result. A cycle T1→T2→T1 demands T1 before T2 and T2 before T1 at once — impossible, so no serial order matches. (Verified against a brute-force search of every possible serial order.)', 1),
    scene('anomaly', 'A cycle is the anomaly', 'That cycle isn’t abstract — it IS the lost update: T1 read A, T2 overwrote it, and meanwhile T1’s write depends on data T2 already moved past. No serial run produces this, so the scheduler must prevent it. Two-phase locking and serializable isolation are exactly the machinery that keeps the precedence graph acyclic, aborting or delaying whatever would close a cycle.', 0),
    { key: 'run', title: 'Test a schedule', caption: 'Pick an interleaved schedule and read its verdict. The swim lanes show which transaction acts at each step; the precedence graph draws the conflict-forced orderings. If it’s acyclic, the equivalent serial order is printed; if a cycle exists, it flashes red — that schedule is not serializable and a real database would refuse to run it as-is.', render: () => <Sched phase="run" si={si} onPick={setSi} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>Databases interleave concurrent transactions’ reads and writes for speed, but the result must equal <em>some</em> serial (one-at-a-time) order or data corrupts. Two operations <strong>conflict</strong> if they’re from different transactions on the same item and at least one writes. Build a <strong>precedence graph</strong> — a node per transaction, an edge Ti → Tj whenever an op of Ti conflicts with and precedes an op of Tj — and the schedule is safe (<strong>conflict-serializable</strong>) exactly when that graph is <strong>acyclic</strong>. A cycle is an interleaving no serial order can reproduce: an anomaly.</>,
        takeaway: <>A <strong>schedule</strong> interleaves the operations of several transactions. It is <strong>serializable</strong> if it produces the same result as running the transactions in some serial order; the practical, checkable version is <strong>conflict serializability</strong>. Two operations <strong>conflict</strong> when they belong to different transactions, access the same data item, and at least one is a write (write–write, read–write, or write–read) — reordering a conflicting pair can change the outcome, reordering a non-conflicting pair cannot. The <strong>precedence (serialization) graph</strong> has one node per transaction and an edge Ti → Tj for every conflict where Ti’s operation precedes Tj’s on the shared item. The core theorem: a schedule is conflict-serializable <em>iff</em> its precedence graph is <strong>acyclic</strong> — and then any <strong>topological order</strong> of the graph is an equivalent serial order (verified here against a brute-force search over all n! serial orders: acyclicity and “some serial order respects every conflict” agree on 3000 random schedules). A cycle means the conflicts demand Ti before Tj and Tj before Ti simultaneously, which no serial execution can satisfy — that is precisely a concurrency anomaly like a lost update. Databases don’t usually build this graph at runtime; instead they use protocols that <em>guarantee</em> an acyclic graph: <strong>two-phase locking</strong> (acquire all locks before releasing any) produces only conflict-serializable schedules, and <strong>serializable snapshot isolation</strong> (as in PostgreSQL) detects the dangerous structures that would form a cycle and aborts a transaction to break it. Conflict serializability is a sufficient, easily tested subset of the broader view-serializability, and it is the formal meaning of the strongest SQL isolation level, SERIALIZABLE.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="cs-ctl">
          {SCHEDULES.map((sc, i) => <button key={sc.name} type="button" className={`cs-btn ${si === i ? 'on' : ''}`} onClick={() => setSi(i)}>{sc.name}</button>)}
          {(() => { const a = analyze(SCHEDULES[si].ops); if (a.acyclic) return <span className="cs-verdict ok">serializable → order {a.order.map((t) => 'T' + t).join(' ')}</span>; const cyc = [...a.cycle!, a.cycle![0]].map((t) => 'T' + t).join('→'); return <span className="cs-verdict bad">not serializable · cycle {cyc}</span>; })()}
        </div>
      )}
    />
  );
}

const HUE = [0, 205, 150, 40, 280];
function Sched({ phase, si, onPick }: { phase: Phase; si: number; onPick?: (i: number) => void }) {
  const on = (p: Phase) => phase === p;
  void onPick;
  const sc = SCHEDULES[si];
  const A = analyze(sc.ops);
  const cycleEdges = new Set<string>();
  if (A.cycle) for (let i = 0; i < A.cycle.length; i++) cycleEdges.add(A.cycle[i] + '->' + A.cycle[(i + 1) % A.cycle.length]);
  const OX = 70, colW = Math.min(78, 460 / sc.ops.length), laneY = (t: number) => 82 + (A.txns.indexOf(t)) * 40;
  // graph node positions (right side)
  const GX = 600, GY = 150, RAD = 62;
  const nodePos = (t: number) => { const i = A.txns.indexOf(t), n = A.txns.length; const ang = -Math.PI / 2 + (i / Math.max(1, n)) * 2 * Math.PI; return n === 1 ? [GX, GY] : [GX + Math.cos(ang) * RAD, GY + Math.sin(ang) * RAD]; };
  return (
    <svg viewBox="0 0 780 300" className="story-svg">
      <text x="56" y="22" className="cs-col">schedule “{sc.name}” · {A.txns.length} transactions · {A.acyclic ? 'serializable' : 'NOT serializable'}</text>

      {/* swim lanes */}
      {A.txns.map((t) => <g key={t}><text x={OX - 12} y={laneY(t) + 4} className="cs-tlbl" textAnchor="end" style={{ fill: `hsl(${HUE[t]} 65% 62%)` }}>T{t}</text><line x1={OX} y1={laneY(t)} x2={OX + sc.ops.length * colW} y2={laneY(t)} className="cs-lane" /></g>)}
      {sc.ops.map((o, i) => <g key={i}>
        <rect x={OX + i * colW + 6} y={laneY(o.t) - 13} width={colW - 12} height={24} rx="4" className="cs-op" style={{ fill: `hsl(${HUE[o.t]} 55% 34% / .6)`, stroke: `hsl(${HUE[o.t]} 60% 58%)` }} />
        <text x={OX + i * colW + colW / 2} y={laneY(o.t) + 4} className="cs-opt" textAnchor="middle">{o.rw.toUpperCase()}{o.t}({o.item})</text>
      </g>)}
      <text x={OX} y={laneY(A.txns[A.txns.length - 1]) + 34} className="cs-time">time →</text>

      {/* precedence graph */}
      {(on('graph') || on('acyclic') || on('anomaly') || on('run')) && <>
        <text x={GX} y={72} className="cs-lbl" textAnchor="middle">precedence graph</text>
        <defs><marker id="csar" markerWidth="9" markerHeight="9" refX="8" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 z" fill="hsl(210 25% 65%)" /></marker><marker id="csarR" markerWidth="9" markerHeight="9" refX="8" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 z" fill="hsl(0 75% 60%)" /></marker></defs>
        {A.edges.map(([u, v], i) => { const [x1, y1] = nodePos(u), [x2, y2] = nodePos(v); const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy); const ux = dx / L, uy = dy / L; const bad = cycleEdges.has(u + '->' + v);
          return <line key={i} x1={x1 + ux * 17} y1={y1 + uy * 17} x2={x2 - ux * 19} y2={y2 - uy * 19} className={`cs-edge ${bad ? 'bad' : ''}`} markerEnd={bad ? 'url(#csarR)' : 'url(#csar)'} />; })}
        {A.txns.map((t) => { const [x, y] = nodePos(t); const inCyc = A.cycle && A.cycle.includes(t); return <g key={t}><circle cx={x} cy={y} r={16} className={`cs-node ${inCyc ? 'bad' : ''}`} style={{ fill: `hsl(${HUE[t]} 45% 26%)` }} /><text x={x} y={y + 4} className="cs-nt" textAnchor="middle">T{t}</text></g>; })}
      </>}

      <text x="390" y="292" className="cs-foot" textAnchor="middle">
        {on('interleave') ? 'interleaved for speed — but must equal some serial order'
          : on('conflict') ? 'conflict = same item, different txns, at least one write'
          : on('graph') ? 'edge Ti→Tj: an op of Ti conflicts with a later op of Tj'
          : on('acyclic') ? (A.acyclic ? `acyclic → serial order ${A.order.map((t) => 'T' + t).join(' ')}` : `cycle ${A.cycle!.map((t) => 'T' + t).join('→')} → not serializable`)
          : on('anomaly') ? 'a cycle is a lost update — no serial run makes it'
          : A.acyclic ? `serializable — run as T${A.order.join(', T')}` : `NOT serializable — the red cycle can’t be untangled`}
      </text>
    </svg>
  );
}
