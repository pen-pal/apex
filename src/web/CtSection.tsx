// Timing side channels, made visible. A secret token is checked two ways: a naive early-exit
// compare (returns the instant it finds a wrong byte) and a constant-time compare (always touches
// every byte). Type a guess and watch the naive comparator's "time" grow with the matching prefix —
// that growth is the leak. Then launch the byte-by-byte attack and watch it walk the secret out of
// the leaky comparator in a few hundred probes, while the constant-time one gives it nothing.
import { useMemo, useState } from 'react';
import { naiveEqual, constantTimeEqual, timingAttack, ALPHABET } from './consttime';

const SECRET = 'a1c0n8';

export function CtSection() {
  const [guess, setGuess] = useState('a1xxxx');
  const [target, setTarget] = useState<'naive' | 'ct'>('naive');

  const nv = naiveEqual(SECRET, guess);
  const ct = constantTimeEqual(SECRET, guess);
  const prefix = (() => { let i = 0; while (i < Math.min(SECRET.length, guess.length) && SECRET[i] === guess[i]) i++; return i; })();

  const attack = useMemo(() => timingAttack(SECRET, target === 'naive' ? naiveEqual : constantTimeEqual), [target]);
  const bruteForce = ALPHABET.length ** SECRET.length;

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Timing attacks — why <code>==</code> leaks your secrets</h2></div>
        <p className="jsec-sub">
          Comparing a secret (an API token, an HMAC, a reset code) with an ordinary equality check is a real vulnerability. A naive compare
          returns the moment it hits a wrong byte, so <strong>how long it runs reveals how many leading bytes were right</strong>. Measure that,
          and you recover the secret one byte at a time — turning an impossible 36⁶ guess into a trivial 36×6.
        </p>

        <div className="ct-secret">secret token: <span className="ct-tok">{SECRET.split('').map((c, i) => <b key={i}>{c}</b>)}</span> <span className="ct-secretnote">(shown for teaching; the attacker can’t see it)</span></div>

        <div className="ct-probe">
          <label>your guess <input value={guess} maxLength={SECRET.length} onChange={(e) => setGuess(e.target.value.toLowerCase())} spellCheck={false} /></label>
          <div className="ct-guessview">
            {guess.split('').map((c, i) => <span key={i} className={`ct-gc ${i < prefix ? 'ok' : i === prefix ? 'bad' : ''}`}>{c}</span>)}
          </div>
        </div>
        <div className="ct-bars">
          <div className="ct-barrow">
            <span className="ct-blbl">naive <code>==</code></span>
            <div className="ct-track"><div className="ct-fill leak" style={{ width: `${(nv.examined / SECRET.length) * 100}%` }} /></div>
            <span className="ct-bnum">{nv.examined} bytes “time”</span>
          </div>
          <div className="ct-barrow">
            <span className="ct-blbl">constant-time</span>
            <div className="ct-track"><div className="ct-fill safe" style={{ width: `${(ct.examined / SECRET.length) * 100}%` }} /></div>
            <span className="ct-bnum">{ct.examined} bytes “time”</span>
          </div>
        </div>
        <p className="ct-probenote">
          The naive bar grows with your matching prefix (<b>{prefix}</b> byte{prefix === 1 ? '' : 's'} correct) — that’s the side channel. The
          constant-time bar is always <b>{SECRET.length}</b>, whether you got 0 or 5 bytes right. {nv.equal ? '🎉 exact match!' : ''}
        </p>

        <div className="ct-attackhdr">
          <h3>The byte-by-byte attack</h3>
          <div className="ct-target">
            target: <button className={target === 'naive' ? 'on' : ''} onClick={() => setTarget('naive')}>naive (leaky)</button>
            <button className={target === 'ct' ? 'on' : ''} onClick={() => setTarget('ct')}>constant-time</button>
          </div>
        </div>
        <div className={`ct-result ${attack.success ? 'cracked' : 'safe'}`}>
          <div className="ct-recovered">
            recovered: {attack.recovered.split('').map((c, i) => <span key={i} className={`ct-rc ${attack.recovered[i] === SECRET[i] ? 'hit' : 'miss'}`}>{c}</span>)}
            <span className="ct-verdict">{attack.success ? '✗ SECRET CRACKED' : '✓ attack failed — no leak'}</span>
          </div>
          <div className="ct-cost">
            <span><b>{attack.probes}</b> probes used</span>
            <span>vs <b>{bruteForce.toLocaleString()}</b> for blind brute force</span>
            <span className="ct-ratio">{target === 'naive' ? `≈ ${(bruteForce / attack.probes).toExponential(1)}× cheaper` : 'the leak is the only thing that made it cheap'}</span>
          </div>
        </div>

        <p className="ct-foot">
          The fix is one line — compare with a constant-time routine (<code>crypto.timingSafeEqual</code>, <code>hmac.compare_digest</code>,
          <code>sodium_memcmp</code>) that ORs every byte’s difference and never short-circuits. Real attacks measure nanosecond differences
          over many samples to beat the noise, and the same discipline extends to avoiding secret-dependent branches, table lookups, and
          divisions — the reason crypto libraries are written in a “constant-time” style throughout. Lucky Thirteen, and the original remote
          timing attacks on RSA and OpenSSL, all rode exactly this kind of data-dependent timing.
        </p>
      </section>
    </div>
  );
}
