// LZ77, made visible. Step through the encoder one token at a time: the search window
// (everything seen so far, capped) sits to the left of the look-ahead, the longest match
// lights up in both the window (its source) and the look-ahead (where it's reused), and
// a (distance, length, next) token drops into the output stream. The running stats show
// how repetition collapses. Real logic in lz77.ts (tested, with an independent decoder).
import { useMemo, useState } from 'react';
import { lz77, lz77Decode, stats } from './lz77';

const WINDOW = 24;

export function Lz77Section() {
  const [input, setInput] = useState('abracadabra abracadabra');
  const tokens = useMemo(() => lz77(input, WINDOW), [input]);
  const [step, setStep] = useState(0); // start at the beginning so it builds up (not the finished state)

  // clamp step when input changes
  const s = Math.min(step, tokens.length);
  const shown = tokens.slice(0, s);
  const cur = s < tokens.length ? tokens[s] : null;
  const st = stats(input, tokens);

  // character classes for the current step
  const cls = (i: number): string => {
    if (!cur) return i < input.length ? 'done' : '';
    const winStart = Math.max(0, cur.pos - WINDOW);
    const matchStart = cur.pos - cur.offset;
    if (cur.length && i >= matchStart && i < matchStart + cur.length) return 'src';
    if (cur.length && i >= cur.pos && i < cur.pos + cur.length) return 'match';
    if (i === cur.pos + cur.length) return 'next';
    if (i >= winStart && i < cur.pos) return 'win';
    if (i < winStart) return 'done';
    return 'future';
  };

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>LZ77 — the data is its own dictionary</h2></div>
        <p className="jsec-sub">
          Compression by memory: at each position the encoder looks back over a sliding <strong>window</strong> of bytes it has
          already seen and finds the longest match for the text ahead, then emits a compact <code>(distance, length, next)</code> token
          instead of spelling the bytes out again. A distance-1 match copies a repeating byte; a repeated word copies itself. Step
          through it:
        </p>

        <input className="lz-input" value={input} onChange={(e) => { setInput(e.target.value); setStep(1e9); }} spellCheck={false} />

        <div className="lz-tape">
          {input.split('').map((ch, i) => (
            <span key={i} className={`lz-cell ${cls(i)}`}>{ch === ' ' ? '␣' : ch}</span>
          ))}
        </div>

        <div className="lz-controls">
          <button onClick={() => setStep(0)} disabled={s === 0}>⏮</button>
          <button onClick={() => setStep(Math.max(0, s - 1))} disabled={s === 0}>◀ back</button>
          <span className="lz-stepcount">token {s} / {tokens.length}</span>
          <button onClick={() => setStep(s + 1)} disabled={s >= tokens.length}>next ▶</button>
          <button onClick={() => setStep(tokens.length)} disabled={s >= tokens.length}>⏭</button>
        </div>

        {cur && (
          <div className="lz-cur">
            {cur.length
              ? <>matched <b>{cur.length}</b> char{cur.length === 1 ? '' : 's'} back at distance <b>{cur.offset}</b>, then literal <code>{cur.next === ' ' ? '␣' : cur.next}</code> → emit <code>({cur.offset},{cur.length},{cur.next === ' ' ? '␣' : cur.next})</code></>
              : <>no match — emit literal <code>(0,0,{cur.next === ' ' ? '␣' : cur.next})</code></>}
          </div>
        )}

        <div className="lz-legend">
          <span><i className="lz-cell win" /> window</span>
          <span><i className="lz-cell src" /> match source</span>
          <span><i className="lz-cell match" /> reused ahead</span>
          <span><i className="lz-cell next" /> literal next</span>
        </div>

        <div className="lz-tokens">
          {shown.map((t, i) => (
            <span key={i} className={`lz-token ${t.length ? 'copy' : 'lit'}`}>
              ({t.offset},{t.length},{t.next === ' ' ? '␣' : t.next})
            </span>
          ))}
        </div>

        <div className="lz-stats">
          <span><b>{st.tokens}</b> tokens</span>
          <span><b>{st.literals}</b> literals · <b>{st.copies}</b> copies</span>
          <span><b>{st.copiedChars}</b> chars came from copies</span>
          <span className={lz77Decode(tokens) === input ? 'lz-ok' : 'lz-bad'}>
            {lz77Decode(tokens) === input ? '✓ decodes back exactly' : '✗ mismatch'}
          </span>
        </div>

        <p className="lz-foot">
          This is the dictionary half of <strong>DEFLATE</strong> (gzip, zlib, PNG): LZ77 removes the repetition, then Huffman coding
          (see the Huffman section) packs the leftover literals and tokens by frequency. Bigger windows find more distant matches —
          gzip uses 32 KB, Brotli up to 16 MB — which is why large, repetitive files shrink so dramatically.
        </p>
      </section>
    </div>
  );
}
