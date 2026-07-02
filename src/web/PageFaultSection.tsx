// Guided story #20: how a page fault brings in memory — demand paging, on the GuidedStory engine. Your program's
// address space is mostly not backed by real RAM; the kernel conjures a page in only when you touch it. Scenes: the
// idea, the page-table "not present" trap, the handler deciding what the page should be, fill-and-retry, why lazy
// paging matters, then a live memory you access — present pages hit, absent ones fault and get loaded. Complements
// the page-table-walk (translation), page-replacement (eviction), and copy-on-write (fork) sections.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

type Kind = 'code' | 'heap' | 'stack' | 'file' | 'zero' | 'swap';
const VP: { kind: Kind }[] =[{ kind: 'code' }, { kind: 'heap' }, { kind: 'file' }, { kind: 'zero' }, { kind: 'swap' }, { kind: 'stack' }];
const NFRAMES = 4;
type Phase = 'idea' | 'trap' | 'handler' | 'retry' | 'why' | 'run';

export function PageFaultSection() {
  const [resident, setResident] = useState<Record<number, number>>({ 0: 0, 1: 1, 5: 2 }); // vpage -> frame
  const [order, setOrder] = useState<number[]>([0, 1, 5]); // LRU order of resident vpages
  const [sel, setSel] = useState<number>(2);
  const [state, setState] = useState<'idle' | 'fault' | 'loaded'>('idle');

  const access = (v: number) => {
    setSel(v);
    if (v in resident) { setState('idle'); setOrder((o) => [...o.filter((x) => x !== v), v]); return; }
    setState('fault');
    setTimeout(() => {
      setResident((r) => {
        const used = Object.values(r); let frame = [0, 1, 2, 3].find((f) => !used.includes(f));
        let evict: number | null = null;
        if (frame === undefined) { evict = order[0]; frame = r[evict]; }
        const nr = { ...r }; if (evict !== null) delete nr[evict]; nr[v] = frame!; return nr;
      });
      setOrder((o) => { const used = Object.values(resident); const full = used.length >= NFRAMES; const base = full ? o.slice(1) : o; return [...base, v]; });
      setState('loaded');
    }, 800);
  };

  const narrated = (key: Phase, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <Mem phase={key} resident={key === 'retry' || key === 'why' ? { 0: 0, 1: 1, 5: 2, 2: 3 } : { 0: 0, 1: 1, 5: 2 }} sel={2} state={key === 'trap' || key === 'handler' ? 'fault' : key === 'retry' || key === 'why' ? 'loaded' : 'idle'} /> });

  const scenes: StoryScene[] = [
    narrated('idea', 'Memory you don’t have yet', 'Your program is handed a huge, private address space — but most of it isn’t actually in RAM. The operating system only puts a page into physical memory the moment you first touch it. Touch a page that isn’t there and the hardware raises a page fault.'),
    narrated('trap', 'The page table says “not present”', 'Translating a virtual address means walking the page table (the page-table-walk section). If the entry’s present bit is 0, there is no physical frame behind it — so instead of completing your read or write, the CPU traps into the kernel’s page-fault handler.'),
    narrated('handler', 'The handler decides what belongs there', 'The kernel looks at what you mapped at that address: a fresh zero-filled page (new heap or stack), a page of a file (your program’s own code, or an mmap), or a page that was earlier evicted to swap. It grabs a free physical frame — evicting another page if RAM is full — and fills it from the right source.'),
    narrated('retry', 'Fix the entry, retry the instruction', 'It writes the frame’s address into the page-table entry and sets present = 1, then returns from the trap. The CPU simply re-runs the very instruction that faulted; this time the translation succeeds and the access completes. Your program never noticed it stalled.'),
    narrated('why', 'Why do it this way?', 'Because pages arrive on demand: starting a program doesn’t load all of it, only the pages you touch; a gigabyte malloc costs nothing until you write to it; and many processes can share one physical copy of the same library. The price is that the first touch of a page is slower — a fault, and sometimes a disk read.'),
    { key: 'run', title: 'Touch some memory', caption: 'Click a virtual page. If it is already resident you get an instant hit; if not, watch the fault: the CPU traps, the handler loads the page into a physical frame (evicting one if all four are full), fixes the page table, and the access retries.', render: () => <Mem phase="run" resident={resident} sel={sel} state={state} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>Your program is handed a vast, private address space, but most of it is not backed by real RAM — the operating system only conjures a page into physical memory the instant you actually touch it. Access a page that isn’t there and the hardware raises a <em>page fault</em>; the kernel makes the page appear before your instruction even finishes. Nothing in your code changes — the memory just seems to have been there all along.</>,
        takeaway: <>Address translation walks the page table; if the entry is marked “not present,” the CPU traps into the kernel instead of completing the access. The handler works out what belongs there — zero-filled new memory, a page of a file, or something evicted to swap — finds a physical frame (evicting another page if RAM is full), fills it, points the entry at it, and re-runs the faulting instruction, which now succeeds. This demand paging is why a program starts instantly instead of loading wholesale, why a 1 GB allocation is free until you write to it, and why the very first touch of fresh memory is mysteriously slower than every touch after.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <>
          <span className="pgf-ctl-lbl">access virtual page:</span>
          {VP.map((_, v) => <button key={v} type="button" className={`pgf-btn ${sel === v ? 'sel' : ''} ${v in resident ? 'res' : ''}`} onClick={() => access(v)}>{v}</button>)}
          <span className={`pgf-live ${state === 'fault' ? 'bad' : ''}`}>{state === 'fault' ? 'page fault → loading…' : sel in resident ? `hit — page ${sel} in frame ${resident[sel]}` : 'not resident'}</span>
        </>
      )}
    />
  );
}

function Mem({ phase, resident, sel, state }: { phase: Phase; resident: Record<number, number>; sel: number; state: 'idle' | 'fault' | 'loaded' }) {
  const on = (p: Phase) => phase === p;
  const present = sel in resident;
  const faulting = state === 'fault';
  return (
    <svg viewBox="0 0 900 480" className="story-svg">
      {/* page table */}
      <text x="60" y="60" className="pgf-col">page table (virtual → physical)</text>
      {VP.map((pg, v) => {
        const res = v in resident; const cur = v === sel;
        return (
          <g key={v}>
            <rect x="50" y={78 + v * 40} width="360" height="34" rx="5" className={`pgf-row ${cur ? (res ? 'hit' : faulting ? 'fault' : 'sel') : ''}`} />
            <text x="66" y={100 + v * 40} className="pgf-vp">page {v}</text>
            <text x="150" y={100 + v * 40} className="pgf-kind">{pg.kind}</text>
            <text x="300" y={100 + v * 40} className={`pgf-pte ${res ? 'present' : 'absent'}`}>{res ? `→ frame ${resident[v]}` : 'not present'}</text>
          </g>
        );
      })}
      {/* physical RAM */}
      <text x="620" y="60" className="pgf-col" textAnchor="middle">physical RAM ({NFRAMES} frames)</text>
      {[0, 1, 2, 3].map((f) => {
        const owner = Object.entries(resident).find(([, fr]) => fr === f)?.[0];
        return (
          <g key={f}>
            <rect x="520" y={80 + f * 46} width="200" height="40" rx="6" className={`pgf-frame ${owner !== undefined ? 'used' : ''} ${owner === String(sel) ? 'cur' : ''}`} />
            <text x="536" y={105 + f * 46} className="pgf-frame-lbl">frame {f}</text>
            <text x="700" y={105 + f * 46} className="pgf-frame-owner" textAnchor="end">{owner !== undefined ? `page ${owner}` : 'free'}</text>
          </g>
        );
      })}
      {/* disk / sources */}
      <rect x="760" y="120" width="110" height="150" rx="8" className="pgf-disk" />
      <text x="815" y="112" className="pgf-col" textAnchor="middle">disk</text>
      <text x="815" y="170" className="pgf-disk-lbl" textAnchor="middle">files</text>
      <text x="815" y="200" className="pgf-disk-lbl" textAnchor="middle">swap</text>
      {(faulting || on('handler')) && !present && <text x="815" y="240" className="pgf-disk-lbl load" textAnchor="middle">↑ loading {VP[sel].kind}</text>}

      <text x="450" y="452" className="pgf-foot" textAnchor="middle">
        {on('idea') ? 'a page enters RAM only when first touched — demand paging'
          : on('trap') ? 'present bit = 0 → the access traps instead of completing'
          : on('handler') ? 'the source depends on the mapping — a file, fresh zero-fill, or memory swapped to disk'
          : on('retry') ? 'entry now points at a frame → re-run the instruction, and it succeeds'
          : on('why') ? 'lazy loading, free-until-written allocations, and shared libraries all fall out of this'
          : (faulting ? 'page fault — trapping into the kernel to load the page' : present ? `hit: page ${sel} is resident in frame ${resident[sel]}` : 'click a page to access it')}
      </text>
    </svg>
  );
}
