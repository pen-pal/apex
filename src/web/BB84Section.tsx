// BB84, made visible. Alice sends random bits in random bases; Bob measures in random
// bases; they keep the positions where the bases matched (sifting) and get a shared
// key — secured by physics. Toggle the eavesdropper and watch her measurements inject
// errors into the sifted key, exposing her. Real protocol logic (bb84.ts, tested);
// the quantum coin flips use the browser RNG.
import { useMemo, useState } from 'react';
import { run, type Basis, type Bit } from './bb84';

const N = 12;
const rb = (): Bit => (Math.random() < 0.5 ? 0 : 1);
const rbasis = (): Basis => (Math.random() < 0.5 ? '+' : 'x');
const glyph = (bit: Bit, b: Basis) => (b === '+' ? (bit ? '↑' : '→') : (bit ? '↘' : '↗'));

export function BB84Section() {
  const [seed, setSeed] = useState(0);
  const [eve, setEve] = useState(false);

  const gen = useMemo(() => ({
    aBits: Array.from({ length: N }, rb), aBases: Array.from({ length: N }, rbasis),
    bBases: Array.from({ length: N }, rbasis), coins: Array.from({ length: N }, () => Math.random()),
    eBases: Array.from({ length: N }, rbasis), eCoins: Array.from({ length: N }, () => Math.random()),
  }), [seed]);

  const r = run(gen.aBits, gen.aBases, gen.bBases, gen.coins, eve ? { eBases: gen.eBases, eCoins: gen.eCoins } : undefined);
  const ratePct = Math.round(r.errorRate * 100);

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>BB84 — a key secured by physics</h2></div>
        <p className="jsec-sub">
          Alice encodes each random bit in a random basis (rectilinear <strong>+</strong> or diagonal <strong>×</strong>). Bob
          measures in his own random basis — a match reads the bit, a mismatch is a quantum coin flip. They publicly compare bases and
          keep the matches: that’s the shared key. Measuring disturbs a qubit, so an eavesdropper can’t copy it without leaving traces.
        </p>
        <div className="qkd-controls">
          <button onClick={() => setSeed((s) => s + 1)}>↻ new run</button>
          <label className="qkd-eve"><input type="checkbox" checked={eve} onChange={(e) => setEve(e.target.checked)} /> 🕵️ eavesdropper (Eve)</label>
        </div>

        <div className="qkd-table">
          <div className="qkd-rowlabels">
            <span>Alice bit</span><span>Alice qubit</span>{eve && <span>Eve basis</span>}<span>Bob basis</span><span>Bob bit</span><span>kept?</span>
          </div>
          <div className="qkd-cols">
            {r.steps.map((s, i) => (
              <div key={i} className={`qkd-col ${s.kept ? 'kept' : ''} ${s.error ? 'err' : ''}`}>
                <span className="qkd-bit">{s.bit}</span>
                <span className="qkd-glyph">{glyph(s.bit, s.aBasis)}</span>
                {eve && <span className="qkd-basis">{s.eBasis}</span>}
                <span className="qkd-basis">{s.bBasis}</span>
                <span className="qkd-bit">{s.bobBit}</span>
                <span className="qkd-keep">{s.kept ? (s.error ? '⚠' : '✓') : '·'}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="qkd-key">
          <div>Alice’s sifted key: <code>{r.aliceKey.join('')}</code></div>
          <div>Bob’s sifted key:&nbsp;&nbsp; <code>{r.bobKey.join('')}</code></div>
        </div>

        <div className={`qkd-verdict ${r.errors === 0 ? 'ok' : 'bad'}`}>
          sifted {r.sifted} bits · <strong>{r.errors}</strong> mismatches · error rate <strong>{ratePct}%</strong> —{' '}
          {r.errors === 0
            ? 'keys agree, no eavesdropper. Safe to use (after error-correction + privacy amplification).'
            : `keys disagree! An eavesdropper measuring in the wrong basis injects ~25% errors. They abort and try again — the leak is detected before any secret is used.`}
        </div>
        <p className="qkd-foot">
          No computation breaks this — it rests on the no-cloning theorem and measurement collapse. They sacrifice a random subset of
          sifted bits to estimate the error rate; a low rate means privacy amplification can distil a key Eve knows nothing about.
          BB84 runs today over fibre and satellite (the Micius experiments).
        </p>
      </section>
    </div>
  );
}
