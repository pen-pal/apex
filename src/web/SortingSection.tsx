// Sorting algorithms, made visible. Pick an algorithm and step (or play) through it on a
// bar chart — the bars being compared light up, the settled ones go green — with live
// comparison/swap counts and a table comparing all five on the same array. Real instrumented
// sorts in sorting.ts (tested for correctness and hand-counted operation totals).
import { useEffect, useMemo, useState } from 'react';
import { ALGOS, type AlgoName } from './sorting';

const NAMES: { id: AlgoName; label: string; big: string }[] = [
  { id: 'bubble', label: 'Bubble', big: 'O(n²)' },
  { id: 'insertion', label: 'Insertion', big: 'O(n²)' },
  { id: 'selection', label: 'Selection', big: 'O(n²)' },
  { id: 'merge', label: 'Merge', big: 'O(n log n)' },
  { id: 'quick', label: 'Quick', big: 'O(n log n)' },
];
const INITIAL = [7, 3, 9, 2, 8, 5, 1, 6, 4, 10, 12, 11];

export function SortingSection() {
  const [data, setData] = useState<number[]>(INITIAL);
  const [algo, setAlgo] = useState<AlgoName>('quick');
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);

  const trace = useMemo(() => ALGOS[algo](data), [algo, data]);
  const frames = trace.frames;
  const s = Math.min(step, frames.length);
  const frame = s > 0 ? frames[s - 1] : { array: data, active: [], sorted: [] };
  const max = Math.max(...data);

  useEffect(() => { setStep(0); setPlaying(false); }, [algo, data]);
  useEffect(() => {
    if (!playing) return;
    if (s >= frames.length) { setPlaying(false); return; }
    const id = setTimeout(() => setStep((x) => x + 1), 60);
    return () => clearTimeout(id);
  }, [playing, s, frames.length]);

  const shuffle = () => { const a = [...INITIAL]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } setData(a); };
  const activeSet = new Set(frame.active), sortedSet = new Set(frame.sorted);

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Sorting — watch the algorithms work</h2></div>
        <p className="jsec-sub">
          The same array, five ways. The quadratic sorts (bubble, insertion, selection) compare adjacent or scanning pairs and creep
          toward order; the O(n log n) sorts (merge, quick) divide the problem in half and conquer. Pick one and step through it — the
          compared bars light up, the settled ones turn green — then compare the operation counts below.
        </p>

        <div className="sort-algos">
          {NAMES.map((n) => <button key={n.id} className={algo === n.id ? 'on' : ''} onClick={() => setAlgo(n.id)}>{n.label} <i>{n.big}</i></button>)}
        </div>

        <div className="sort-bars">
          {frame.array.map((v, i) => (
            <div key={i} className={`sort-bar ${activeSet.has(i) ? 'active' : ''} ${sortedSet.has(i) ? 'sorted' : ''}`} style={{ height: `${(v / max) * 100}%` }} />
          ))}
        </div>

        <div className="sort-controls">
          <button onClick={() => { setPlaying(false); setStep(0); }} disabled={s === 0}>⏮</button>
          <button onClick={() => { setPlaying(false); setStep(Math.max(0, s - 1)); }} disabled={s === 0}>◀</button>
          <button onClick={() => setPlaying((p) => !p)} className="sort-play">{playing ? '⏸ pause' : '▶ play'}</button>
          <button onClick={() => { setPlaying(false); setStep(Math.min(frames.length, s + 1)); }} disabled={s >= frames.length}>▶|</button>
          <button onClick={() => { setPlaying(false); setStep(frames.length); }} disabled={s >= frames.length}>⏭</button>
          <span className="sort-prog">frame {s} / {frames.length}</span>
          <button onClick={shuffle} className="sort-shuffle">🔀 shuffle</button>
        </div>

        <div className="sort-table">
          <div className="sort-trow head"><span>algorithm</span><span>comparisons</span><span>swaps/writes</span><span>complexity</span></div>
          {NAMES.map((n) => {
            const t = ALGOS[n.id](data);
            return (
              <div key={n.id} className={`sort-trow ${algo === n.id ? 'on' : ''}`}>
                <span>{n.label}</span><span>{t.comparisons}</span><span>{t.swaps}</span><span className="sort-big">{n.big}</span>
              </div>
            );
          })}
        </div>

        <p className="sort-foot">
          Counts tell the story: on a shuffled array the quadratic sorts do ~n²/2 ≈ 70+ comparisons here while merge/quick do a few
          dozen — and the gap explodes as n grows. But complexity isn’t everything: insertion sort is faster than quicksort on tiny or
          nearly-sorted arrays (real libraries switch to it below ~16 elements), merge sort is <em>stable</em> and worst-case O(n log n)
          but needs O(n) extra space, and quicksort is usually fastest in practice yet degrades to O(n²) on bad pivots (mitigated by
          randomized or median-of-three pivots). Heapsort (see the binary-heap section) gives O(n log n) in place.
        </p>
      </section>
    </div>
  );
}
