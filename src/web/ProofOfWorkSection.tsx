// Proof of Work, made visible — grind a nonce until a real SHA-256 digest clears a
// zero-bit target. The work is genuine (NIST-verified SHA-256), so you feel the cost
// climb as difficulty rises, and anyone can verify the winning nonce in one hash.
// This is hashcash and the engine of Bitcoin mining. Model in pow.ts (tested).
import { useState } from 'react';
import { mine, expectedTries, type Mined } from './pow';
import { hex } from './sha256';

export function ProofOfWorkSection() {
  const [data, setData] = useState('Alice → Bob: 5 BTC');
  const [difficulty, setDifficulty] = useState(16);
  const [res, setRes] = useState<Mined | null>(null);
  const [ms, setMs] = useState(0);
  const [busy, setBusy] = useState(false);

  const cap = Math.min(40 * Math.pow(2, difficulty), 5_000_000); // the actual try cap mine() uses

  const mineNow = () => {
    setBusy(true);
    // let the button repaint as "mining…" before the synchronous grind
    setTimeout(() => {
      const t0 = performance.now();
      const r = mine(data, difficulty, cap);
      setMs(performance.now() - t0);
      setRes(r);
      setBusy(false);
    }, 20);
  };

  const h = res ? hex(res.hash) : '';
  const zeroHexChars = res ? Math.floor(res.zeroBits / 4) : 0;

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Proof of Work — make forgery expensive</h2></div>
        <p className="jsec-sub">
          A hash is one-way, so the only way to find an input whose digest starts with <strong>{difficulty} zero bits</strong> is to
          try, on average, <strong>2<sup>{difficulty}</sup> = {expectedTries(difficulty).toLocaleString()}</strong> of them. Grinding
          a <em>nonce</em> until it clears that target <em>is</em> the work — and any node re-checks it in a single hash.
        </p>

        <label className="po-field"><span>block data</span>
          <input value={data} onChange={(e) => { setData(e.target.value); setRes(null); }} /></label>
        <label className="po-slider">difficulty: <strong>{difficulty} leading zero bits</strong> <span className="po-exp">(≈ {expectedTries(difficulty).toLocaleString()} hashes)</span>
          <input type="range" min={8} max={22} value={difficulty} onChange={(e) => { setDifficulty(Number(e.target.value)); setRes(null); }} /></label>
        <button className="po-mine" onClick={mineNow} disabled={busy}>{busy ? '⛏ mining…' : '⛏ mine'}</button>

        {res && (
          <div className={`po-result ${res.found ? 'ok' : 'fail'}`}>
            {res.found ? (
              <>
                <div className="po-row"><span>nonce found</span><strong>{res.nonce.toLocaleString()}</strong></div>
                <div className="po-row"><span>hashes tried</span><strong>{res.tries.toLocaleString()}</strong> <span className="po-vs">(expected ≈ {expectedTries(difficulty).toLocaleString()})</span></div>
                <div className="po-row"><span>time</span><strong>{ms < 1000 ? `${ms.toFixed(0)} ms` : `${(ms / 1000).toFixed(1)} s`}</strong> · {(res.tries / (Math.max(ms, 0.001) / 1000) / 1000).toFixed(0)}k hash/s</div>
                <div className="po-hash">
                  SHA-256 = <code><span className="po-zeros">{h.slice(0, zeroHexChars)}</span>{h.slice(zeroHexChars)}</code>
                  <div className="po-zbits">{res.zeroBits} leading zero bits ✓ (target {difficulty})</div>
                </div>
              </>
            ) : <>no nonce under the {cap.toLocaleString()}-try cap — raise the cap or lower the difficulty.</>}
          </div>
        )}

        <p className="po-note">
          Each extra zero bit <strong>doubles</strong> the expected work — difficulty is how a blockchain targets a steady block
          time as total mining power changes. Because a block also hashes the previous block’s hash, rewriting an old block forces
          re-mining it <em>and every block after it</em> faster than the honest chain extends — which is why deep history is
          effectively immutable. (Bitcoin’s target is ~76 zero bits; we cap at {22} so your browser survives.)
        </p>
      </section>
    </div>
  );
}
