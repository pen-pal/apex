// LZW, made visible. Type text and step the encoder: each step emits the code for the
// longest match it knows and adds a new, longer entry to the dictionary — which the decoder
// rebuilds identically from the codes alone. Watch repeated substrings collapse into single
// codes. Real LZW in lzw.ts (tested, with an independent decoder).
import { useMemo, useState } from 'react';
import { encode, decode } from './lzw';

const code = (n: number) => (n < 256 ? (n >= 32 && n < 127 ? `'${String.fromCharCode(n)}'` : String(n)) : String(n));

export function LzwSection() {
  const [text, setText] = useState('TOBEORNOTTOBEORTOBEOR');
  const enc = useMemo(() => encode(text), [text]);
  const [step, setStep] = useState(1e9);

  const shown = Math.min(step, enc.steps.length);
  const visibleSteps = enc.steps.slice(0, shown);
  const codesShown = visibleSteps.map((s) => s.emit);
  const roundTrips = decode(enc.codes) === text;

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>LZW — a dictionary both sides build alike</h2></div>
        <p className="jsec-sub">
          LZW starts with every single byte already in its dictionary, then greedily extends: it emits the code for the longest string it
          already knows, and adds that string <em>plus the next byte</em> as a new entry. The decoder rebuilds the exact same dictionary
          from the codes alone — nothing extra is shipped. Repetition quickly grows long entries, so repeats collapse to one code.
        </p>

        <input className="lzw-input" value={text} onChange={(e) => { setText(e.target.value); setStep(1e9); }} spellCheck={false} />

        <div className="lzw-controls">
          <button onClick={() => setStep(0)} disabled={shown === 0}>⏮</button>
          <button onClick={() => setStep(Math.max(0, shown - 1))} disabled={shown === 0}>◀</button>
          <span className="lzw-count">step {shown} / {enc.steps.length}</span>
          <button onClick={() => setStep(shown + 1)} disabled={shown >= enc.steps.length}>▶</button>
          <button onClick={() => setStep(enc.steps.length)} disabled={shown >= enc.steps.length}>⏭</button>
        </div>

        <div className="lzw-steps">
          <div className="lzw-srow head"><span>emit</span><span>for match</span><span>add to dictionary</span></div>
          {visibleSteps.map((s, i) => (
            <div key={i} className={`lzw-srow ${i === shown - 1 ? 'cur' : ''}`}>
              <span className="lzw-code">{code(s.emit)}</span>
              <span className="lzw-match">“{s.forString}”</span>
              <span className="lzw-add">{s.added ? <>{s.added.code} = “{s.added.str}”</> : <em>— (final)</em>}</span>
            </div>
          ))}
        </div>

        <div className="lzw-out">
          <div className="lzw-olabel">output codes:</div>
          <div className="lzw-codes">{codesShown.map((c, i) => <span key={i} className="lzw-c">{code(c)}</span>)}</div>
        </div>

        <div className="lzw-stats">
          <span><b>{text.length}</b> chars → <b>{enc.codes.length}</b> codes</span>
          <span>dictionary grew to <b>{enc.finalDictSize}</b> entries</span>
          <span className={roundTrips ? 'lzw-ok' : 'lzw-bad'}>{roundTrips ? '✓ decodes back exactly' : '✗ mismatch'}</span>
        </div>

        <p className="lzw-foot">
          Because the dictionary is rebuilt deterministically, LZW never sends it — that’s its elegance over LZ77, which ships explicit
          (distance, length) back-references. The trade-off is that LZW adapts more slowly at the start (the dictionary is empty of
          multi-byte entries) and its fixed code width eventually fills up (real implementations grow the width or reset the table). It
          powered GIF and Unix <code>compress</code>; DEFLATE (gzip/PNG) later won out by combining LZ77 with Huffman coding.
        </p>
      </section>
    </div>
  );
}
