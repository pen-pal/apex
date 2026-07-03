// Guided story: Timsort — the adaptive, stable hybrid sort that's the default in Python, Java, Rust, and Swift. Real data
// isn't random: it has already-sorted stretches. Timsort finds natural RUNS (maximal ascending or descending, descending
// reversed), extends short ones to a minimum length with binary insertion sort, then merges runs in a balanced stack
// order, switching to GALLOPING (binary-search + bulk copy) when one run keeps winning. On sorted input the whole array
// is one run → O(n); on random input it's O(n log n); and it's stable. Verified in node: output matches a reference sort,
// it's stable (equal keys keep order), and it makes far fewer comparisons on runs (28 on sorted vs 118 on random, n=28).
// Sandboxed/CONCEPTUAL.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const MINRUN = 4;
type Item = { k: number; i: number };
function build(pattern: string): Item[] {
  let s = 7; const r = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return (s >>> 8) / (1 << 24); };
  const n = 28; const a: number[] = [];
  if (pattern === 'sorted') for (let i = 0; i < n; i++) a.push(i + 1);
  else if (pattern === 'reverse') for (let i = 0; i < n; i++) a.push(n - i);
  else if (pattern === 'partial') { for (let i = 0; i < n; i++) a.push(i + 1); for (let k = 0; k < 4; k++) { const x = Math.floor(r() * n), y = Math.floor(r() * n); [a[x], a[y]] = [a[y], a[x]]; } }
  else if (pattern === 'fewunique') for (let i = 0; i < n; i++) a.push(1 + Math.floor(r() * 4));
  else for (let i = 0; i < n; i++) a.push(1 + Math.floor(r() * n));
  return a.map((k, i) => ({ k, i }));
}
// detect natural runs (ascending, or descending→reversed), then extend short runs to MINRUN
function runsOf(arr: Item[]): { runs: number[]; cmps: number } {
  const a = arr.map((x) => ({ ...x })); const n = a.length; const runs: number[] = []; let cmps = 0; const cmp = (x: Item, y: Item) => { cmps++; return x.k - y.k; };
  let lo = 0;
  while (lo < n) { let i = lo + 1; if (i < n) { if (cmp(a[i], a[lo]) < 0) { while (i < n && cmp(a[i], a[i - 1]) < 0) i++; } else { while (i < n && cmp(a[i], a[i - 1]) >= 0) i++; } }
    let rl = i - lo; if (rl < MINRUN) rl = Math.min(MINRUN, n - lo); runs.push(rl); lo += rl; }
  return { runs, cmps };
}
function sortWithCount(arr: Item[]): { out: Item[]; cmps: number } {
  const a = arr.map((x) => ({ ...x })); const n = a.length; let cmps = 0; const cmp = (x: Item, y: Item) => { cmps++; return x.k - y.k; };
  const binIns = (lo: number, hi: number, start: number) => { for (let i = Math.max(start, lo + 1); i < hi; i++) { const it = a[i]; let l = lo, r = i; while (l < r) { const m = (l + r) >> 1; if (cmp(it, a[m]) < 0) r = m; else l = m + 1; } for (let j = i; j > l; j--) a[j] = a[j - 1]; a[l] = it; } };
  const countRun = (lo: number, hi: number) => { let i = lo + 1; if (i >= hi) return 1; if (cmp(a[i], a[lo]) < 0) { while (i < hi && cmp(a[i], a[i - 1]) < 0) i++; for (let l = lo, r = i - 1; l < r; l++, r--) { const t = a[l]; a[l] = a[r]; a[r] = t; } } else { while (i < hi && cmp(a[i], a[i - 1]) >= 0) i++; } return i - lo; };
  const merge = (lo: number, mid: number, hi: number) => { const L = a.slice(lo, mid); let i = 0, j = mid, k = lo; while (i < L.length && j < hi) { if (cmp(L[i], a[j]) <= 0) a[k++] = L[i++]; else a[k++] = a[j++]; } while (i < L.length) a[k++] = L[i++]; };
  const stack: [number, number][] = []; let lo = 0;
  while (lo < n) { let rl = countRun(lo, n); if (rl < MINRUN) { const f = Math.min(MINRUN, n - lo); binIns(lo, lo + f, lo + rl); rl = f; } stack.push([lo, rl]); lo += rl;
    while (stack.length > 1) { const [x, xl] = stack[stack.length - 1], [y, yl] = stack[stack.length - 2]; if (yl <= xl) { merge(y, y + yl, x + xl); stack.splice(stack.length - 2, 2, [y, yl + xl]); } else break; } }
  while (stack.length > 1) { const [x, xl] = stack.pop()!; const [y, yl] = stack.pop()!; merge(y, y + yl, x + xl); stack.push([y, yl + xl]); }
  return { out: a, cmps };
}

const PATTERNS = [{ id: 'random', label: 'random' }, { id: 'sorted', label: 'sorted' }, { id: 'reverse', label: 'reversed' }, { id: 'partial', label: 'nearly sorted' }, { id: 'fewunique', label: 'few unique' }];
const RUNHUE = [205, 150, 45, 320, 20, 265, 175, 95];

type Phase = 'runs' | 'normalize' | 'merge' | 'gallop' | 'adaptive' | 'run';
export function TimsortSection() {
  const [pat, setPat] = useState('random'); const [sorted, setSorted] = useState(false);
  const arr = build(pat); const { runs, cmps } = runsOf(arr); const res = sortWithCount(arr);
  const rndCmps = sortWithCount(build('random')).cmps;

  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string, p: string): StoryScene =>
    ({ key, title, caption, render: () => <Tim phase={key} pat={p} sorted={key === 'adaptive'} /> });

  const scenes: StoryScene[] = [
    scene('runs', 'Real data has runs', 'Real-world data is rarely random — it has stretches that are already in order, ascending or descending. Timsort (Tim Peters, 2002; the default sort in Python, Java, Rust, Swift) exploits them. Before sorting, it scans for natural RUNS instead of blindly halving the array like classic mergesort.', 'partial'),
    scene('normalize', 'Find and extend runs', 'Walk the array marking each maximal ascending run (a descending one is found and reversed in place, keeping it stable). Runs shorter than a minimum length (minrun, ~32 in practice) are extended by binary insertion sort. Now the whole array is a sequence of sorted runs, each at least minrun long.', 'random'),
    scene('merge', 'Merge in balanced order', 'Push the runs on a stack and merge adjacent ones — but only in a balanced order enforced by invariants on the run lengths, so merges stay roughly equal-sized and the worst cases of naive mergesort never happen. Each merge fuses two sorted runs into one larger sorted run.', 'random'),
    scene('gallop', 'Galloping for lopsided merges', 'While merging two runs, if one keeps winning — its elements are consistently smaller — timsort switches to GALLOPING: it binary-searches how far ahead the other run’s next element lies and copies that whole block in one move, instead of comparing element by element. Bulk-copying long lopsided stretches is the speedup.', 'random'),
    scene('adaptive', 'Adaptive and stable', 'On already-sorted input the entire array is a single run — O(n), no merging at all. On random input it falls back to a clean O(n log n). And it is stable: equal elements keep their original order. That adaptivity to real, partly-ordered data is why it became the standard library sort. (Verified: correct, stable, far fewer comparisons on runs.)', 'sorted'),
    { key: 'run', title: 'Feed it different data', caption: 'Pick an input shape and see the natural runs light up in colour — sorted data is one big run, random data is many short ones. The comparison count shows the benefit of adaptivity: nearly-sorted and sorted inputs take far fewer comparisons than random. Hit sort to merge the runs into the final order.', render: () => <Tim phase="run" pat={pat} sorted={sorted} onPat={(p) => { setPat(p); setSorted(false); }} onSort={() => setSorted((v) => !v)} cmps={cmps} total={res.cmps} rnd={rndCmps} nRuns={runs.length} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <><strong>Timsort</strong> is an adaptive, stable sort that beats plain mergesort on real data by exploiting order that’s already there. It finds natural <strong>runs</strong> (already-sorted stretches), extends short ones with insertion sort, and merges runs in a balanced stack order, switching to <strong>galloping</strong> (binary-search + bulk copy) when one run dominates. Sorted input is a single run → O(n); random input → O(n log n); equal elements keep their order (stable). It’s the default sort in Python, Java, Rust, and Swift.</>,
        takeaway: <><strong>Timsort</strong> (Tim Peters, 2002, for CPython) is the standard-library sort of Python, Java (for objects), Rust (stable sort), Swift, and Android. It’s a <strong>stable, adaptive, natural mergesort</strong>. Phase one, <strong>run detection</strong>: scan left to right for the longest <em>run</em> — a maximal weakly-ascending or strictly-descending subsequence; descending runs are reversed in place (strict descent keeps the reversal stable). A run shorter than <strong>minrun</strong> (computed so n/minrun is near a power of two, typically 32–64) is grown to minrun with <strong>binary insertion sort</strong>, which is cheap on the small, nearly-sorted pieces runs produce. Phase two, <strong>merging</strong>: runs are pushed on a stack, and after each push the top runs are merged until two invariants hold — for lengths X (top), Y, Z: <strong>Z &gt; Y + X</strong> and <strong>Y &gt; X</strong>. These keep the pending runs balanced (near-Fibonacci sizes), bounding the stack to O(log n) and keeping every merge roughly equal-sized, which avoids the pathological unbalanced merges of a naive natural mergesort. Merging uses temporary space for the smaller run and, crucially, <strong>galloping mode</strong>: when one run wins <em>min-gallop</em> consecutive comparisons, it stops one-at-a-time merging and binary-searches for the position of the other run’s next element, copying that entire block at once — turning a lopsided merge from O(n) comparisons into O(log n). The result: <strong>O(n)</strong> on already-sorted or reverse-sorted data (a huge win — verified here, ~4× fewer comparisons than on random at n=28), <strong>O(n log n)</strong> worst case, <strong>stable</strong> order preserved, and excellent real-world constants because genuine data (log timestamps, appended records, partially-updated lists) is full of runs. A subtle history note: the original invariant check had a bug that could break the stack bound on adversarial inputs, found in 2015 via formal verification and fixed by tightening the merge condition — a nice case of a proof assistant catching a real bug in a deployed library.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="tim-ctl">
          {PATTERNS.map((p) => <button key={p.id} type="button" className={`tim-btn ${pat === p.id ? 'on' : ''}`} onClick={() => { setPat(p.id); setSorted(false); }}>{p.label}</button>)}
          <button type="button" className="tim-btn go" onClick={() => setSorted((v) => !v)}>{sorted ? 'show runs' : 'sort ›'}</button>
          <span className="tim-read">{runs.length} run{runs.length === 1 ? '' : 's'} · {res.cmps} comparisons {pat !== 'random' ? `(random: ${rndCmps})` : ''}</span>
        </div>
      )}
    />
  );
}

function Tim({ phase, pat, sorted, onPat, onSort, cmps, total, rnd, nRuns }: { phase: Phase; pat: string; sorted: boolean; onPat?: (p: string) => void; onSort?: () => void; cmps?: number; total?: number; rnd?: number; nRuns?: number }) {
  const on = (p: Phase) => phase === p; void onPat; void onSort; void cmps; void total; void nRuns;
  const arr = build(pat); const { runs } = runsOf(arr); const res = sortWithCount(arr);
  const shown = sorted ? res.out : arr;
  // map each index to its run color (from the natural-run partition of the INPUT)
  const runOf: number[] = []; { let ri = 0, left = runs[0] || arr.length; for (let i = 0; i < arr.length; i++) { if (left === 0) { ri++; left = runs[ri] || 1; } runOf.push(ri); left--; } }
  const maxK = Math.max(...arr.map((x) => x.k), 1);
  const OX = 60, BW = Math.min(22, 620 / arr.length), BASE = 200, HMAX = 150;
  return (
    <svg viewBox="0 0 760 240" className="story-svg">
      <text x="56" y="20" className="tim-col">Timsort · “{pat}” input · {runs.length} natural run{runs.length === 1 ? '' : 's'} · {res.cmps} comparisons{sorted ? ' · sorted ✓' : ''}</text>

      {shown.map((it, i) => { const h = it.k / maxK * HMAX; const run = sorted ? 0 : runOf[i];
        return <rect key={i} x={OX + i * BW} y={BASE - h} width={BW - 2} height={h} rx="1.5"
          style={{ fill: sorted ? 'hsl(150 45% 48%)' : `hsl(${RUNHUE[run % RUNHUE.length]} 62% 55%)` }} className="tim-bar" />; })}

      {/* run separators on the input */}
      {!sorted && (() => { const seps: number[] = []; let acc = 0; for (let k = 0; k < runs.length - 1; k++) { acc += runs[k]; seps.push(acc); } return seps.map((s, k) => <line key={k} x1={OX + s * BW - 1} y1={BASE - HMAX - 4} x2={OX + s * BW - 1} y2={BASE + 4} className="tim-sep" />); })()}

      <text x={OX} y={BASE + 22} className="tim-lbl">{sorted ? 'sorted (stable — equal keys kept their order)' : `${runs.length} runs, coloured — each already in order`}</text>

      <text x="380" y="234" className="tim-foot" textAnchor="middle">
        {on('runs') ? 'scan for already-sorted runs instead of blindly halving'
          : on('normalize') ? 'reverse descending runs; extend short ones to minrun'
          : on('merge') ? 'merge adjacent runs in a balanced stack order'
          : on('gallop') ? 'one run dominating → binary-search + bulk-copy (gallop)'
          : on('adaptive') ? 'sorted → 1 run → O(n); stable; the standard library sort'
          : `${pat}: ${runs.length} run${runs.length === 1 ? '' : 's'}, ${res.cmps} comparisons${pat !== 'random' ? ` vs random ~${rnd}` : ''}`}
      </text>
    </svg>
  );
}
