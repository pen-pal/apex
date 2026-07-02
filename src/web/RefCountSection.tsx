// Guided story: how reference counting frees memory (and why cycles defeat it) — the deterministic counterpart to
// tracing GC. Each object carries a count of how many references point to it; copy a reference and it increments, drop
// one and it decrements, and the instant it hits zero the object is freed. A real refcount simulator: it computes the
// cascade of frees, and — the fatal flaw — detects the cycle leak (objects whose counts stay >0 but are unreachable
// from any root). A weak reference (points without counting) breaks the cycle. Complements the tracing-GC story.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

// fixed object graph: root R -> A, A -> B, A -> C, B -> A (the back-edge that forms a cycle).
type Edge = { from: string; to: string; weak: boolean; root?: boolean };
function simulate(rootDropped: boolean, weakBack: boolean, dropC: boolean) {
  const objs = ['A', 'B', 'C'];
  const edges: Edge[] = [
    { from: 'R', to: 'A', weak: false, root: true },
    { from: 'A', to: 'B', weak: false },
    { from: 'A', to: 'C', weak: false },
    { from: 'B', to: 'A', weak: weakBack },
  ].filter((e) => !(e.root && rootDropped) && !(e.from === 'A' && e.to === 'C' && dropC));

  // reference-count cascade: an object with zero strong incoming refs (from live sources) is freed, repeat.
  const freed = new Set<string>();
  for (let pass = 0; pass < 4; pass++) for (const o of objs) {
    if (freed.has(o)) continue;
    const cnt = edges.filter((e) => e.to === o && !e.weak && (e.root || !freed.has(e.from))).length;
    if (cnt === 0) freed.add(o);
  }
  // true reachability from the root (via strong edges) — what tracing GC would keep
  const reach = new Set<string>();
  if (!rootDropped) { const st = ['A']; while (st.length) { const x = st.pop()!; if (reach.has(x)) continue; reach.add(x); for (const e of edges) if (e.from === x && !e.weak) st.push(e.to); } }

  const count: Record<string, number> = {}; const state: Record<string, 'alive' | 'freed' | 'leaked'> = {};
  for (const o of objs) {
    count[o] = freed.has(o) ? 0 : edges.filter((e) => e.to === o && !e.weak && (e.root || !freed.has(e.from))).length;
    state[o] = freed.has(o) ? 'freed' : reach.has(o) ? 'alive' : 'leaked';
  }
  return { edges, count, state, leaked: objs.some((o) => state[o] === 'leaked') };
}

type Phase = 'count' | 'incdec' | 'free' | 'cycle' | 'weak' | 'run';

export function RefCountSection() {
  const [rootDropped, setRootDropped] = useState(false);
  const [weakBack, setWeakBack] = useState(false);

  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string, rd: boolean, wb: boolean, dc: boolean): StoryScene =>
    ({ key, title, caption, render: () => <RC sim={simulate(rd, wb, dc)} phase={key} rootDropped={rd} weakBack={wb} /> });

  const scenes: StoryScene[] = [
    scene('count', 'Every object counts its references', 'Reference counting is the opposite of a tracing collector walking the heap. Give every object a number: how many references currently point to it. Here a root variable and object B both point to A, so A’s count is 2; A points to B and C, so each of those is 1.', false, false, false),
    scene('incdec', 'Up on copy, down on drop', 'Copy a reference — assign it to a variable, pass it to a function, store it in a field — and the target’s count goes up by one. Drop a reference — reassign the variable, or leave the scope it lived in — and the count goes down by one. The object is alive exactly as long as its count is above zero.', false, false, false),
    scene('free', 'Zero means free — immediately', 'The instant a count reaches zero, nothing can reach that object, so it is freed right then. Drop A’s reference to C and C’s count falls to 0 — freed on the spot, no collector, no pause. This determinism is the appeal: a C++ destructor runs exactly here, closing the file or socket the moment the last owner goes away.', false, false, true),
    scene('cycle', 'The fatal flaw: cycles', 'Now the problem. B points back to A, so A and B reference each other. Drop the root — every reference from outside is gone. But A still holds B and B still holds A, so both counts stay at 1. Nothing in the program can reach them, yet neither is freed. That is a memory leak reference counting cannot see.', true, false, false),
    scene('weak', 'A weak reference breaks it', 'The fix is a weak reference: it points to an object without incrementing its count. Make B’s back-edge to A weak, drop the root, and A’s count falls to 0 → A frees → B’s count falls to 0 → B frees → C frees. The whole cycle collapses. But you had to spot the cycle and place the weak reference by hand.', true, true, false),
    { key: 'run', title: 'Drop the root, break the cycle', caption: 'Drop the root reference and watch the cycle A↔B leak — both counts stuck at 1, unreachable but never freed (red). Then make B’s back-edge weak and the counts fall to zero and everything is reclaimed. This is exactly the leak that tracing GC exists to catch automatically.', render: () => <RC sim={simulate(rootDropped, weakBack, false)} phase="run" rootDropped={rootDropped} weakBack={weakBack} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>Tracing GC periodically walks the whole heap to find what’s reachable. Reference counting takes the opposite approach: give every object a counter of how many references point to it. Increment it whenever a reference is copied, decrement it whenever one is dropped, and the instant the count hits zero — nobody can reach the object — free it immediately. No collector, no pause; memory is reclaimed deterministically, the moment its last owner goes away.</>,
        takeaway: <>This is what C++ <code>shared_ptr</code>, Rust’s <code>Rc</code>/<code>Arc</code>, Swift’s ARC, and CPython all use, and its determinism is the appeal: a C++ destructor runs exactly at scope exit, closing the file or socket right then. The costs are two: every reference assignment does bookkeeping (a decrement is a memory write, and thread-safe counts must be <em>atomic</em>, which is expensive) — and, the fatal flaw, reference counting cannot reclaim <strong>cycles</strong>. Two objects that point at each other keep each other’s count at 1 forever, so even after every outside reference is gone, they leak. The fix is a <strong>weak reference</strong>, which points without counting, so you break the cycle by hand — and the reason tracing GC exists is that it finds those cycles automatically. Most real systems combine them: refcounting for determinism, plus a cycle collector or weak references to plug the leak.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <>
          <label className="rct-ctl"><input type="checkbox" checked={rootDropped} onChange={(e) => setRootDropped(e.target.checked)} /> drop the root</label>
          <label className="rct-ctl"><input type="checkbox" checked={weakBack} onChange={(e) => setWeakBack(e.target.checked)} /> make B→A weak</label>
          <span className={`rct-live ${simulate(rootDropped, weakBack, false).leaked ? 'bad' : 'ok'}`}>{simulate(rootDropped, weakBack, false).leaked ? '⚠ cycle leaked — counts stuck above zero' : rootDropped ? 'all reclaimed — counts reached zero' : 'all reachable and alive'}</span>
        </>
      )}
    />
  );
}

const POS: Record<string, [number, number]> = { R: [110, 150], A: [340, 190], B: [610, 110], C: [470, 330] };
function RC({ sim, phase, rootDropped, weakBack }: { sim: ReturnType<typeof simulate>; phase: Phase; rootDropped: boolean; weakBack: boolean }) {
  const nodeCls = (o: string) => `rct-node ${sim.state[o]}`;
  return (
    <svg viewBox="0 0 900 480" className="story-svg">
      <text x="60" y="46" className="rct-col">objects on the heap (count = incoming references)</text>

      {/* edges */}
      {sim.edges.map((e, i) => {
        const [x1, y1] = POS[e.from], [x2, y2] = POS[e.to];
        const back = e.from === 'B' && e.to === 'A';
        return <path key={i} d={back ? `M${x1},${y1} Q${(x1 + x2) / 2},${y1 - 70} ${x2},${y2}` : `M${x1},${y1} L${x2},${y2}`} className={`rct-edge ${e.weak ? 'weak' : ''} ${e.root ? 'root' : ''}`} markerEnd={`url(#rct-${e.weak ? 'wk' : 'st'})`} fill="none" />;
      })}

      {/* root variable */}
      {!rootDropped && <><rect x={POS.R[0] - 55} y={POS.R[1] - 22} width="110" height="44" rx="6" className="rct-root" /><text x={POS.R[0]} y={POS.R[1] + 5} className="rct-rootlbl" textAnchor="middle">root var</text></>}
      {rootDropped && <text x={POS.R[0]} y={POS.R[1] + 5} className="rct-dropped" textAnchor="middle">root dropped ✕</text>}

      {/* objects */}
      {['A', 'B', 'C'].map((o) => {
        const [x, y] = POS[o];
        return (
          <g key={o}>
            <circle cx={x} cy={y} r="34" className={nodeCls(o)} />
            <text x={x} y={y - 2} className="rct-name" textAnchor="middle">{o}</text>
            <text x={x} y={y + 16} className="rct-cnt" textAnchor="middle">{sim.state[o] === 'freed' ? 'freed' : `rc=${sim.count[o]}`}</text>
            {sim.state[o] === 'leaked' && <text x={x} y={y + 52} className="rct-leaklbl" textAnchor="middle">leaked</text>}
          </g>
        );
      })}

      <text x="450" y="452" className="rct-foot" textAnchor="middle">
        {phase === 'count' ? 'count = how many references currently point at each object'
          : phase === 'incdec' ? 'copy a reference → +1; drop one → −1; alive while count > 0'
          : phase === 'free' ? 'C’s count hit 0 → freed instantly, deterministically, no collector'
          : phase === 'cycle' ? 'A↔B reference each other → counts stuck at 1 → unreachable but never freed'
          : phase === 'weak' ? 'weak back-edge doesn’t count → the cycle’s counts reach 0 → all freed'
          : weakBack ? 'weak reference breaks the cycle — everything reclaimed' : rootDropped ? 'the A↔B cycle leaks — this is what tracing GC catches' : 'drop the root, then make B→A weak'}
      </text>
      <defs>
        <marker id="rct-st" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" className="rct-ah" /></marker>
        <marker id="rct-wk" markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" className="rct-ah wk" /></marker>
      </defs>
    </svg>
  );
}
