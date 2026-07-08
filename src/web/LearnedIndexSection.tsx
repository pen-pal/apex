// Learned index, made visible. Pick a key distribution; a least-squares line is fit to (key → index) and drawn over the
// scatter with its error band. The band's height is the local-search window: thin on smooth data (a win over binary
// search), wide on skewed data (a loss). Model + tests in learnedindex.ts.
import { useMemo, useState } from 'react';
import { fitLinear, maxError, searchWindow, binarySearchCost } from './learnedindex';

const N = 32;
const PRESETS: Record<string, number[]> = {
  uniform: Array.from({ length: N }, (_, i) => i * 3),
  exponential: Array.from({ length: N }, (_, i) => Math.round(Math.pow(1.28, i))),
  clustered: Array.from({ length: N }, (_, i) => (i < N - 5 ? i : 120 + (i - (N - 5)) * 90)),
};
const W = 560, H = 240, PAD = 30;

export function LearnedIndexSection() {
  const [preset, setPreset] = useState('uniform');
  const keys = PRESETS[preset];
  const m = useMemo(() => fitLinear(keys), [keys]);
  const err = maxError(keys, m);
  const win = searchWindow(keys, m);
  const bcost = binarySearchCost(N);

  const kMin = keys[0], kMax = keys[N - 1];
  const x = (k: number) => PAD + ((k - kMin) / (kMax - kMin || 1)) * (W - 2 * PAD);
  const y = (idx: number) => PAD + (idx / (N - 1)) * (H - 2 * PAD);
  const lineAt = (k: number) => m.slope * k + m.intercept; // unclamped predicted index
  const band = [
    [x(kMin), y(lineAt(kMin) - err)], [x(kMax), y(lineAt(kMax) - err)],
    [x(kMax), y(lineAt(kMax) + err)], [x(kMin), y(lineAt(kMin) + err)],
  ].map((p) => p.join(',')).join(' ');
  const wins = win <= bcost;

  return (
    <div className="lix">
      <div className="lix-presets">
        <span className="lix-lbl">key distribution</span>
        {Object.keys(PRESETS).map((k) => <button key={k} type="button" className={preset === k ? 'on' : ''} onClick={() => setPreset(k)}>{k}</button>)}
      </div>

      <div className="lix-plot">
        <div className="lix-lbl">each dot is a key at its true position; the line is the model, the band is ±maxError</div>
        <svg viewBox={`0 0 ${W} ${H}`} className="lix-svg" role="img" aria-label="learned index regression">
          <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} className="lix-axis" />
          <line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} className="lix-axis" />
          <text x={W / 2} y={H - 6} className="lix-axl" textAnchor="middle">key value →</text>
          <text x={10} y={PAD - 10} className="lix-axl">index</text>
          <polygon points={band} className="lix-band" />
          <line x1={x(kMin)} y1={y(lineAt(kMin))} x2={x(kMax)} y2={y(lineAt(kMax))} className="lix-line" />
          {keys.map((k, i) => <circle key={i} cx={x(k)} cy={y(i)} r={3} className="lix-pt" />)}
        </svg>
      </div>

      <div className="lix-stats">
        <div className="lix-stat"><b>±{err}</b><span>max error</span></div>
        <div className={`lix-stat ${wins ? 'lix-hi' : ''}`}><b>{win}</b><span>slots to search</span></div>
        <div className="lix-stat"><b>{bcost}</b><span>binary-search probes</span></div>
      </div>

      <div className={`lix-verdict ${wins ? 'lix-good' : 'lix-bad'}`}>
        {wins
          ? <>The line fits the keys within <b>±{err}</b>, so a lookup predicts the position and scans just <b>{win}</b> slot{win === 1 ? '' : 's'} — versus <b>{bcost}</b> probes for binary search, in a fraction of a B-tree’s memory. On smooth data the model <em>is</em> the index.</>
          : <>The {preset} keys bend the CDF, so one line is off by up to <b>±{err}</b> and the local search must scan <b>{win}</b> of {N} slots — worse than binary search’s <b>{bcost}</b>. This is exactly why a single model fails, and real learned indexes stack a hierarchy of models (the RMI) or piecewise-linear segments so each piece stays accurate.</>}
      </div>

      <p className="lix-foot">
        A sorted index answers “where is key k?”, which is just evaluating the keys’ <strong>cumulative distribution</strong>
        at k and scaling by n. A B-tree approximates that CDF with a tree of comparisons; a <strong>learned index</strong>
        approximates it with a fitted function and corrects the small residual by a bounded local search. When the
        distribution is smooth it wins on both size and speed — the model is a few floats, not megabytes of tree — but the
        guarantee lives entirely in the <strong>error bound</strong>, so the recursive-model index (RMI) routes each key
        to a small expert model to keep every region tight. It doesn’t update as cheaply as a B-tree, which is the open
        problem for writes, but for read-mostly sorted data it reframes an index as a regression. (Kraska et al., 2018.)
      </p>
    </div>
  );
}
