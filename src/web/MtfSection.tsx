// Move-to-front, made visible. Step through a string: at each symbol the list lights up its current
// index (that's the emitted number), then the symbol jumps to the front. Watch a run of the same
// character collapse into a run of zeros — the small-number stream that makes the BWT so compressible.
// The decode line proves it round-trips. Real coder from mtf.ts.
import { useMemo, useState } from 'react';
import { trace, encode, decode, alphabetOf } from './mtf';

const PRESETS = ['bananaaa', 'annb$aa', 'mississippi'];

export function MtfSection() {
  const [text, setText] = useState('annb$aa');
  const [step, setStep] = useState(0);
  const clean = (text || 'a').slice(0, 16);
  const alpha = useMemo(() => alphabetOf(clean), [clean]);
  const steps = useMemo(() => trace(clean, alpha), [clean, alpha]);
  const out = useMemo(() => encode(clean, alpha), [clean, alpha]);
  const roundtrip = useMemo(() => decode(out, alpha), [out, alpha]);

  const curList = step === 0 ? alpha : steps[step - 1].listAfter;
  const cur = step > 0 ? steps[step - 1] : null;
  const zeros = out.filter((x) => x === 0).length;

  const pick = (t: string) => { setText(t); setStep(0); };

  return (
    <div className="mtf">
      <div className="mtf-in">
        <label>input <input value={text} spellCheck={false} onChange={(e) => pick(e.target.value)} /></label>
        <div className="mtf-presets">{PRESETS.map((p) => <button key={p} type="button" onClick={() => pick(p)}>{p}</button>)}</div>
      </div>

      <div className="mtf-text">
        {[...clean].map((c, i) => <span key={i} className={`mtf-tc ${i === step - 1 ? 'cur' : ''} ${i < step ? 'done' : ''}`}>{c}</span>)}
      </div>

      <div className="mtf-list-row">
        <span className="mtf-label">list</span>
        <div className="mtf-list">
          {curList.map((c, i) => <span key={i} className={`mtf-li ${i === 0 && cur ? 'front' : ''}`}>{c}</span>)}
        </div>
        {cur && <span className="mtf-emit">emitted <b>{cur.index}</b> for “{cur.sym}”, moved to front</span>}
      </div>

      <div className="mtf-out-row">
        <span className="mtf-label">output</span>
        <div className="mtf-out">
          {out.map((n, i) => <span key={i} className={`mtf-on ${n === 0 ? 'zero' : ''} ${i < step ? 'shown' : 'dim'}`}>{n}</span>)}
        </div>
      </div>

      <div className="mtf-steps">
        <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>◀</button>
        <button type="button" className="primary" onClick={() => setStep((s) => Math.min(clean.length, s + 1))} disabled={step >= clean.length}>step ▶</button>
        <button type="button" onClick={() => setStep(clean.length)} disabled={step >= clean.length}>all</button>
        <button type="button" onClick={() => setStep(0)} disabled={step === 0}>reset</button>
      </div>

      <div className="mtf-result">
        <span>{zeros} of {out.length} outputs are <b>0</b> (runs collapsed)</span>
        <span className="mtf-rt">decode → <code>{roundtrip}</code> <i className={roundtrip === clean ? 'ok' : 'bad'}>{roundtrip === clean ? '✓ round-trips' : '✗'}</i></span>
      </div>

      <p className="mtf-foot">
        MTF doesn’t compress on its own — the output is the same length as the input. What it does is <strong>change the statistics</strong>: it
        turns “this character was used recently” into a small number, so the locally-skewed, run-heavy output of the <strong>Burrows-Wheeler
        transform</strong> becomes a stream dominated by zeros and small values. That’s gold for the stages after it — a run-length pass eats the
        zero runs, and a Huffman/entropy coder gives the now-very-common small numbers the shortest codes. BWT → <em>MTF</em> → RLE → Huffman is
        exactly the bzip2 pipeline. (Bentley, Sleator, Tarjan &amp; Wei, 1986.)
      </p>
    </div>
  );
}
