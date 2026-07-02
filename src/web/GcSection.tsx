// Guided story #13: how garbage collection reclaims memory — tracing mark-and-sweep, on the GuidedStory engine.
// In a managed language you never call free(); the runtime must decide what is dead. Scenes: the problem, the roots,
// mark (trace reachable objects), sweep (free the unmarked), why tracing beats reference counting on cycles, then a
// live heap — drop a reference and run the collector, watching reachable objects survive and unreachable ones (even
// a cycle) get swept. Reachability is computed for real from the object graph.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const NODES: Record<string, { x: number; y: number }> = {
  A: { x: 250, y: 180 }, C: { x: 210, y: 310 }, B: { x: 440, y: 180 }, D: { x: 440, y: 310 },
  E: { x: 680, y: 200 }, F: { x: 780, y: 300 }, G: { x: 790, y: 150 },
};
const ROOT = { x: 440, y: 80 };
type Edge = [string, string];
const BASE_EDGES: Edge[] = [['A', 'C'], ['B', 'D'], ['D', 'B'], ['E', 'F'], ['F', 'E']];
const rootEdges = (dropB: boolean): Edge[] => dropB ? [['root', 'A']] : [['root', 'A'], ['root', 'B']];

function reachable(dropB: boolean): Set<string> {
  const edges = [...rootEdges(dropB), ...BASE_EDGES];
  const seen = new Set<string>(['root']); const q = ['root'];
  while (q.length) { const n = q.shift()!; for (const [f, t] of edges) if (f === n && !seen.has(t)) { seen.add(t); q.push(t); } }
  seen.delete('root');
  return seen;
}

type Phase = 'heap' | 'roots' | 'mark' | 'sweep' | 'cycle' | 'run';
type Mode = 'all' | 'mark' | 'swept';

export function GcSection() {
  const [dropB, setDropB] = useState(false);
  const [mode, setMode] = useState<Mode>('all');

  const narrated = (key: Phase, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <Heap phase={key} dropB={false} mode={key === 'mark' || key === 'cycle' ? 'mark' : key === 'sweep' ? 'swept' : 'all'} /> });

  const scenes: StoryScene[] = [
    narrated('heap', 'You never call free()', 'In JavaScript, Python, Java, or Go you allocate objects but never free them. They pile up in the heap. So the runtime has to work out, on its own, which objects your program can never possibly use again — and reclaim exactly those.'),
    narrated('roots', 'Start from the roots', 'The collector starts from the roots: the things that are definitely alive right now — local variables on the stack, globals, CPU registers. An object is live if and only if you can reach it by following pointers from some root.'),
    narrated('mark', 'Mark — trace what’s reachable', 'Walk the object graph from every root, marking each object you reach. It is just a graph traversal. Everything marked is reachable, so it stays. Notice E and F: they point at each other, but no root reaches them.'),
    narrated('sweep', 'Sweep — free the rest', 'Now walk the whole heap. Anything left unmarked has no path from any root — nothing in your program can ever touch it again — so it is freed and its memory returns to the allocator. E, F, and G are gone.'),
    narrated('cycle', 'Why not just count references?', 'Reference counting frees an object when its count hits zero — but E and F each hold a reference to the other, so both counts stay at 1 forever, and the pair leaks. Tracing does not care about counts, only reachability, so it collects the whole unreachable cycle.'),
    { key: 'run', title: 'Collect it yourself', caption: 'Drop the reference from the roots to B, then run the collector. B and D are now an island — a cycle with no path from a root — so mark-and-sweep reclaims them too. Reachability, not counts, is what keeps an object alive.', render: () => <Heap phase="run" dropB={dropB} mode={mode} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>In a managed language you allocate objects but never free them, so the runtime has to work out on its own which ones your program can never touch again — and reclaim exactly those. The key realization is that “still needed” means “reachable”: an object is alive if and only if you can get to it by following pointers from a root (a local variable, a global, a register).</>,
        takeaway: <>A tracing collector marks everything reachable from the roots, then sweeps the rest — anything left unmarked has no path from any root, so nothing can ever reference it again and it is safe to free. This is why tracing beats simple reference counting: two objects that point at each other keep both their counts at 1 forever and leak, but tracing collects the whole cycle because no root reaches it. The price is a pause to trace; the benefit — never freeing by hand, and never freeing too early — is why most modern languages choose it.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <>
          <label className="gc-toggle"><input type="checkbox" checked={dropB} onChange={(e) => { setDropB(e.target.checked); setMode('all'); }} /> drop root → B</label>
          <button type="button" onClick={() => setMode((m) => m === 'all' ? 'mark' : m === 'mark' ? 'swept' : 'all')}>{mode === 'all' ? 'mark ▶' : mode === 'mark' ? 'sweep ▶' : '↻ reset'}</button>
          <span className="gc-live">{mode === 'swept' ? `freed ${7 - reachable(dropB).size} object(s)` : mode === 'mark' ? `${reachable(dropB).size} reachable` : 'heap has 7 objects'}</span>
        </>
      )}
    />
  );
}

function Heap({ phase, dropB, mode }: { phase: Phase; dropB: boolean; mode: Mode }) {
  const on = (p: Phase) => phase === p;
  const live = reachable(dropB);
  const edges = [...rootEdges(dropB), ...BASE_EDGES];
  const swept = mode === 'swept';
  const ptOf = (id: string) => id === 'root' ? ROOT : NODES[id];
  return (
    <svg viewBox="0 0 900 480" className="story-svg">
      {/* roots */}
      <rect x="340" y="56" width="200" height="44" rx="8" className={`gc-roots ${on('roots') ? 'hot' : ''}`} />
      <text x="440" y="83" className="gc-roots-lbl" textAnchor="middle">roots: stack · globals</text>
      {/* legend + label so the objects and colours read without the captions */}
      <text x="46" y="150" className="gc-leg dim">objects on the heap:</text>
      <circle cx="56" cy="176" r="8" className="gc-node marked" />
      <text x="72" y="181" className="gc-leg">reachable — kept</text>
      <circle cx="56" cy="204" r="8" className="gc-node dead" />
      <text x="72" y="209" className="gc-leg">unreachable — freed</text>
      {/* edges */}
      {edges.map(([f, t], i) => {
        const a = ptOf(f), b = ptOf(t);
        const dead = swept && !live.has(t);
        if (dead) return null;
        const cyc = (f === 'E' || f === 'F' || (f === 'D' && t === 'B'));
        return <line key={i} x1={a.x} y1={a.y + (f === 'root' ? 22 : 0)} x2={b.x} y2={b.y} className={`gc-edge ${cyc ? 'cyc' : ''}`} markerEnd="url(#gc-arr)" />;
      })}
      <defs><marker id="gc-arr" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" className="gc-arrhead" /></marker></defs>
      {/* nodes */}
      {Object.entries(NODES).map(([id, pt]) => {
        const isLive = live.has(id);
        if (swept && !isLive) return null; // freed
        const marked = (mode === 'mark' || mode === 'swept') && isLive;
        const cond = (mode !== 'all') && !isLive; // condemned during mark/sweep
        return (
          <g key={id}>
            <circle cx={pt.x} cy={pt.y} r="24" className={`gc-node ${marked ? 'marked' : ''} ${cond ? 'dead' : ''}`} />
            <text x={pt.x} y={pt.y + 6} className="gc-node-lbl" textAnchor="middle">{id}</text>
          </g>
        );
      })}
      {(on('cycle') || (on('run') && !dropB)) && <text x="730" y="360" className="gc-note" textAnchor="middle">E ⇄ F: a cycle, unreachable</text>}
      <text x="450" y="452" className="gc-foot" textAnchor="middle">
        {on('heap') ? 'objects accumulate — the runtime must find the dead ones itself'
          : on('roots') ? 'live = reachable from a root by following pointers'
          : on('mark') ? 'trace from the roots, marking every object reached (green)'
          : on('sweep') ? 'unmarked objects are freed — E, F, G had no path from a root'
          : on('cycle') ? 'a cycle keeps reference counts non-zero, but tracing collects it anyway'
          : (mode === 'all' ? 'press mark, then sweep' : mode === 'mark' ? 'green = reachable and marked' : `unreachable objects reclaimed`)}
      </text>
    </svg>
  );
}
