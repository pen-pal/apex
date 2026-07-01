// Kahan summation, made visible. Pick a sequence and watch two running totals race: the naive one silently drops
// low-order bits, while the Kahan one carries a compensation term that folds the lost bits back. The error bars
// show naive drift growing while Kahan stays pinned to the true sum. Real logic from kahansum.ts.
import { useMemo, useState } from 'react';
import { naiveSum, kahanSum } from './kahansum';

const EPS = Math.pow(2, -53);
const PRESETS: Record<string, { nums: number[]; trueSum: number; note: string }> = {
  'add 0.1 a thousand times': { nums: Array(1000).fill(0.1), trueSum: 100, note: '0.1 is not exact in binary, so each addition rounds — the errors pile up' },
  'big number + a million crumbs': { nums: [1, ...Array(1_000_000).fill(EPS)], trueSum: 1 + 1_000_000 * EPS, note: 'each crumb is smaller than the total’s last bit — naive drops every one; Kahan keeps them all' },
  'ten 0.1s': { nums: Array(10).fill(0.1), trueSum: 1, note: 'the textbook case: naive gives 0.9999999999999999' },
};

export function KahanSumSection() {
  const [key, setKey] = useState('big number + a million crumbs');
  const p = PRESETS[key];
  const { naive, kahan, naiveErr, kahanErr, steps } = useMemo(() => {
    const kr = kahanSum(p.nums);
    const naive = naiveSum(p.nums);
    // build the naive running total for the first/last display steps
    let ns = 0; const nsteps: number[] = [];
    for (let i = 0; i < Math.min(p.nums.length, 7); i++) { ns += p.nums[i]; nsteps.push(ns); }
    const rows = kr.steps.slice(0, 7).map((s, i) => ({ x: s.x, naive: nsteps[i], kahan: s.sum, c: s.c }));
    return { naive, kahan: kr.sum, naiveErr: Math.abs(naive - p.trueSum), kahanErr: Math.abs(kr.sum - p.trueSum), steps: rows };
  }, [p]);

  const barW = (e: number) => Math.min(100, (e / Math.max(naiveErr, 1e-300)) * 100);
  const fmtX = (x: number) => (x !== 0 && (Math.abs(x) < 1e-4 || Math.abs(x) >= 1e7)) ? x.toExponential(3) : String(x);

  return (
    <div className="khn">
      <p className="khn-intro">
        A float carries ~15–16 significant digits. Add a small number to a large running total and the small one's
        low bits fall off the end and vanish — do it a million times and the lost bits become a real error. Kahan
        summation carries a second variable, the <strong>compensation</strong>, that remembers exactly what the
        last addition dropped and folds it back into the next one. The error then stays near one rounding unit no
        matter how many terms you add.
      </p>

      <div className="khn-presets">{Object.keys(PRESETS).map((k) => <button key={k} type="button" className={`khn-preset ${k === key ? 'on' : ''}`} onClick={() => setKey(k)}>{k}</button>)}</div>
      <div className="khn-note">{p.note} · <span className="khn-count">{p.nums.length.toLocaleString()} terms</span></div>

      <div className="khn-results">
        <div className="khn-res bad">
          <span className="khn-rl">naive sum</span>
          <span className="khn-rv">{naive.toPrecision(17)}</span>
          <div className="khn-bar"><div className="khn-fill bad" style={{ width: `${barW(naiveErr)}%` }} /></div>
          <span className="khn-re">error {naiveErr === 0 ? '0' : naiveErr.toExponential(2)}</span>
        </div>
        <div className="khn-res good">
          <span className="khn-rl">Kahan sum</span>
          <span className="khn-rv">{kahan.toPrecision(17)}</span>
          <div className="khn-bar"><div className="khn-fill good" style={{ width: `${barW(kahanErr)}%` }} /></div>
          <span className="khn-re">error {kahanErr === 0 ? '0 — exact' : kahanErr.toExponential(2)}</span>
        </div>
        <div className="khn-true">true sum = <b>{p.trueSum.toPrecision(17)}</b></div>
      </div>

      <div className="khn-trace">
        <div className="khn-th"><span>+ value</span><span>naive total</span><span>Kahan total</span><span>compensation c</span></div>
        {steps.map((s, i) => (
          <div key={i} className="khn-tr">
            <span className="khn-x">{fmtX(s.x)}</span>
            <span className="khn-n">{s.naive.toPrecision(16)}</span>
            <span className="khn-k">{s.kahan.toPrecision(16)}</span>
            <span className="khn-c">{s.c === 0 ? '0' : s.c.toExponential(2)}</span>
          </div>
        ))}
        {p.nums.length > 7 && <div className="khn-more">… {(p.nums.length - 7).toLocaleString()} more terms</div>}
      </div>

      <p className="khn-foot">
        The line that does the work is <code>c = (t - sum) - y</code>: after the lossy addition <code>t = sum +
        y</code>, the quantity <code>t - sum</code> is the part of <code>y</code> that actually survived, so
        subtracting <code>y</code> leaves exactly the negative of what was dropped — computed in plain floating
        point, because the two large values cancel and expose the low bits. Be honest about the scope, though:
        Kahan fixes <em>accumulation</em> error, the kind that grows with the number of terms. It does <em>not</em>
        rescue <em>catastrophic cancellation</em> — subtracting two nearly-equal huge numbers ([1e100, 1, −1e100]
        loses the 1 under Kahan too), because there the information is destroyed before the compensation can catch
        it; that needs higher precision or a reformulated algorithm. Where Kahan shines is the common case: a
        running mean over a long stream, a dot product, a physics simulation stepping millions of times — anywhere
        naive summation would slowly drift. Neumaier's variant improves it further when the next term is larger
        than the total; pairwise (cascade) summation is another O(n) approach with similar accuracy. (Kahan 1965;
        Higham, <em>Accuracy and Stability of Numerical Algorithms</em>.)
      </p>
    </div>
  );
}
