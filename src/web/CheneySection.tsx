// Guided story: Cheney's copying garbage collector (1970). The heap is two semispaces; the mutator bump-allocates in
// from-space, and a collection copies only the reachable objects into to-space, compacted, then flips the roles — the
// whole old space (live + garbage) is reclaimed at once. Cheney's insight: do the copy as a breadth-first walk using
// to-space ITSELF as the queue, with two pointers (scan = next to process, free = next free slot) and a forwarding
// pointer left in each moved object so nothing is copied twice. Verified in node: copied set == BFS-reachable from roots
// (400 heaps, 0 mismatch), forwarding pointers valid, to-space compact, all pointers rewritten. Complements [[gc]]
// (mark-and-sweep, which frees in place and leaves fragmentation). Sandboxed/CONCEPTUAL.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

// a small object heap. each object has pointer fields to other objects. roots point in.
const HEAP: Record<string, string[]> = { A: ['B', 'D'], B: ['E'], C: ['F'], D: ['E'], E: [], F: ['A'], G: ['H'], H: [] };
const ORDER = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']; // allocation order in from-space
const ROOTS = ['A', 'C'];

type Frame = { copied: string[]; scan: number; free: number; act: string; hot?: string };
function buildFrames(): Frame[] {
  const frames: Frame[] = []; const copied: string[] = []; const fwd = new Map<string, number>();
  const snap = (act: string, hot?: string) => frames.push({ copied: [...copied], scan, free, act, hot });
  let scan = 0, free = 0;
  const copy = (o: string, act: string) => { if (fwd.has(o)) return; fwd.set(o, free); copied.push(o); free = copied.length; snap(act, o); };
  snap('from-space full — start a collection');
  for (const r of ROOTS) copy(r, `copy root ${r} → to-space, leave a forwarding pointer`);
  while (scan < copied.length) {
    const o = copied[scan];
    if (HEAP[o].length === 0) { snap(`scan ${o}: no pointers`, o); scan++; snap(`advance scan past ${o}`); continue; }
    for (const f of HEAP[o]) { if (fwd.has(f)) snap(`scan ${o}: ${f} already copied → follow forwarding pointer`, o); else copy(f, `scan ${o}: copy referent ${f}`); }
    scan++; snap(`advance scan past ${o}`);
  }
  snap('scan caught free — done. garbage (G, H) abandoned');
  return frames;
}
const FRAMES = buildFrames();
const REACH = new Set(FRAMES[FRAMES.length - 1].copied); // A B C D E F

const FX = 150, TX = 560, ROWY = 70, RH = 30, BW = 92;
type Phase = 'fragment' | 'semispace' | 'roots' | 'scan' | 'garbage' | 'run';

export function CheneySection() {
  const [f, setF] = useState(5);
  const frameFor = (key: Exclude<Phase, 'run'>): number => key === 'fragment' || key === 'semispace' ? 0 : key === 'roots' ? 2 : key === 'scan' ? Math.min(6, FRAMES.length - 1) : FRAMES.length - 1;
  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <Cy phase={key} fi={frameFor(key)} /> });

  const scenes: StoryScene[] = [
    scene('fragment', 'The heap fills with live and dead', 'In a managed language you never call free(). Objects pile up in the heap; some are still reachable from the roots (the stack, registers, globals), and some have become garbage — no path leads to them anymore. Here A–F are still reachable; G and H are dead but still sitting there.'),
    scene('semispace', 'Two halves: from-space and to-space', 'A copying collector splits the heap into two equal halves. All allocation happens in from-space (a single bump of a pointer). When it fills, the collector copies every LIVE object into the empty to-space, packed tight — then simply flips which half is “active,” reclaiming the entire old half, garbage and all, for free.'),
    scene('roots', 'Copy the roots, leave forwarding pointers', 'Start from the roots. Copy each root’s object into to-space and update the root to point at the new copy. Crucially, leave a forwarding pointer in the OLD object — a note saying “I’ve moved to slot k.” If anything else points here later, it follows the note instead of copying a second time.'),
    scene('scan', 'Cheney’s trick: to-space IS the queue', 'Now the elegant part — a breadth-first copy with no separate stack or queue. Two pointers into to-space: free (where the next copy lands) and scan (the next copied object still needing work). Walk scan forward; for each pointer field, copy the target (or follow its forwarding pointer) and rewrite the field. Newly copied objects queue up ahead of scan automatically.'),
    scene('garbage', 'Scan meets free — done', 'When scan catches up to free, every reachable object has been copied and every pointer rewritten to its new address. To-space now holds the live objects, compacted with zero gaps; from-space — including all the garbage — is abandoned wholesale. (Verified: the copied set equals exactly the reachable set from the roots.)'),
    { key: 'run', title: 'Run the collector', caption: 'Step the collection: watch objects copy from from-space into to-space, forwarding pointers appear in the moved originals, and the scan/free pointers march through to-space in breadth-first order. When they meet, the live objects are compacted in to-space and the garbage (G, H) is left behind — reclaimed by the flip.', render: () => <Cy phase="run" fi={f} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>A <strong>copying</strong> garbage collector splits the heap into two halves. All allocation happens in one half (“from-space”); when it fills, the collector copies only the reachable objects into the other half (“to-space”), packed tight, and then the entire old half — live objects and garbage alike — is reclaimed in one stroke by flipping which half is active. <strong>Cheney’s algorithm</strong> does the copy as a breadth-first walk of the object graph that needs no extra stack: it uses the to-space itself as the queue.</>,
        takeaway: <>A copying (semispace) collector divides the heap into two equal halves; the mutator allocates in from-space by bumping a pointer, and when it fills a collection copies every live object into to-space and swaps the roles. Liveness is <strong>reachability from the roots</strong> (registers, stack, globals). <strong>Cheney’s algorithm</strong> (1970) performs this copy as a breadth-first traversal with no auxiliary stack or queue, using two pointers into to-space: <code>free</code> (where the next copied object goes) and <code>scan</code> (the next copied object whose fields still need forwarding). It first copies the root-referenced objects — each copy leaves a <strong>forwarding pointer</strong> in the old object so it’s never copied twice, and updates the reference to the new address — then advances <code>scan</code> through to-space; for each field of each scanned object it copies the referent (or follows its forwarding pointer if already copied) and rewrites the field. When <code>scan</code> catches up to <code>free</code>, every reachable object has been copied and every pointer updated (verified here: the copied set equals the breadth-first reachable set from the roots exactly, each copied object carries a valid forwarding pointer, and to-space is compact). The wins: allocation is a single pointer bump, collection cost is proportional to the <em>live</em> data (not the garbage), and survivors come out compacted, so fragmentation vanishes and locality improves. The costs: you use half the address space, and every live object moves, so pointers must be found and rewritten. This bump-allocate-and-copy design is the heart of the young generation in generational collectors (the JVM, .NET, V8, Go’s earlier GC), where most objects die young and copying the few survivors is cheap. Its sibling is <strong>mark-and-sweep</strong>, which instead frees dead objects in place and leaves fragmentation behind.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="cy-ctl">
          <button type="button" className="cy-btn" onClick={() => setF((v) => Math.max(0, v - 1))}>‹ step</button>
          <input type="range" min={0} max={FRAMES.length - 1} value={f} onChange={(e) => setF(+e.target.value)} />
          <button type="button" className="cy-btn" onClick={() => setF((v) => Math.min(FRAMES.length - 1, v + 1))}>step ›</button>
          <span className="cy-step">{f + 1}/{FRAMES.length}</span>
        </div>
      )}
    />
  );
}

function Cy({ phase, fi }: { phase: Phase; fi: number }) {
  const on = (p: Phase) => phase === p;
  const idx = fi;
  const F = FRAMES[idx];
  const toIdxOf = (o: string) => F.copied.indexOf(o);
  const showTo = !on('fragment');
  const done = idx === FRAMES.length - 1;
  return (
    <svg viewBox="0 0 900 340" className="story-svg">
      <text x="60" y="22" className="cy-col">Cheney copying GC · roots → {ROOTS.join(', ')}{showTo ? ` · scan=${F.scan} free=${F.free}` : ''}</text>

      {/* roots */}
      <text x={FX + BW / 2} y={ROWY - 26} className="cy-lbl" textAnchor="middle">roots</text>
      {ROOTS.map((r, i) => <g key={r}><rect x={FX + i * 46} y={ROWY - 18} width={40} height={16} rx="3" className="cy-root" /><text x={FX + 20 + i * 46} y={ROWY - 6} className="cy-rt" textAnchor="middle">{r}</text></g>)}

      {/* from-space column */}
      <text x={FX + BW / 2} y={ROWY + 6} className="cy-hdr" textAnchor="middle">from-space</text>
      {ORDER.map((o, i) => { const moved = F.copied.includes(o); const garbage = done && !REACH.has(o);
        return <g key={o}>
          <rect x={FX} y={ROWY + 14 + i * RH} width={BW} height={RH - 5} rx="4" className={`cy-obj ${moved ? 'moved' : ''} ${garbage ? 'garbage' : ''} ${F.hot === o ? 'hot' : ''}`} />
          <text x={FX + 8} y={ROWY + 14 + i * RH + 17} className="cy-ot">{o}{HEAP[o].length ? `→${HEAP[o].join(',')}` : ''}</text>
          {moved && <text x={FX + BW - 6} y={ROWY + 14 + i * RH + 17} className="cy-fwd" textAnchor="end">⇢{toIdxOf(o)}</text>}
        </g>; })}

      {/* to-space column */}
      {showTo && <>
        <text x={TX + BW / 2} y={ROWY + 6} className="cy-hdr" textAnchor="middle">to-space (compacted)</text>
        {F.copied.map((o, i) => <g key={o}>
          <rect x={TX} y={ROWY + 14 + i * RH} width={BW} height={RH - 5} rx="4" className={`cy-obj to ${i === F.scan ? 'scan' : ''} ${i < F.scan ? 'scanned' : ''}`} />
          <text x={TX + 8} y={ROWY + 14 + i * RH + 17} className="cy-ot">{o}{HEAP[o].length ? `→${HEAP[o].map((t) => { const j = F.copied.indexOf(t); return j >= 0 ? t : t + '?'; }).join(',')}` : ''}</text>
        </g>)}
        {/* scan / free markers */}
        {F.scan < 6 && <text x={TX - 10} y={ROWY + 14 + F.scan * RH + 17} className="cy-scan" textAnchor="end">scan▸</text>}
        <text x={TX - 10} y={ROWY + 14 + F.free * RH + 14} className="cy-free" textAnchor="end">free▸</text>
        {/* forwarding arrows for the hot object */}
        {F.hot && F.copied.includes(F.hot) && (() => { const i = ORDER.indexOf(F.hot); const j = toIdxOf(F.hot); return <line x1={FX + BW} y1={ROWY + 14 + i * RH + 12} x2={TX} y2={ROWY + 14 + j * RH + 12} className="cy-fwline" />; })()}
      </>}

      <text x="450" y={332} className="cy-act" textAnchor="middle">{F.act}</text>
    </svg>
  );
}
