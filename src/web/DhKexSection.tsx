// Diffie–Hellman key agreement, made visible. Alice and Bob each pick a private exponent
// and publish g^private mod p; each raises the other's public value to its own private
// exponent and lands on the same secret g^ab — which never crossed the wire. Eve sees p,
// g, A, B and the whole exchange, yet to get the secret she must solve the discrete log;
// the "Eve cracks it" button brute-forces it to show that's only feasible here because
// the prime is tiny. Real BigInt modular exponentiation (dh.ts, tested).
import { useMemo, useState } from 'react';
import { dhExchange, dhBruteForce } from './dh';

const P = 23n, G = 5n;

export function DhKexSection() {
  const [a, setA] = useState(6);
  const [b, setB] = useState(15);
  const [cracked, setCracked] = useState(false);

  const r = useMemo(() => dhExchange(P, G, BigInt(a), BigInt(b)), [a, b]);
  const crack = useMemo(() => (cracked ? dhBruteForce(P, G, r.A) : null), [cracked, r.A]);

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Diffie–Hellman — a shared secret in the open</h2></div>
        <p className="jsec-sub">
          Alice and Bob have never met and share no secret, yet over a fully public channel they agree on one — and an eavesdropper
          who records every byte still can’t reproduce it. The trick is that <code>g<sup>a</sup></code> is easy to compute but
          un-inverting it (the discrete logarithm) is not. Public parameters: prime <code>p = {String(P)}</code>, generator
          <code> g = {String(G)}</code>.
        </p>

        <div className="dhk-grid">
          <div className="dhk-party alice">
            <h3>👩 Alice</h3>
            <label>private a <input type="range" min={2} max={21} value={a} onChange={(e) => setA(+e.target.value)} /><b>{a}</b></label>
            <div className="dhk-calc">A = g<sup>a</sup> mod p = {String(G)}<sup>{a}</sup> mod {String(P)} = <b>{String(r.A)}</b></div>
            <div className="dhk-send">sends A = {String(r.A)} →</div>
            <div className="dhk-secret">secret = B<sup>a</sup> = {String(r.B)}<sup>{a}</sup> mod {String(P)} = <b>{String(r.sharedAlice)}</b></div>
          </div>

          <div className="dhk-wire">
            <div className="dhk-eye">👁️ Eve sees:</div>
            <div className="dhk-seen">p={String(P)} · g={String(G)} · A={String(r.A)} · B={String(r.B)}</div>
            <div className="dhk-seen dim">a, b, secret — never sent</div>
          </div>

          <div className="dhk-party bob">
            <h3>🧑 Bob</h3>
            <label>private b <input type="range" min={2} max={21} value={b} onChange={(e) => setB(+e.target.value)} /><b>{b}</b></label>
            <div className="dhk-calc">B = g<sup>b</sup> mod p = {String(G)}<sup>{b}</sup> mod {String(P)} = <b>{String(r.B)}</b></div>
            <div className="dhk-send">← sends B = {String(r.B)}</div>
            <div className="dhk-secret">secret = A<sup>b</sup> = {String(r.A)}<sup>{b}</sup> mod {String(P)} = <b>{String(r.sharedBob)}</b></div>
          </div>
        </div>

        <div className={`dhk-agree ${r.agree ? 'ok' : 'bad'}`}>
          {r.agree
            ? <>🔑 Both computed the <b>same</b> shared secret <b>{String(r.sharedAlice)}</b> = g<sup>ab</sup> mod p — without ever transmitting it.</>
            : <>secrets differ (shouldn’t happen for valid DH)</>}
        </div>

        <div className="dhk-eve">
          <button onClick={() => setCracked((c) => !c)}>{cracked ? 'hide' : '👁️ Eve tries to crack it'}</button>
          {crack && (
            <div className="dhk-crackout">
              Eve brute-forces the discrete log of A={String(r.A)}: tried {crack.tries} exponents → recovered a = <b>{String(crack.priv)}</b>,
              then computes B<sup>a</sup> = {String(r.sharedAlice)}. <strong>With p={String(P)} that took {crack.tries} steps.</strong> Real
              DH uses a 2048-bit prime (or a 256-bit elliptic curve), where this search is ~2<sup>128</sup> steps — utterly infeasible.
            </div>
          )}
        </div>

        <p className="dhk-foot">
          This single mechanism underlies the forward secrecy in TLS 1.3, the SSH and WireGuard handshakes, and the Signal ratchet:
          every session does a fresh ephemeral DH so that even if a long-term key leaks later, past traffic stays secret. Its weakness
          is authentication — raw DH can be man-in-the-middled (see the DH-MITM section), which is why the public values are signed.
        </p>
      </section>
    </div>
  );
}
