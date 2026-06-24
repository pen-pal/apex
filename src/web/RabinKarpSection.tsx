// Rabin-Karp, made visible. Step a window across the text; its rolling hash updates in
// O(1) each slide, and where it equals the pattern hash the window flashes — then a full
// character check confirms a real match or marks a hash collision. Real rolling hash in
// rabinkarp.ts (tested).
import { useMemo, useState } from 'react';
import { search, windowHash } from './rabinkarp';

export function RabinKarpSection() {
  const [text, setText] = useState('abracadabra');
  const [pat, setPat] = useState('abra');
  const res = useMemo(() => search(text, pat), [text, pat]);
  const patHash = useMemo(() => windowHash(pat), [pat]);
  const [step, setStep] = useState(1e9);

  const s = Math.min(step, res.steps.length);
  const cur = s > 0 ? res.steps[s - 1] : null;
  const m = pat.length;
  const found = res.matches.filter((mi) => cur && mi <= cur.start);

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Rabin-Karp — match by hash, slide in O(1)</h2></div>
        <p className="jsec-sub">
          Instead of comparing characters, Rabin-Karp compares a <strong>hash</strong> of the window against the pattern’s hash. The
          window is a base-256 number mod a big prime; when it slides one step, the hash updates in constant time — drop the leaving
          character’s weight, multiply by the base, add the entering character. Only when the hashes match does it do a full character
          check (to rule out a collision).
        </p>

        <div className="rk-io">
          <label>text <input value={text} onChange={(e) => { setText(e.target.value); setStep(1e9); }} spellCheck={false} /></label>
          <label>pattern <input value={pat} onChange={(e) => { setPat(e.target.value); setStep(1e9); }} spellCheck={false} /></label>
        </div>
        <div className="rk-pathash">pattern hash = <code>{patHash}</code></div>

        <div className="rk-controls">
          <button onClick={() => setStep(0)} disabled={s === 0}>⏮</button>
          <button onClick={() => setStep(Math.max(0, s - 1))} disabled={s === 0}>◀</button>
          <span className="rk-count">window {s} / {res.steps.length}</span>
          <button onClick={() => setStep(s + 1)} disabled={s >= res.steps.length}>▶</button>
          <button onClick={() => setStep(res.steps.length)} disabled={s >= res.steps.length}>⏭</button>
        </div>

        <div className="rk-tape">
          {[...text].map((ch, i) => {
            const inWindow = cur && i >= cur.start && i < cur.start + m;
            const isMatch = found.some((mi) => i >= mi && i < mi + m);
            return <span key={i} className={`rk-cell ${inWindow ? (cur!.hashMatch ? (cur!.verified ? 'hit' : 'collide') : 'win') : ''} ${isMatch ? 'matched' : ''}`}>{ch}</span>;
          })}
        </div>

        {cur && (
          <div className={`rk-msg ${cur.hashMatch ? (cur.verified ? 'ok' : 'bad') : ''}`}>
            window hash <code>{cur.windowHash}</code> {cur.hashMatch ? '=' : '≠'} pattern hash{' '}
            {cur.hashMatch ? (cur.verified ? '→ ✓ verified match at ' + cur.start : '→ ✗ hash collision, characters differ') : '→ slide on'}
          </div>
        )}

        <div className="rk-stats">
          <span>matches: <b>{res.matches.length ? res.matches.join(', ') : 'none'}</b></span>
          <span>hash hits: <b>{res.hashHits}</b></span>
          <span>collisions caught: <b>{res.falsePositives}</b></span>
        </div>

        <p className="rk-foot">
          With a good hash, real matches dominate and the whole search is O(n+m) on average — but a crafted input causing constant
          collisions degrades it to O(n·m), which is why the prime and base matter. The real power is the rolling hash itself: it’s how
          <strong> rsync</strong> finds which blocks of a file changed, how content-defined chunking dedups backups, and how you can scan
          for thousands of patterns at once (hash them all into a set and check each window’s hash). It’s also a cousin of the polynomial
          hashing behind many hash tables.
        </p>
      </section>
    </div>
  );
}
