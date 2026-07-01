// Dutch National Flag, made visible. The array is red/white/blue cells (0/1/2). Step the algorithm and watch
// the three pointers carve four regions — settled 0s, settled 1s, the shrinking unknown zone mid scans, and
// settled 2s — until the unknown zone vanishes and the flag is sorted in one pass. Real model from dnf.ts.
import { useEffect, useMemo, useState } from 'react';
import { sort, type Step } from './dnf';

const COLORS = ['#cf4b4b', '#d8dae0', '#3b7dd8']; // 0 red, 1 white, 2 blue
const LABELS = ['0', '1', '2'];
const INIT = [2, 0, 2, 1, 1, 0, 2, 1, 0, 2, 1, 0];

export function DnfSection() {
  const [input, setInput] = useState<number[]>(INIT);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);

  const { steps } = useMemo(() => sort(input), [input]);
  // frame 0 = initial array with pointers at start; frames 1..steps.length = after each action
  const total = steps.length;
  const cur: Step = step === 0
    ? { arr: input, low: 0, mid: 0, high: input.length - 1, action: 'skip' }
    : steps[step - 1];
  const done = step >= total;

  useEffect(() => { setStep(0); setPlaying(false); }, [input]);
  useEffect(() => {
    if (!playing || done) { if (done) setPlaying(false); return; }
    const id = setTimeout(() => setStep((s) => Math.min(total, s + 1)), 550);
    return () => clearTimeout(id);
  }, [playing, step, done, total]);

  const randomize = () => { let s = (input.reduce((a, b) => a + b, 0) * 131 + 9) & 0x7fffffff; const rnd = () => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s % 3; }; setInput(Array.from({ length: 12 }, rnd)); };

  const region = (i: number) => (i < cur.low ? '0s' : i < cur.mid ? '1s' : i <= cur.high ? '?' : '2s');

  return (
    <div className="dnf">
      <p className="dnf-intro">
        Sort an array of just three values in a single pass, in place. Three pointers split it into four zones:
        the settled <span className="dnf-k red">0s</span> before <code>low</code>, the settled
        <span className="dnf-k white">1s</span> up to <code>mid</code>, the <strong>unknown</strong> zone
        <code> mid</code>…<code>high</code>, and the settled <span className="dnf-k blue">2s</span> after
        <code> high</code>. Look at <code>mid</code>: a 0 swaps down, a 2 swaps up, a 1 stays. Step it:
      </p>

      <div className="dnf-arr">
        {cur.arr.map((v, i) => {
          const reg = region(i);
          return (
            <div key={i} className={`dnf-cell reg-${reg === '?' ? 'unk' : reg}`}>
              <div className="dnf-box" style={{ background: COLORS[v], color: v === 1 ? '#222' : '#fff' }}>{LABELS[v]}</div>
              <div className="dnf-ptrs">
                {!done && i === cur.low && <span className="dnf-ptr low">low</span>}
                {!done && i === cur.mid && <span className="dnf-ptr mid">mid</span>}
                {!done && i === cur.high && <span className="dnf-ptr high">high</span>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="dnf-controls">
        <button type="button" className="dnf-btn ghost" onClick={() => { setStep(0); setPlaying(false); }}>⏮</button>
        <button type="button" className="dnf-btn" disabled={step === 0} onClick={() => { setPlaying(false); setStep((s) => Math.max(0, s - 1)); }}>← prev</button>
        <button type="button" className="dnf-btn" disabled={done} onClick={() => { setPlaying(false); setStep((s) => Math.min(total, s + 1)); }}>next →</button>
        <button type="button" className="dnf-btn" onClick={() => { if (done) setStep(0); setPlaying((p) => !p); }}>{playing ? '⏸' : '▶'}</button>
        <button type="button" className="dnf-btn ghost" onClick={randomize}>🎲</button>
        <span className="dnf-prog">{step}/{total}</span>
        {!done && step > 0 && <span className={`dnf-action ${cur.action}`}>{cur.action === 'swap-low' ? 'saw 0 → swap into 0s (low++, mid++)' : cur.action === 'swap-high' ? 'saw 2 → swap into 2s (high−−, mid stays)' : 'saw 1 → leave it (mid++)'}</span>}
        {done && <span className="dnf-done">✓ sorted in {total} steps — one pass</span>}
      </div>

      <p className="dnf-foot">
        Why not just count the 0s, 1s, and 2s and rewrite the array? You can — counting sort is also O(n) — but
        the flag algorithm does it <strong>in place</strong> with a single scan and no second array, and, more
        importantly, it generalizes. Replace “is it 0/1/2?” with “is it &lt;, =, or &gt; a pivot?” and you have
        the partition step of <strong>3-way quicksort</strong>. Ordinary 2-way quicksort splits into (&le;pivot)
        and (&gt;pivot); on an array with many equal keys — say millions of rows with a boolean or low-cardinality
        column — those duplicates pile onto one side and quicksort degrades toward O(n²). Partitioning the equal
        keys into their own middle band means they’re done after this one step and never recursed into, which is
        why 3-way quicksort (Bentley–McIlroy, and the basis of many standard-library sorts) stays fast on
        duplicate-heavy data. The subtle line is the 2-case: after swapping a 2 up to the <code>high</code> end
        you must <em>not</em> advance <code>mid</code>, because the value you just pulled in from the top hasn’t
        been examined yet — advancing it is the classic off-by-one bug. (Dijkstra, 1976.)
      </p>
    </div>
  );
}
