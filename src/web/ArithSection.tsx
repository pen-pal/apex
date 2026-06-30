// Arithmetic coding, made visible. Type a message; watch the interval [0,1) narrow one symbol at a
// time into the tiny slice that encodes the whole string, then read off the single number and the bits
// it costs — fewer than Huffman's one-bit-per-symbol floor whenever the data is skewed. The decode line
// proves it round-trips. Real coder from arith.ts.
import { useMemo, useState } from 'react';
import { modelOf, spans, encode, decode, entropyBits, huffmanFloorBits } from './arith';

const PRESETS = ['BANANA', 'MISSISSIPPI', 'AAAAAAAAAB'];
const num = (x: number) => (x !== 0 && Math.abs(x) < 1e-4 ? x.toExponential(3) : x.toFixed(6));

export function ArithSection() {
  const [msg, setMsg] = useState('BANANA');
  const clean = (msg.toUpperCase().replace(/[^A-Z]/g, '') || 'A').slice(0, 12);

  const model = useMemo(() => modelOf(clean), [clean]);
  const sp = useMemo(() => spans(model), [model]);
  const enc = useMemo(() => encode(clean, model), [clean, model]);
  const decoded = useMemo(() => decode(enc.code, model, clean.length), [enc, model, clean.length]);
  const total = model.order.reduce((a, s) => a + model.freq[s], 0);

  const steps = useMemo(() => {
    let low = 0, high = 1;
    return [...clean].map((c) => {
      const s = sp.find((x) => x.sym === c)!;
      const range = high - low;
      const nlow = low + range * s.lo;
      const nhigh = low + range * s.hi;
      low = nlow; high = nhigh;
      return { c, low, high };
    });
  }, [clean, sp]);

  const ent = entropyBits(clean, model);
  const floor = huffmanFloorBits(clean);
  const barMax = Math.max(enc.bits, ent, floor);

  return (
    <div className="arc">
      <div className="arc-in">
        <label>message <input value={msg} spellCheck={false} onChange={(e) => setMsg(e.target.value)} /></label>
        <div className="arc-presets">{PRESETS.map((p) => <button key={p} type="button" onClick={() => setMsg(p)}>{p}</button>)}</div>
      </div>

      <div className="arc-model">
        <div className="arc-h">model — each symbol owns a slice of [0,1)</div>
        <div className="arc-slices">
          {sp.map((s) => (
            <div key={s.sym} className="arc-slice" style={{ width: `${(s.hi - s.lo) * 100}%` }} title={`${s.sym}: [${num(s.lo)}, ${num(s.hi)})`}>
              <span className="arc-sym">{s.sym}</span>
              <span className="arc-p">{model.freq[s.sym]}/{total}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="arc-steps">
        <div className="arc-h">narrowing the interval, symbol by symbol</div>
        {steps.map((st, i) => {
          const prevLow = i === 0 ? 0 : steps[i - 1].low;
          const prevRange = (i === 0 ? 1 : steps[i - 1].high - steps[i - 1].low) || 1;
          const relLo = (st.low - prevLow) / prevRange, relHi = (st.high - prevLow) / prevRange;
          return (
            <div key={i} className="arc-step">
              <span className="arc-step-c">{st.c}</span>
              <div className="arc-step-bar">
                <div className="arc-step-sel" style={{ left: `${relLo * 100}%`, width: `${Math.max(1.5, (relHi - relLo) * 100)}%` }} />
              </div>
              <span className="arc-step-iv">[{num(st.low)}, {num(st.high)})</span>
            </div>
          );
        })}
      </div>

      <div className="arc-result">
        <div className="arc-code">code = a number in the final interval: <b>{num(enc.code)}</b></div>
        <div className="arc-decode">decode({num(enc.code)}, {clean.length} symbols) = <b>{decoded}</b> <span className={decoded === clean ? 'ok' : 'bad'}>{decoded === clean ? '✓ round-trips' : '✗'}</span></div>
      </div>

      <div className="arc-compare">
        <div className="arc-h">bits to encode “{clean}” ({clean.length} symbols)</div>
        {[['arithmetic coding', enc.bits, 'arc-arith'], ['Shannon entropy (ideal)', +ent.toFixed(2), 'arc-ent'], ['Huffman floor (≥1 bit/sym)', floor, 'arc-huff']].map(([l, v, cls]) => (
          <div key={l as string} className="arc-cmp">
            <span className="arc-cmp-l">{l}</span>
            <div className="arc-cmp-bar"><div className={`arc-cmp-fill ${cls}`} style={{ width: `${((v as number) / barMax) * 100}%` }} /></div>
            <span className="arc-cmp-v">{v} bits</span>
          </div>
        ))}
      </div>

      <p className="arc-foot">
        Huffman assigns each symbol a whole number of bits, so it can never spend less than 1 bit on a symbol — wasteful when one symbol is very
        likely. Arithmetic coding sidesteps that by never giving a symbol its own codeword: the message becomes one number whose interval width is
        the product of the symbol probabilities, so the cost is exactly <strong>−Σ log₂ p</strong>, the entropy. Real coders renormalize with
        integer arithmetic (emitting bits as the interval’s leading digits settle) so they never run out of floating-point precision, and pair it
        with an adaptive model that updates frequencies as it goes. It’s the entropy stage inside JPEG, H.264/265, and modern compressors (where
        the faster <em>range coder</em> / <em>rANS</em> variants now dominate). (Witten, Neal &amp; Cleary, 1987.)
      </p>
    </div>
  );
}
