// Broken hashes & the birthday bound, made visible. SHA-1 still computes (real, from
// scratch) but it's dead — two PDFs share a SHA-1. The family table shows how far
// cryptanalysis pushed MD5/SHA-1 below even the birthday bound, and the birthday panel
// shows why a hash's collision resistance is only HALF its bits. Honest, sourced
// facts; no live collision (that took thousands of CPU-years). Model: sha1.ts +
// hashfamily.ts (tested to the NIST vectors).
import { useState } from 'react';
import { sha1 } from './sha1';
import { HASHES, birthday50, type HashAlg } from './hashfamily';

const toHex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
const pow2 = (x: number) => (x >= 100 ? `2^${x} ≈ 10^${Math.round(x * 0.301)}` : `2^${x}`);
const human = (n: number) => (n >= 1e15 ? n.toExponential(1) : Math.round(n).toLocaleString());

export function HashCollisionSection() {
  const [msg, setMsg] = useState('hello');
  const [bits, setBits] = useState(64);

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>① SHA-1 still runs — and is broken</h2></div>
        <p className="jsec-sub">
          SHA-1 computes fine; that was never the problem. The problem is <strong>collisions</strong>: in 2017 Google’s SHAttered
          attack produced two different PDFs with the <em>same</em> SHA-1, and by 2020 chosen-prefix collisions were practical. Any
          signature, certificate, or git tree that trusts SHA-1 for integrity is forgeable.
        </p>
        <label className="hc-field"><span>SHA-1 of</span><input value={msg} onChange={(e) => setMsg(e.target.value)} /></label>
        <div className="hc-digest">sha1 = <code>{toHex(sha1(new TextEncoder().encode(msg)))}</code></div>
        <div className="hc-shattered">📄 <strong>shattered-1.pdf</strong> and <strong>shattered-2.pdf</strong> — different files, both SHA-1 <code>38762cf7f55934b34d179ae6a4c80cadccbb7f0a</code></div>
      </section>

      <section className="jsec">
        <div className="jsec-head"><h2>② The hash family</h2></div>
        <table className="hc-table">
          <thead><tr><th>hash</th><th>bits</th><th>ideal (2^n/2)</th><th>best attack</th><th>status</th></tr></thead>
          <tbody>
            {HASHES.map((h: HashAlg) => (
              <tr key={h.name} className={h.status}>
                <td>{h.name}</td>
                <td>{h.bits}</td>
                <td>{pow2(h.idealCollisionBits)}</td>
                <td>{pow2(h.bestAttackBits)}</td>
                <td><span className={`hc-badge ${h.status}`}>{h.status === 'broken' ? '☠ broken' : '🔒 safe'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="hc-events">
          {HASHES.map((h) => <div key={h.name} className="hc-event"><strong>{h.name}:</strong> {h.event}</div>)}
        </div>
      </section>

      <section className="jsec">
        <div className="jsec-head"><h2>③ The birthday bound — half the bits</h2></div>
        <p className="jsec-sub">
          You don’t need 2^n tries to find a collision, only about <strong>2^(n/2)</strong> — the birthday paradox. That’s why a
          128-bit hash gives only 64-bit collision resistance, and why “160-bit” SHA-1 was always really an 80-bit target (then
          cryptanalysis cut it to ~63).
        </p>
        <div className="hc-bd-tabs">
          {[32, 64, 128, 160, 256].map((b) => <button key={b} className={bits === b ? 'on' : ''} onClick={() => setBits(b)}>{b}-bit</button>)}
        </div>
        <div className="hc-bd">
          A {bits}-bit hash: brute-force preimage = <code>{pow2(bits)}</code>, but a <strong>collision</strong> needs only{' '}
          <code>≈ {human(birthday50(bits))}</code> = <code>{pow2(bits / 2)}</code> hashes for a coin-flip chance.
        </div>
        <p className="hc-foot">
          The takeaway: pick a hash with <em>twice</em> the collision resistance you need, and never use MD5 or SHA-1 where an
          adversary controls the input. Git is migrating to SHA-256 for exactly this reason; TLS and code-signing dropped SHA-1
          years ago.
        </p>
      </section>
    </div>
  );
}
