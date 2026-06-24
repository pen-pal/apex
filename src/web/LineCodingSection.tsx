// Line coding, made visible. Type a bit pattern and watch the same bits drawn as five
// different voltage waveforms — NRZ-L, NRZI, Manchester, Differential Manchester, AMI —
// each as a real step signal. The point is the comparison: which schemes guarantee a
// transition every bit (self-clocking), which stay DC-balanced, how many levels the
// receiver must tell apart. Real logic in linecoding.ts (tested).
import { useMemo, useState } from 'react';
import { encodeAll, type Bit, type Level } from './linecoding';

const W = 34;   // px per half-bit
const H = 46;   // waveform height
const MID = H / 2;
const y = (l: Level) => MID - l * (H / 2 - 6);

function Waveform({ samples }: { samples: Level[] }) {
  const width = samples.length * W;
  // build a step path: hold each sample for one half-bit, vertical jump between
  let d = `M 0 ${y(samples[0])}`;
  for (let i = 0; i < samples.length; i++) {
    const x0 = i * W, x1 = (i + 1) * W;
    if (i > 0 && samples[i] !== samples[i - 1]) d += ` L ${x0} ${y(samples[i])}`;
    d += ` L ${x1} ${y(samples[i])}`;
  }
  return (
    <svg className="line-wave" viewBox={`0 0 ${width} ${H}`} width={width} height={H} preserveAspectRatio="none">
      <line x1={0} y1={y(0)} x2={width} y2={y(0)} className="line-zero" />
      {samples.map((_, i) => i % 2 === 0 && <line key={i} x1={i * W} y1={0} x2={i * W} y2={H} className="line-tick" />)}
      <path d={d} className="line-path" />
    </svg>
  );
}

export function LineCodingSection() {
  const [text, setText] = useState('10110010');
  const bits = useMemo(() => text.replace(/[^01]/g, '').split('').map((c) => +c as Bit), [text]);
  const safe = bits.length ? bits : ([0] as Bit[]);
  const encs = useMemo(() => encodeAll(safe), [safe]);
  const width = safe.length * 2 * W;

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Line coding — bits become a waveform</h2></div>
        <p className="jsec-sub">
          A <code>1</code> and a <code>0</code> have to become actual voltage on a wire — but there are many ways to do it, and the
          choice decides whether the receiver can recover the clock, whether the signal carries a DC bias, and how many levels it must
          distinguish. Here are five classic schemes drawing the <em>same</em> bits. Edit the pattern:
        </p>

        <input className="line-input" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} placeholder="bits, e.g. 10110010" />

        <div className="line-grid" style={{ width: Math.max(width, 200) }}>
          <div className="line-bits" style={{ gridTemplateColumns: `repeat(${safe.length}, ${2 * W}px)` }}>
            {safe.map((b, i) => <span key={i} className={b ? 'one' : 'zero'}>{b}</span>)}
          </div>
        </div>

        <div className="line-rows">
          {encs.map((e) => (
            <div key={e.id} className="line-row">
              <div className="line-meta">
                <span className="line-name">{e.name}</span>
                <span className="line-badges">
                  <i className={e.selfClocking ? 'ok' : 'no'}>{e.selfClocking ? '⟲ self-clocking' : 'needs clock'}</i>
                  <i className="lv">{e.levels} levels</i>
                </span>
              </div>
              <div className="line-scroll"><Waveform samples={e.samples} /></div>
              <div className="line-note">{e.note}</div>
            </div>
          ))}
        </div>

        <p className="line-foot">
          Why it matters: NRZ is cheap but a long run of identical bits drifts the receiver’s clock until it samples the wrong bit —
          which is exactly why fast links scramble or use <strong>self-clocking</strong> codes (Manchester) or block codes (4B/5B, 8b/10b)
          that guarantee frequent transitions. AMI keeps the average voltage at zero so the signal can pass through transformers.
        </p>
      </section>
    </div>
  );
}
