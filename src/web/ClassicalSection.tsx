// Classical ciphers, made visible — and broken. Shift a Caesar cipher and then crack
// it from the ciphertext alone by frequency analysis (no brute force); see Vigenère's
// repeating key; and watch the letter-frequency fingerprint that gives both away. This
// is why modern ciphers are designed to look like uniform random noise. Real shifts +
// χ² fit (classical.ts, verified to the canonical vectors).
import { useMemo, useState } from 'react';
import { caesar, vigenere, crackCaesar, letterFreq, ENGLISH_FREQ } from './classical';

export function ClassicalSection() {
  const [text, setText] = useState('the enemy attacks at dawn from the north ridge');
  const [shift, setShift] = useState(7);
  const [vkey, setVkey] = useState('LEMON');
  const [cracked, setCracked] = useState(false);

  const cipher = caesar(text, shift);
  const crack = useMemo(() => crackCaesar(cipher), [cipher]);
  const freq = useMemo(() => letterFreq(cipher), [cipher]);
  const maxF = Math.max(10, ...Object.values(freq), ...Object.values(ENGLISH_FREQ));
  const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>① Caesar — a fixed shift, and how it falls</h2></div>
        <p className="jsec-sub">
          Caesar rotates every letter by the same amount. With only 26 keys you could brute-force it, but you don’t even need to:
          the ciphertext keeps English’s letter frequencies (just rotated), so a <strong>frequency attack</strong> reads the shift
          right off.
        </p>
        <label className="cla-field"><span>message</span><input value={text} onChange={(e) => { setText(e.target.value); setCracked(false); }} /></label>
        <label className="cla-slider">shift = {shift}<input type="range" min={0} max={25} value={shift} onChange={(e) => { setShift(Number(e.target.value)); setCracked(false); }} /></label>
        <div className="cla-map">{alpha.split('').map((c) => <span key={c} className="cla-pair"><b>{c}</b>→{caesar(c, shift)}</span>)}</div>
        <div className="cla-cipher">cipher: <code>{cipher}</code></div>
        <button className="cla-btn" onClick={() => setCracked(true)}>🔓 crack by frequency (no brute force)</button>
        {cracked && (
          <div className="cla-crack">
            χ² fit against English picks <strong>shift {crack.shift}</strong> → <code>{crack.plaintext}</code>{' '}
            {crack.shift === shift ? '✓ recovered' : ''}
          </div>
        )}
      </section>

      <section className="jsec">
        <div className="jsec-head"><h2>② The frequency fingerprint</h2></div>
        <p className="jsec-sub">
          Each bar is a letter’s share of the ciphertext (blue) next to its English frequency (grey). The cipher just <em>slides</em>{' '}
          the profile — the tall spike that should be E now sits on whatever E mapped to. That visible structure is the leak.
        </p>
        <div className="cla-bars">
          {alpha.split('').map((c) => (
            <div key={c} className="cla-bar">
              <div className="cla-bar-track">
                <div className="cla-bar-eng" style={{ height: `${(ENGLISH_FREQ[c] ?? 0) / maxF * 100}%` }} />
                <div className="cla-bar-cip" style={{ height: `${(freq[c] ?? 0) / maxF * 100}%` }} />
              </div>
              <span className="cla-bar-l">{c}</span>
            </div>
          ))}
        </div>
        <div className="cla-legend"><span className="cla-sw eng" /> English &nbsp; <span className="cla-sw cip" /> this ciphertext</div>
      </section>

      <section className="jsec">
        <div className="jsec-head"><h2>③ Vigenère — a repeating key delays, doesn’t defeat</h2></div>
        <p className="jsec-sub">
          Vigenère shifts letter i by key letter (i mod keylen), so the same plaintext letter encrypts differently — flattening the
          single-letter fingerprint. But the key <em>repeats</em>, so finding its length (Kasiski/index-of-coincidence) splits the
          text into Caesar slices you crack individually. Stronger, still broken.
        </p>
        <label className="cla-field"><span>key</span><input value={vkey} onChange={(e) => setVkey(e.target.value)} /></label>
        <div className="cla-cipher">plain : <code>{text.toUpperCase().replace(/[^A-Z ]/g, '')}</code></div>
        <div className="cla-cipher">cipher: <code>{vigenere(text, vkey)}</code></div>
        <p className="cla-foot">
          The lesson modern crypto took: a good cipher’s output must be statistically indistinguishable from random — no letter,
          digram, or positional pattern may survive. AES and ChaCha20 are engineered precisely so the fingerprint above is flat.
        </p>
      </section>
    </div>
  );
}
