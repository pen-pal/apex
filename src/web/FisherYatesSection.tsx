// The shuffle bias, made visible. Two heatmaps of position × value: how often each value lands at each
// position, over many runs. For the correct Fisher–Yates shuffle every cell converges to 1/n (flat, neutral).
// For the naive "swap i with any index" shuffle, a structured pattern emerges — some cells consistently above
// 1/n (red), some below (blue) — the bias you can't see in a single shuffle but that's provably there. Run
// more shuffles and watch the naive pattern sharpen while Fisher–Yates stays flat. Real model from
// fisheryates.ts.
import { Fragment, useMemo, useRef, useState } from 'react';
import { makeRng, fisherYates, naiveShuffle, maxBias, type RNG } from './fisheryates';

const N = 6;
const zeros = () => Array.from({ length: N }, () => new Array(N).fill(0));

function Heatmap({ counts, trials, title, bias }: { counts: number[][]; trials: number; title: string; bias: number }) {
  const ideal = 1 / N;
  return (
    <div className="shf-map">
      <div className="shf-mtitle">{title} <span className={`shf-bias ${bias > 0.05 ? 'bad' : 'ok'}`}>{trials ? `${(bias * 100).toFixed(1)}% max bias` : ''}</span></div>
      <div className="shf-grid" style={{ gridTemplateColumns: `18px repeat(${N}, 1fr)` }}>
        <span className="shf-corner" />
        {Array.from({ length: N }, (_, v) => <span key={v} className="shf-head">{v}</span>)}
        {Array.from({ length: N }, (_, pos) => (
          <Fragment key={pos}>
            <span className="shf-head">{pos}</span>
            {Array.from({ length: N }, (_, v) => {
              const p = trials ? counts[pos][v] / trials : ideal;
              const d = p - ideal; // deviation from uniform
              const inten = Math.min(1, (Math.abs(d) / ideal) * 2.2);
              const bg = trials === 0 ? 'transparent' : d >= 0 ? `hsl(0 65% 50% / ${inten * 0.85})` : `hsl(212 65% 50% / ${inten * 0.85})`;
              return <span key={`${pos}-${v}`} className="shf-cell" style={{ background: bg }} title={`P(value ${v} at pos ${pos}) = ${(p * 100).toFixed(1)}%`}>{trials ? Math.round(p * 100) : ''}</span>;
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

export function FisherYatesSection() {
  const rngRef = useRef<RNG>(makeRng(12345));
  const [naive, setNaive] = useState<number[][]>(zeros);
  const [fy, setFy] = useState<number[][]>(zeros);
  const [trials, setTrials] = useState(0);

  const run = (k: number) => {
    const nc = naive.map((r) => r.slice()), fc = fy.map((r) => r.slice());
    const rng = rngRef.current;
    for (let t = 0; t < k; t++) {
      const a = Array.from({ length: N }, (_, i) => i); naiveShuffle(a, rng); for (let pos = 0; pos < N; pos++) nc[pos][a[pos]]++;
      const b = Array.from({ length: N }, (_, i) => i); fisherYates(b, rng); for (let pos = 0; pos < N; pos++) fc[pos][b[pos]]++;
    }
    setNaive(nc); setFy(fc); setTrials((x) => x + k);
  };
  const reset = () => { rngRef.current = makeRng(12345); setNaive(zeros()); setFy(zeros()); setTrials(0); };

  const naiveBias = useMemo(() => (trials ? maxBias(naive.map((r) => r.map((c) => c / trials)), N) : 0), [naive, trials]);
  const fyBias = useMemo(() => (trials ? maxBias(fy.map((r) => r.map((c) => c / trials)), N) : 0), [fy, trials]);

  return (
    <div className="shf">
      <p className="shf-intro">
        A shuffle of {N} items should make every value equally likely to land in every position — each cell of
        the position×value grid should be exactly <strong>1/{N} ≈ {(100 / N).toFixed(0)}%</strong>. The correct
        <strong> Fisher–Yates</strong> shuffle does that. The <strong>naive</strong> "swap each index with a
        random index anywhere" does not — run the shuffles and watch its bias appear.
      </p>

      <div className="shf-controls">
        <button type="button" className="shf-btn" onClick={() => run(20000)}>+20,000 shuffles</button>
        <button type="button" className="shf-btn ghost" onClick={reset}>reset</button>
        <span className="shf-count">{trials.toLocaleString()} runs each</span>
      </div>

      <div className="shf-maps">
        <Heatmap counts={naive} trials={trials} title="naive swap (biased)" bias={naiveBias} />
        <Heatmap counts={fy} trials={trials} title="Fisher–Yates (uniform)" bias={fyBias} />
      </div>

      <div className="shf-legend"><i className="shf-sw hi" /> above 1/{N} &nbsp; <i className="shf-sw lo" /> below 1/{N} &nbsp; (cell = % of runs)</div>

      <p className="shf-foot">
        The counting argument is exact: the naive shuffle makes {N} independent choices among {N} options, so
        there are {N}^{N} = {Math.pow(N, N).toLocaleString()} equally-likely execution paths, but only {N}! ={' '}
        {[...Array(N)].reduce((a, _, i) => a * (i + 1), 1).toLocaleString()} distinct orderings. Since {N}^{N} isn't
        divisible by {N}!, the paths can't spread evenly over the orderings — some come up more often, forever.
        Fisher–Yates instead makes the i-th choice among exactly i+1 options, so the product is n·(n−1)···1 = n!
        paths mapping one-to-one onto the n! orderings — perfectly uniform. The practical lessons: (1) use your
        language's built-in shuffle, which is Fisher–Yates; (2) never shuffle by sorting with a random
        comparator (<code>sort(() =&gt; Math.random() − 0.5)</code>) — that's even more biased and, with an
        inconsistent comparator, undefined behavior; (3) for unbiased results the RNG must be uniform and the
        index range must shrink each step. (Knuth, TAOCP vol. 2; the shuffle is sometimes called the Knuth
        shuffle.)
      </p>
    </div>
  );
}
