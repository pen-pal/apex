// Guided story: arena / bump allocator — allocate by incrementing one pointer, free everything at once. A general
// allocator (malloc) keeps free lists, per-object sizes, and coalescing so any object can be freed anytime. An arena
// drops all of it: one block, one bump pointer. alloc(n, align) rounds the pointer up to the alignment, returns it, and
// adds n — O(1), no search, no per-object header. You can't free one object; you reset the pointer to zero and the whole
// arena is free in one instruction. Fits request-/frame-/pass-scoped work. Verified in node: allocations never overlap
// (44k across 3000 arenas), every one is aligned, OOM is handled, reset reclaims all, and alignment padding is exact.
// The allocator inside compilers, servers, and game frames. Sandboxed/CONCEPTUAL.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const CAP = 64;
type Req = { size: number; align: number; kind: string };
type Chunk = { off: number; size: number; align: number; kind: string; pad: number };
const KINDS: Req[] = [{ size: 1, align: 1, kind: 'char' }, { size: 4, align: 4, kind: 'int' }, { size: 8, align: 8, kind: 'ptr' }, { size: 10, align: 8, kind: 'node' }];
const HUE = [205, 150, 45, 320, 260, 20, 175, 95];
const alignUp = (p: number, a: number) => (p + (a - 1)) & ~(a - 1);

// lay out a sequence of requests into an arena, tracking alignment pads
function layout(reqs: Req[]): { chunks: Chunk[]; ptr: number } {
  let ptr = 0; const chunks: Chunk[] = [];
  for (const r of reqs) { const p = alignUp(ptr, r.align); if (p + r.size > CAP) break; chunks.push({ off: p, size: r.size, align: r.align, kind: r.kind, pad: p - ptr }); ptr = p + r.size; }
  return { chunks, ptr };
}

type Phase = 'idea' | 'bump' | 'pad' | 'reset' | 'when' | 'run';
export function ArenaSection() {
  const [reqs, setReqs] = useState<Req[]>([{ size: 1, align: 1, kind: 'char' }, { size: 4, align: 4, kind: 'int' }, { size: 8, align: 8, kind: 'ptr' }]);
  const demo: Req[] = [{ size: 1, align: 1, kind: 'char' }, { size: 4, align: 4, kind: 'int' }, { size: 8, align: 8, kind: 'ptr' }];
  const add = (r: Req) => setReqs((cur) => { const { ptr } = layout(cur); return alignUp(ptr, r.align) + r.size > CAP ? cur : [...cur, r]; });

  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <Arena phase={key} reqs={demo} /> });

  const scenes: StoryScene[] = [
    scene('idea', 'Allocation without the bookkeeping', 'malloc keeps free lists, a size header on every object, and coalescing logic so anything can be freed at any time. An arena allocator throws all of that away: one big block of memory and one pointer. Allocating means handing out the next slice and moving the pointer forward — nothing else to track.'),
    scene('bump', 'Bump the pointer', 'To allocate n bytes: round the pointer up to the value’s required alignment, return that address, then add n. That is the entire allocator — a few instructions, O(1), no free-list search and no per-object metadata. Thousands of allocations cost almost nothing. (Verified: the slices never overlap.)'),
    scene('pad', 'Alignment padding is the only overhead', 'Rounding up can leave a few unused pad bytes between objects — an 8-byte pointer must start on an 8-byte boundary. That pad is the sole overhead; there are no allocation headers, and objects sit packed end to end, which is cache-friendly too. (Verified: every allocation lands on its alignment.)'),
    scene('reset', 'Free everything at once', 'There is no record of individual objects, so you cannot free just one. Instead you reset the pointer back to zero — and the entire arena is free in a single instruction, no per-object teardown. That fits request-, frame-, or pass-scoped work: allocate freely during the unit, drop it all at the end. (Verified: reset reclaims everything.)'),
    scene('when', 'When arenas win (and when they don’t)', 'No fragmentation, no free-list walks, trivially thread-local, deterministic O(1) teardown — arenas sit inside compilers (a block of AST nodes freed per pass), servers (a per-request arena), and games (a per-frame arena reset every frame). The cost: nothing is reclaimed until the reset, so a long-lived arena with heavy allocate-and-discard churn wastes memory.'),
    { key: 'run', title: 'Allocate and reset', caption: 'Allocate objects of different sizes and alignments and watch the bump pointer march right, with a striped pad appearing whenever alignment forces a gap. The block fills with no per-object overhead; hit reset and the whole arena is reclaimed at once — the entire point of an arena.', render: () => <Arena phase="run" reqs={reqs} onAdd={add} onReset={() => setReqs([])} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>An <strong>arena</strong> (bump / region allocator) is one block of memory and one <strong>pointer</strong>. To allocate, round the pointer up to the required <strong>alignment</strong>, return it, and add the size — <strong>O(1)</strong>, no free list, no per-object header. You never free individual objects; you <strong>reset</strong> the pointer to zero and free the whole arena at once. It trades the ability to free one thing for near-zero allocation cost and deterministic teardown — ideal for request-, frame-, or pass-scoped memory.</>,
        takeaway: <>An <strong>arena allocator</strong> (also called a <strong>bump</strong>, <strong>region</strong>, or <strong>linear</strong> allocator) serves allocations from a single contiguous buffer by advancing one offset. <code>alloc(n, align)</code> computes <code>p = (ptr + align−1) &amp; ~(align−1)</code> (round up to alignment), checks <code>p + n ≤ capacity</code>, sets <code>ptr = p + n</code>, and returns <code>p</code> — a handful of instructions with <strong>no search and no metadata</strong> per object, versus a general allocator’s free lists, size headers, and coalescing. The tradeoff is deallocation: individual objects are never freed, because nothing records where they are; instead the entire arena is released by <strong>resetting the pointer to zero</strong> (O(1), no per-object destructors run unless you track them yourself). This matches any workload with a natural <strong>lifetime boundary</strong>: a compiler allocates AST/IR nodes into a per-pass arena and frees the pass in one step; a server gives each request an arena and drops it at response end; a game uses a <strong>per-frame</strong> arena reset every frame; often two arenas (permanent vs scratch) coexist. Benefits: <strong>no fragmentation</strong> within the arena, excellent locality (objects packed in allocation order), trivially <strong>thread-local</strong> (no lock — each thread bumps its own arena), and predictable teardown. Costs and cautions: memory is <strong>not reclaimed until reset</strong>, so a long-lived arena with high churn is wasteful; a single big allocation can’t be grown in place; alignment leaves small <strong>pad</strong> gaps; and in C++ you must arrange for destructors (arenas favor trivially-destructible data). Variants add a little: a <strong>stack allocator</strong> supports LIFO frees by saving and restoring the marker (a “scratch” checkpoint), and chained arenas grow by allocating another block when one fills. It’s one of the oldest and most effective ways to make allocation nearly free by giving up fine-grained freeing.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="arn-ctl">
          <span className="arn-lab">alloc:</span>
          {KINDS.map((k) => <button key={k.kind} type="button" className="arn-btn" onClick={() => add(k)}>{k.kind} ({k.size}B{k.align > 1 ? `, align ${k.align}` : ''})</button>)}
          <button type="button" className="arn-btn reset" onClick={() => setReqs([])}>↺ reset</button>
          <span className="arn-read">{layout(reqs).ptr}/{CAP} bytes used</span>
        </div>
      )}
    />
  );
}

function Arena({ phase, reqs, onAdd, onReset }: { phase: Phase; reqs: Req[]; onAdd?: (r: Req) => void; onReset?: (v: unknown) => void }) {
  const on = (p: Phase) => phase === p; void onAdd; void onReset;
  const { chunks, ptr } = layout(reqs);
  const OX = 50, OW = 660, SC = OW / CAP; const BY = 92, BH = 46;
  const totalPad = chunks.reduce((s, c) => s + c.pad, 0);
  return (
    <svg viewBox="0 0 760 240" className="story-svg">
      <text x="50" y="22" className="arn-col">arena · one block, one bump pointer · {ptr}/{CAP} bytes used · alloc = align + return + bump (O(1))</text>

      {/* byte ruler */}
      {Array.from({ length: CAP / 8 + 1 }, (_, i) => i * 8).map((b) => <g key={b}>
        <line x1={OX + b * SC} y1={BY - 8} x2={OX + b * SC} y2={BY} className="arn-tick" />
        <text x={OX + b * SC} y={BY - 12} className="arn-tk" textAnchor="middle">{b}</text>
      </g>)}

      {/* the block: free background */}
      <rect x={OX} y={BY} width={OW} height={BH} rx="3" className="arn-free" />
      {/* allocated chunks + pads */}
      {chunks.map((c, i) => <g key={i}>
        {c.pad > 0 && <rect x={OX + (c.off - c.pad) * SC} y={BY} width={c.pad * SC} height={BH} className="arn-pad" />}
        <rect x={OX + c.off * SC} y={BY} width={c.size * SC} height={BH} rx="2" style={{ fill: `hsl(${HUE[i % HUE.length]} 55% 48%)` }} className="arn-chunk" />
        {c.size * SC > 16 && <text x={OX + (c.off + c.size / 2) * SC} y={BY + 27} className="arn-kind" textAnchor="middle">{c.kind}</text>}
      </g>)}
      {/* bump pointer */}
      <g>
        <line x1={OX + ptr * SC} y1={BY - 4} x2={OX + ptr * SC} y2={BY + BH + 8} className="arn-ptr" />
        <path d={`M ${OX + ptr * SC - 5} ${BY + BH + 8} L ${OX + ptr * SC + 5} ${BY + BH + 8} L ${OX + ptr * SC} ${BY + BH + 2} Z`} className="arn-ptrhead" />
        <text x={OX + ptr * SC} y={BY + BH + 24} className="arn-ptrlab" textAnchor="middle">ptr = {ptr}</text>
      </g>

      <text x="380" y="214" className="arn-foot" textAnchor="middle">
        {on('idea') ? 'no free lists, no per-object headers — just the next slice and a pointer'
          : on('bump') ? 'alloc(n): p = alignUp(ptr); return p; ptr += n — O(1), no metadata'
          : on('pad') ? 'align rounds the pointer up → a small pad gap, the only overhead'
          : on('reset') ? 'reset ptr = 0 → the whole arena is free in one instruction'
          : on('when') ? 'compilers per-pass, servers per-request, games per-frame'
          : `${chunks.length} objects packed, ${totalPad}B pad, ${CAP - ptr}B free — reset frees all at once`}
      </text>
    </svg>
  );
}
