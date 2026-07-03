// Guided story: the stride prefetcher — how a CPU hides cache-miss latency by predicting the next memory address. A
// Reference Prediction Table (RPT), indexed by the load instruction's PC, records {last address, stride, state}; when two
// consecutive access deltas match, the entry goes STEADY and the CPU prefetches addr+stride before the demand access, so
// the line is already in cache. Verified in node: on a strided array traversal coverage is ~99.9% (only the 3 warm-up
// accesses miss), while on random access and on pointer-chasing (a shuffled linked list) coverage is ~0% — which is why
// arrays are cache-friendly and linked structures are not. Sandboxed/CONCEPTUAL, real RPT mechanism.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const LINE = 64;
type Pattern = 'strided' | 'stride3' | 'random' | 'chase';
function gen(pat: Pattern): number[] {
  const n = 13; const out: number[] = [];
  if (pat === 'strided') for (let i = 0; i < n; i++) out.push(10 + i);        // lines 10,11,12…
  else if (pat === 'stride3') for (let i = 0; i < n; i++) out.push(6 + i * 3); // lines 6,9,12…
  else if (pat === 'random') { let s = 7; for (let i = 0; i < n; i++) { s = (Math.imul(s, 1103515245) + 12345) >>> 8; out.push(4 + (s % 34)); } }
  else { const p = Array.from({ length: n }, (_, i) => 6 + i * 2); let s = 3; for (let i = p.length - 1; i > 0; i--) { s = (Math.imul(s, 1103515245) + 12345) >>> 8; const j = s % (i + 1); [p[i], p[j]] = [p[j], p[i]]; } out.push(...p); }
  return out.map((l) => l * LINE);
}
type Acc = { line: number; delta: number | null; state: string; pf: number | null; covered: boolean; warm: boolean };
function simulate(addrs: number[]): { accs: Acc[]; coverage: number } {
  let last: number | null = null, stride = 0, state = 'init'; const prefetched = new Set<number>(); const accs: Acc[] = [];
  let misses = 0, covered = 0;
  for (const addr of addrs) {
    const line = Math.floor(addr / LINE); misses++; const cov = prefetched.has(line); if (cov) covered++;
    let delta: number | null = null; let pf: number | null = null;
    if (last !== null) { delta = addr - last; if (delta === stride && stride !== 0) state = 'steady'; else { state = 'transient'; stride = delta; } }
    if (state === 'steady') { pf = Math.floor((addr + stride) / LINE); prefetched.add(pf); }
    accs.push({ line, delta: delta === null ? null : delta / LINE, state, pf, covered: cov, warm: last === null || state !== 'steady' });
    last = addr;
  }
  return { accs, coverage: covered / misses };
}
const PATS: { id: Pattern; label: string }[] = [{ id: 'strided', label: 'array (stride 1)' }, { id: 'stride3', label: 'stride 3' }, { id: 'random', label: 'random' }, { id: 'chase', label: 'pointer-chase' }];

type Phase = 'wall' | 'stride' | 'rpt' | 'coverage' | 'fail' | 'run';
export function StridePrefetchSection() {
  const [pat, setPat] = useState<Pattern>('strided'); const [step, setStep] = useState(99);
  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string, p: Pattern): StoryScene =>
    ({ key, title, caption, render: () => <Pref phase={key} pat={p} step={99} /> });

  const scenes: StoryScene[] = [
    scene('wall', 'The memory wall', 'A cache miss stalls the CPU for hundreds of cycles waiting on DRAM. But most programs don’t touch memory randomly — they march through it. If the hardware can guess the next address and fetch it early, the data is already in cache when the load runs. That guess is prefetching.', 'strided'),
    scene('stride', 'Lock onto the stride', 'The dominant pattern is a constant stride: walking an array touches base, base+8, base+16 — a fixed delta every time. The prefetcher watches one load instruction’s addresses; the moment two consecutive deltas match, it has the stride and can extrapolate. Here every access is one cache line past the last.', 'strided'),
    scene('rpt', 'The reference prediction table', 'Each load PC gets an entry: {last address, stride, state}. On every access it computes delta = addr − last. If delta equals the stored stride, the entry goes STEADY and the CPU issues a prefetch for addr + stride — one line ahead of where the program has reached. Two matching deltas is all it takes.', 'strided'),
    scene('coverage', 'Coverage: nearly every miss hidden', 'Once steady, the prefetched line arrives before the demand access, turning what would be a miss into a hit. Only three warm-up accesses miss — two to lock the stride, one before the first prefetch lands — and that fixed cost is amortized away over a long array: 77% here across 13 accesses, but 99.9% over a real traversal of thousands (verified in node). The green cells were fetched before the program asked.', 'strided'),
    scene('fail', 'When there is no stride', 'A prefetcher can only extrapolate a pattern it has seen. Random access has no consistent delta, so the RPT never reaches steady — 0% coverage. Pointer-chasing a shuffled linked list is worse: each next address comes out of the data itself, unknowable in advance — also 0%. This is the concrete reason arrays beat linked lists in cache. (Verified.)', 'random'),
    { key: 'run', title: 'Try each access pattern', caption: 'Pick a pattern and watch the reference prediction table. A constant stride (even stride 3) locks in after two accesses and the prefetcher covers the rest; random access and pointer-chasing never establish a stride, so coverage stays near zero. The green cells are demand accesses the prefetcher had already fetched.', render: () => <Pref phase="run" pat={pat} step={step} onStep={setStep} onPat={setPat} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>A cache miss stalls the CPU for hundreds of cycles, so hardware tries to <strong>prefetch</strong> the next line before it’s asked for. A <strong>stride prefetcher</strong> keeps a <strong>reference prediction table</strong> indexed by each load’s PC, holding {'{'}last address, stride, state{'}'}; when two consecutive address deltas match, it locks onto the <strong>stride</strong> and fetches addr+stride ahead of the program. It hides nearly every miss on a strided array walk but does nothing for random access or pointer-chasing — which is exactly why arrays are cache-friendly and linked lists are not.</>,
        takeaway: <>The gap between CPU and DRAM speed — the <strong>memory wall</strong> — means a last-level cache miss costs hundreds of cycles. Hardware <strong>prefetchers</strong> hide that by fetching lines before the demand access. The workhorse is the <strong>stride prefetcher</strong>: it maintains a <strong>reference prediction table (RPT)</strong> indexed by the load instruction’s <strong>PC</strong>, each entry holding the last address that instruction touched, a candidate <strong>stride</strong>, and a small state machine (init → transient → steady). On each access it computes delta = addr − last; if delta matches the stored stride it advances toward <strong>steady</strong> and issues a prefetch for <strong>addr + stride</strong> (often addr + distance·stride to stay ahead of the pipeline). Two matching deltas are enough to lock on, so an array traversal — base, base+8, base+16 — is predicted almost perfectly: <strong>coverage</strong> (the fraction of misses eliminated) approaches 99.9% over a long array, with only the three warm-up accesses missing (verified here at 2000 accesses). The flip side is its limitation: <strong>random</strong> access produces no consistent delta so the RPT never reaches steady (≈0% coverage), and <strong>pointer-chasing</strong> a linked list or tree is fundamentally unpredictable because each next address is loaded from the current node’s data — the prefetcher can’t know it (≈0% coverage, verified). This is the concrete, quantified reason that contiguous arrays are cache-friendly and pointer-linked structures are cache-hostile, and why data-oriented design favors flat arrays and structure-of-arrays layouts. Real CPUs layer several prefetchers (next-line, stride/RPT, and stream/GHB-based) and must balance coverage against <strong>accuracy</strong> — a prefetch that’s never used wastes bandwidth and can evict useful lines, so aggressive prefetching is throttled when accuracy drops.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="sp-ctl">
          {PATS.map((p) => <button key={p.id} type="button" className={`sp-btn ${pat === p.id ? 'on' : ''}`} onClick={() => setPat(p.id)}>{p.label}</button>)}
        </div>
      )}
    />
  );
}

function Pref({ phase, pat, step, onStep, onPat }: { phase: Phase; pat: Pattern; step: number; onStep?: (n: number) => void; onPat?: (p: Pattern) => void }) {
  const on = (p: Phase) => phase === p; void onStep; void onPat;
  const addrs = gen(pat); const { accs, coverage } = simulate(addrs);
  const shown = Math.min(step, accs.length);
  const last = accs[shown - 1];
  const CW = 50, X0 = 70, Y = 120;
  return (
    <svg viewBox="0 0 760 300" className="story-svg">
      <text x="56" y="22" className="sp-col">stride prefetcher · pattern “{pat}” · RPT[PC] locks onto a constant delta · coverage {(coverage * 100).toFixed(0)}%</text>

      {/* RPT entry box */}
      <rect x={70} y={40} width={360} height={40} rx="5" className="sp-rpt" />
      <text x={80} y={58} className="sp-rl">RPT[load PC]:</text>
      <text x={80} y={73} className="sp-rv">last {last ? '#' + last.line : '—'} · stride {last && last.delta !== null ? (last.delta >= 0 ? '+' : '') + last.delta : '?'} · state {last ? last.state : 'init'}</text>
      <text x={452} y={66} className={`sp-state ${last?.state === 'steady' ? 'steady' : ''}`}>{last?.state === 'steady' ? '▶ prefetching' : 'learning…'}</text>

      {/* access timeline: cache lines accessed in order */}
      <text x={40} y={Y + 4} className="sp-axis" textAnchor="end">line</text>
      {accs.slice(0, shown).map((a, i) => <g key={i}>
        <rect x={X0 + i * CW} y={Y - 16} width={CW - 8} height={30} rx="4" className={`sp-acc ${a.covered ? 'cov' : a.warm ? 'warm' : 'miss'}`} />
        <text x={X0 + i * CW + (CW - 8) / 2} y={Y + 4} className="sp-al" textAnchor="middle">#{a.line}</text>
        {a.delta !== null && <text x={X0 + i * CW - 4} y={Y - 22} className="sp-delta" textAnchor="middle">{a.delta >= 0 ? '+' : ''}{a.delta}</text>}
        {/* prefetch-ahead arrow to the predicted line's future slot */}
        {a.pf !== null && a.state === 'steady' && i + 1 < shown && <line x1={X0 + i * CW + (CW - 8) / 2} y1={Y - 20} x2={X0 + (i + 1) * CW + (CW - 8) / 2} y2={Y - 20} className="sp-pf" markerEnd="url(#sp-arr)" />}
      </g>)}
      <defs><marker id="sp-arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="hsl(150 60% 55%)" /></marker></defs>

      {/* coverage bar */}
      <text x={70} y={Y + 70} className="sp-axis">coverage (misses hidden by prefetch)</text>
      <rect x={70} y={Y + 78} width={400} height={20} className="sp-covbg" />
      <rect x={70} y={Y + 78} width={400 * coverage} height={20} className="sp-covfill" />
      <text x={478} y={Y + 93} className="sp-covt">{(coverage * 100).toFixed(1)}%</text>

      <text x="380" y="292" className="sp-foot" textAnchor="middle">
        {on('wall') ? 'a cache miss ≈ hundreds of cycles → predict & fetch the next line early'
          : on('stride') ? 'two matching deltas = a stride the prefetcher can extrapolate'
          : on('rpt') ? 'delta == stored stride → STEADY → prefetch addr + stride'
          : on('coverage') ? 'green = prefetched before the demand access; ~99.9% on an array'
          : on('fail') ? 'no constant delta → never steady → 0% (random & pointer-chasing)'
          : `${pat}: coverage ${(coverage * 100).toFixed(0)}% — ${last?.state === 'steady' ? 'stride locked in → prefetching ahead' : 'no constant stride to lock onto'}`}
      </text>
    </svg>
  );
}
