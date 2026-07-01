// Kadane's algorithm, made visible. The numbers are bars (positive up, negative down). Step left to right and
// watch the running total "best sum ending here" grow — and RESET to a fresh start whenever the prior prefix
// went negative (a negative prefix never helps). The best window seen so far stays highlighted; by the last
// step it's the maximum-sum subarray. Real model from kadane.ts.
import { useMemo, useState } from 'react';
import { kadane } from './kadane';

const PRESETS: Record<string, number[]> = {
  classic: [-2, 1, -3, 4, -1, 2, 1, -5, 4],
  dip: [5, -8, 6, 7, -2, 3, -10, 4],
  'all negative': [-4, -2, -7, -1, -5],
};

export function KadaneSection() {
  const [arr, setArr] = useState<number[]>(PRESETS.classic);
  const [step, setStep] = useState(PRESETS.classic.length - 1);

  const r = useMemo(() => kadane(arr), [arr]);
  const cur = r.steps[step];
  const done = step >= arr.length - 1;
  const maxAbs = Math.max(1, ...arr.map((v) => Math.abs(v)));

  const setPreset = (a: number[]) => { setArr(a); setStep(a.length - 1); };
  const randomize = () => { let s = (arr.reduce((a, b) => a + b, 0) * 131 + 7) & 0x7fffffff; const rnd = (n: number) => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s % n; }; const a = Array.from({ length: 8 + rnd(4) }, () => rnd(19) - 9); setPreset(a); };

  return (
    <div className="kad">
      <p className="kad-intro">
        Find the contiguous run of numbers with the largest sum. Kadane's trick: sweep once, keeping the best
        sum of a subarray <strong>ending at the current position</strong>. Extend it if the running total is
        still worth carrying; the moment starting fresh is better, <strong>drop the prefix</strong> — a negative
        prefix can never help. Step through:
      </p>

      <div className="kad-presets">
        {Object.entries(PRESETS).map(([name, a]) => <button key={name} type="button" className={`kad-preset ${arr === a ? 'on' : ''}`} onClick={() => setPreset(a)}>{name}</button>)}
        <button type="button" className="kad-preset" onClick={randomize}>🎲 random</button>
      </div>

      <div className="kad-chart">
        {arr.map((v, i) => {
          const inBest = done && i >= r.start && i <= r.end;
          const inCur = i >= cur.curStart && i <= step;
          const isHead = i === step;
          const isReset = i === step && cur.reset;
          return (
            <div key={i} className={`kad-col ${inBest ? 'best' : ''} ${inCur ? 'cur' : ''} ${isHead ? 'head' : ''}`}>
              <div className="kad-barwrap">
                {v >= 0
                  ? <div className={`kad-bar pos ${v >= 0 ? '' : ''}`} style={{ height: `${(v / maxAbs) * 46}%` }} />
                  : <div className="kad-bar neg" style={{ height: `${(Math.abs(v) / maxAbs) * 46}%`, marginTop: 'auto' }} />}
              </div>
              <span className="kad-val">{v > 0 ? '+' : ''}{v}</span>
              {isReset && <span className="kad-reset">↺ reset</span>}
            </div>
          );
        })}
      </div>

      <div className="kad-controls">
        <button type="button" className="kad-btn ghost" onClick={() => setStep(0)}>⏮</button>
        <button type="button" className="kad-btn" disabled={step <= 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>← prev</button>
        <button type="button" className="kad-btn" disabled={done} onClick={() => setStep((s) => Math.min(arr.length - 1, s + 1))}>next →</button>
        <button type="button" className="kad-btn ghost" onClick={() => setStep(arr.length - 1)}>⏭ all</button>
        <span className="kad-prog">{step + 1}/{arr.length}</span>
      </div>

      <div className="kad-stats">
        <div className="kad-stat"><span>best ending here (cur)</span><b className={cur.cur < 0 ? 'neg' : ''}>{cur.cur}</b></div>
        <div className="kad-stat ok"><span>best so far</span><b>{cur.best}</b></div>
        <div className="kad-stat"><span>current run</span><b>[{cur.curStart}..{step}]</b></div>
        {done && <div className="kad-stat win"><span>max subarray</span><b>[{r.start}..{r.end}] = {r.maxSum}</b></div>}
      </div>

      <p className="kad-foot">
        The reason one pass suffices is the DP recurrence: <code>best_ending_at[i] = max(a[i],
        best_ending_at[i−1] + a[i])</code>. Because that only depends on the previous value, you keep a single
        number instead of a table — O(n) time, O(1) space — and the global answer is the max over all positions.
        The "drop a negative prefix" rule is the same reason you can't do better by looking back: any subarray
        that would benefit from an earlier element already had its chance while the running total was positive.
        Kadane generalizes: run it on every pair of rows' column-sums and you get the maximum-sum SUBMATRIX in
        O(n³); frame the array as price differences and it becomes the classic "best time to buy and sell a
        stock once." The one subtlety is the empty subarray — if a problem allows picking nothing (sum 0), the
        answer is max(0, kadane); here we require at least one element, so an all-negative array returns its
        largest single value. (Bentley, "Programming Pearls.")
      </p>
    </div>
  );
}
