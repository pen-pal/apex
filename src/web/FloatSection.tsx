// Guided story #7: how a computer stores a fraction — IEEE-754, on the GuidedStory engine. The "why does
// 0.1 + 0.2 ≠ 0.3?" story. Scenes: the range-vs-precision problem, binary scientific notation, the 32-bit layout
// (1 sign · 8 exponent · 23 mantissa), a worked decode, why 0.1 can't be exact, then a live box: type any number
// and see its real bits and the value actually stored. All bits are real IEEE-754 (DataView), not illustrative.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const bits32 = (x: number) => { const dv = new DataView(new ArrayBuffer(4)); dv.setFloat32(0, x); return dv.getUint32(0).toString(2).padStart(32, '0'); };
const stored32 = (x: number) => { const dv = new DataView(new ArrayBuffer(4)); dv.setFloat32(0, x); return dv.getFloat32(0); };

type Phase = 'problem' | 'scinot' | 'layout' | 'decode' | 'inexact' | 'run';

export function FloatSection() {
  const [txt, setTxt] = useState('0.1');
  const x = Number(txt);
  const valid = txt.trim() !== '' && !Number.isNaN(x);

  const narrated = (key: Phase, title: string, caption: string, ex: number): StoryScene =>
    ({ key, title, caption, render: () => <Float32 phase={key} x={ex} /> });

  const scenes: StoryScene[] = [
    narrated('problem', 'One format, a huge range', 'A computer has to store 0.000001 and 600000000000 and everything between, all in 32 bits. Fixed-point — a binary point at a set place — either covers the range or the precision, never both. Floating point moves the point.', 0.15625),
    narrated('scinot', 'Scientific notation, in binary', 'Write the number as ±1.fraction × 2^exponent — like 6.02 × 10²³, but base 2. Then you only need to store three things: the sign, the exponent, and the fraction. The leading 1 is always there, so it is not even stored.', 0.15625),
    narrated('layout', 'The 32 bits', 'float32 spends them as 1 sign bit, 8 exponent bits (stored with a +127 bias so it can go negative), and 23 mantissa bits for the fraction after the point. A double just widens this to 11 and 52.', 0.15625),
    narrated('decode', 'Decoding 0.15625', 'Read it back: sign 0 is positive; exponent 01111100 = 124, minus the 127 bias = −3; mantissa 1.01₂ = 1.25. So 1.25 × 2⁻³ = 0.15625, exactly. Powers of two land perfectly.', 0.15625),
    narrated('inexact', 'Why 0.1 cannot be exact', '0.1 in binary is 0.0001100110011… — it repeats forever, like 1/3 in decimal. Twenty-three bits can only hold a rounded piece of it, so what is stored is 0.100000001490…, a hair too big. Add the rounded 0.1 and 0.2 and you get 0.30000000000000004. Not a bug — the format.', 0.1),
    { key: 'run', title: 'Store any number', caption: 'Type a number and watch its real IEEE-754 bits and the value actually stored. Powers of two (0.5, 0.25, 1.5) are exact; most decimals are not.', render: () => <Float32 phase="run" x={0.1} live={valid ? x : NaN} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>A computer has to store 0.0000001 and 600000000000 and everything between, all in a fixed 32 bits. A fixed decimal point can’t do both at once — it either reaches the huge range or keeps the fine precision, never both. Floating point borrows scientific notation: store a number as a sign, a fraction, and an exponent that slides the point to wherever it is needed.</>,
        takeaway: <>The 32 bits split into 1 sign bit, 8 exponent bits (offset so the exponent can go negative), and 23 fraction bits. Powers of two and simple fractions land exactly; most decimals do not, because a value like 0.1 is a <em>repeating</em> fraction in binary and has to be rounded to fit 23 bits. That rounding is not a bug, it is the format — and it is why 0.1 + 0.2 evaluates to 0.30000000000000004, why you compare floats with a tolerance instead of ==, and why money is counted in integer cents, never floats.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <>
          <span className="flt-live-lbl">store a number:</span>
          <input className="flt-input" value={txt} spellCheck={false} onChange={(e) => setTxt(e.target.value)} />
          <span className="flt-live-note">{valid ? <>stored as <b>{stored32(x) === x ? `${x} (exact)` : stored32(x).toPrecision(9)}</b></> : 'not a number'}</span>
        </>
      )}
    />
  );
}

function Float32({ phase, x, live }: { phase: Phase; x: number; live?: number }) {
  const on = (p: Phase) => phase === p;
  const val = on('run') ? (live ?? NaN) : x;
  const b = Number.isNaN(val) ? '0'.repeat(32) : bits32(val);
  const sign = b[0], exp = b.slice(1, 9), mant = b.slice(9);
  const expVal = parseInt(exp, 2);
  const stored = Number.isNaN(val) ? NaN : stored32(val);
  const inexact = !Number.isNaN(val) && stored !== val;
  const bw = 26, x0 = 30;
  const field = (i: number) => i === 0 ? 'sign' : i <= 8 ? 'exp' : 'mant';
  return (
    <svg viewBox="0 0 900 480" className="story-svg">
      {/* field labels */}
      <text x={x0 + bw / 2} y="120" className="flt-flbl sign" textAnchor="middle">±</text>
      <text x={x0 + bw * 5} y="120" className="flt-flbl exp" textAnchor="middle">exponent · 8 bits (bias 127)</text>
      <text x={x0 + bw * 20} y="120" className="flt-flbl mant" textAnchor="middle">mantissa · 23 bits (the fraction)</text>
      {/* the 32 bits */}
      {[...b].map((bit, i) => {
        const f = field(i);
        const hot = (on('decode') && (f === 'exp' || i === 0)) || (on('inexact') && f === 'mant') || on('run');
        return (
          <g key={i}>
            <rect x={x0 + i * bw} y="140" width={bw - 2} height="42" rx="3" className={`flt-bit ${f} ${hot ? 'hot' : ''}`} />
            <text x={x0 + i * bw + (bw - 2) / 2} y="167" className="flt-bit-txt" textAnchor="middle">{bit}</text>
          </g>
        );
      })}
      {/* value breakdown */}
      {!on('problem') && !Number.isNaN(val) && (
        <text x="450" y="240" className="flt-formula" textAnchor="middle">
          {sign === '1' ? '−' : '+'} 1.{mant.replace(/0+$/, '') || '0'}₂ × 2^({expVal} − 127) = 2^{expVal - 127}
        </text>
      )}
      {on('scinot') && <text x="450" y="290" className="flt-mid" textAnchor="middle">±1.fraction × 2^exponent — three fields, and the leading 1 comes free</text>}
      {(on('decode') || on('run') || on('inexact')) && !Number.isNaN(val) && (
        <text x="450" y="300" className={`flt-value ${inexact ? 'inexact' : ''}`} textAnchor="middle">
          = {inexact ? stored.toPrecision(9) : String(stored)} {inexact ? `  (you asked for ${on('run') ? live : x})` : '  (exact)'}
        </text>
      )}
      {on('inexact') && <text x="450" y="345" className="flt-bug" textAnchor="middle">0.1 + 0.2 = 0.30000000000000004</text>}
      {on('problem') && <>
        <text x="450" y="250" className="flt-mid" textAnchor="middle">store 0.000001 … and 600000000000 … in the same 32 bits</text>
        <text x="450" y="285" className="flt-mid" textAnchor="middle">fixed-point picks range OR precision — floating point moves the point</text>
      </>}
      <text x="450" y="420" className="flt-foot" textAnchor="middle">
        {on('problem') ? 'the same trick as scientific notation: keep a few significant digits, track the magnitude separately'
          : on('scinot') ? 'store the sign, the exponent, and the fraction — reconstruct the rest'
          : on('layout') ? 'a double widens the exponent to 11 bits and the mantissa to 52'
          : on('decode') ? 'exponent minus the 127 bias, times the 1.mantissa — real IEEE-754'
          : on('inexact') ? 'a finite binary fraction can only approximate most decimals'
          : (Number.isNaN(val) ? 'enter a number' : inexact ? 'stored value differs from what you typed — that gap is rounding' : 'this one lands exactly on a binary fraction')}
      </text>
    </svg>
  );
}
