// Golomb-Rice coding, made visible. Type a number and a parameter k; watch it split into a quotient (sent
// in unary — q ones and a stop bit) and a remainder (k binary bits). Small numbers make tiny codes. Below,
// a set of values and the bits-per-k curve show why the parameter matters: too small and the unary explodes,
// too big and you waste remainder bits — there's a sweet spot. Real model from golombrice.ts.
import { useMemo, useState } from 'react';
import { codeLength, bestK } from './golombrice';

const SAMPLE = [2, 0, 1, 5, 0, 3, 1, 0, 2, 7, 1, 0];

export function GolombRiceSection() {
  const [n, setN] = useState(11);
  const [k, setK] = useState(2);

  const q = n >>> k, r = n & ((1 << k) - 1);
  const unary = '1'.repeat(q) + '0';
  const binary = k > 0 ? r.toString(2).padStart(k, '0') : '';

  const [vals, setVals] = useState(SAMPLE.join(' '));
  const parsed = useMemo(() => vals.split(/[\s,]+/).map(Number).filter((x) => Number.isFinite(x) && x >= 0).map((x) => Math.floor(x)), [vals]);
  const curve = useMemo(() => Array.from({ length: 11 }, (_, kk) => ({ k: kk, bits: parsed.reduce((s, v) => s + codeLength(v, kk), 0) })), [parsed]);
  const opt = useMemo(() => (parsed.length ? bestK(parsed, 10) : { k: 0, bits: 0 }), [parsed]);
  const maxBits = Math.max(...curve.map((c) => c.bits), 1);

  return (
    <div className="grc">
      <p className="grc-intro">
        Golomb-Rice packs a non-negative integer into a <strong>quotient</strong> q = ⌊n / 2<sup>k</sup>⌋ sent
        in <strong>unary</strong> (q ones then a 0) and a <strong>remainder</strong> r = n mod 2<sup>k</sup> in
        k <strong>binary</strong> bits. Small values cost almost nothing — which is exactly the win when small
        values dominate (audio residuals, gaps between events, sparse bitmaps).
      </p>

      <div className="grc-enc">
        <div className="grc-inputs">
          <label>n <input type="number" min={0} value={n} onChange={(e) => setN(Math.max(0, Math.floor(+e.target.value) || 0))} /></label>
          <label>k <input type="range" min={0} max={8} value={k} onChange={(e) => setK(+e.target.value)} /><b>{k}</b> <span className="grc-m">M = {1 << k}</span></label>
        </div>
        <div className="grc-split">
          <div className="grc-part q"><span className="grc-pl">quotient q = {q} (unary)</span><code>{[...unary].map((c, i) => <b key={i} className={c === '1' ? 'one' : 'stop'}>{c}</b>)}</code></div>
          <div className="grc-part r"><span className="grc-pl">remainder r = {r} ({k} bits)</span><code>{binary ? [...binary].map((c, i) => <b key={i} className="bin">{c}</b>) : <i>none</i>}</code></div>
        </div>
        <div className="grc-codeline">codeword: <code className="grc-code">{unary + binary || '0'}</code> <span className="grc-len">{codeLength(n, k)} bits</span></div>
      </div>

      <div className="grc-tune">
        <label className="grc-vals">values <input value={vals} onChange={(e) => setVals(e.target.value)} spellCheck={false} /></label>
        <div className="grc-curve">
          {curve.map((c) => (
            <div key={c.k} className={`grc-bar ${c.k === opt.k ? 'best' : ''}`} title={`k=${c.k}: ${c.bits} bits`} onClick={() => setK(c.k)}>
              <div className="grc-barfill" style={{ height: `${(1 - c.bits / maxBits) * 70 + 8}%` }} />
              <span className="grc-bk">{c.k}</span>
            </div>
          ))}
        </div>
        <div className="grc-opt">best k = <b>{opt.k}</b> → {opt.bits} bits for {parsed.length} values ({(opt.bits / Math.max(1, parsed.length)).toFixed(1)} bits each). A fixed 8-bit byte each would be {parsed.length * 8}.</div>
      </div>

      <p className="grc-foot">
        Why it works: Golomb coding is the <em>optimal</em> prefix code for a geometric distribution, and
        Rice (M = 2<sup>k</sup>) makes the remainder a clean bit-field so encode/decode are just shifts. The
        parameter k should track the mean — roughly k ≈ log₂(mean) — and real codecs re-pick it per block as
        the data's statistics drift (FLAC does exactly this per audio frame). It pairs with a
        <strong> predictor</strong>: don't code the samples, code the small residual after subtracting a
        prediction, so the values fed to Rice really are tiny. Compared with a generic
        <strong> arithmetic/range coder</strong> it's a hair less efficient but far faster and simpler — which
        is why it dominates lossless audio and shows up in BIP158 compact block filters. (Golomb 1966; Rice 1979.)
      </p>
    </div>
  );
}
