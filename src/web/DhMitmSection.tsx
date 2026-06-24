// Active man-in-the-middle on Diffie–Hellman. Slide the private keys and toggle Eve
// from a passive eavesdropper (harmless) to an active attacker who rewrites the
// public values — then she shares a separate key with each side and relays in the
// clear. Turn on authentication (sign the public value) and her substitution is
// caught. Real DH from dhmitm.ts (tested); p=23, g=5.
import { useState } from 'react';
import { exchange, P, G } from './dhmitm';

export function DhMitmSection() {
  const [a, setA] = useState(6);
  const [b, setB] = useState(15);
  const [e, setE] = useState(3);
  const [mitm, setMitm] = useState(false);
  const [auth, setAuth] = useState(false);
  const r = exchange(a, b, { mitm, eve: e, authenticated: auth });

  const verdict = r.detected ? 'detected' : r.compromised ? 'compromised' : 'secure';
  const VTXT = {
    secure: mitm ? '🔒 Passive Eve sees A, B and the modulus but can’t derive the key — discrete log is hard. Alice and Bob share the same secret.' : '🔒 Secure — Alice and Bob derive the same shared secret over the open wire; an eavesdropper can’t compute it.',
    compromised: '☠️ Compromised — Eve substituted her own public value to each side, so she shares one key with Alice and a different one with Bob. She decrypts, reads, re-encrypts, and relays. Neither side can tell.',
    detected: '🛡️ Detected — the public values are signed, so Eve’s substitution fails verification and the handshake aborts. This is what certificates / signed key shares buy you (TLS signs the ephemeral DH).',
  } as const;

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Active MITM on Diffie–Hellman</h2></div>
        <p className="jsec-sub">
          DH derives a shared secret over an open wire, and a <em>passive</em> eavesdropper is stuck — she’d need the discrete log.
          But raw DH authenticates <strong>nothing</strong>, so an <em>active</em> attacker who can rewrite packets just runs DH with
          each side separately and sits in the middle. The cure is to <strong>authenticate the public values</strong>.
        </p>

        <div className="dh-controls">
          <label>Alice a = {a}<input type="range" min={2} max={21} value={a} onChange={(ev) => setA(Number(ev.target.value))} /></label>
          <label>Bob b = {b}<input type="range" min={2} max={21} value={b} onChange={(ev) => setB(Number(ev.target.value))} /></label>
          {mitm && <label>Eve e = {e}<input type="range" min={2} max={21} value={e} onChange={(ev) => setE(Number(ev.target.value))} /></label>}
        </div>
        <div className="dh-toggles">
          <label className="dh-toggle"><input type="checkbox" checked={mitm} onChange={(ev) => setMitm(ev.target.checked)} /> Eve actively intercepts (MITM)</label>
          <label className={`dh-toggle ${!mitm ? 'off' : ''}`}><input type="checkbox" checked={auth} disabled={!mitm} onChange={(ev) => setAuth(ev.target.checked)} /> authenticate (sign the public values)</label>
        </div>

        <div className="dh-wire">
          <div className="dh-party alice">
            <div className="dh-p-h">Alice</div>
            <div className="dh-p-priv">a = {a}</div>
            <div className="dh-p-pub">A = gᵃ = {r.A}</div>
            <div className={`dh-p-key ${r.compromised ? 'bad' : 'ok'}`}>key {r.detected ? '— aborted' : r.aliceKey}</div>
          </div>

          {mitm ? (
            <div className="dh-eve">
              <div className="dh-arrows"><span>A→ {r.detected ? '✗' : `E=${r.eve!.pub}`} →</span><span>← {r.detected ? '✗' : `E=${r.eve!.pub}`} ←B</span></div>
              <div className={`dh-e-box ${r.detected ? 'caught' : 'active'}`}>
                <div className="dh-e-h">{r.detected ? '🛡️ Eve blocked' : '😈 Eve (MITM)'}</div>
                {!r.detected && <div className="dh-e-keys">↔Alice: {r.eve!.keyWithAlice} · ↔Bob: {r.eve!.keyWithBob}</div>}
              </div>
            </div>
          ) : (
            <div className="dh-mid"><span>A → · ← B</span><div className="dh-eaves">👁 passive Eve: sees {r.A}, {r.B}, p={Number(P)} — but not the key</div></div>
          )}

          <div className="dh-party bob">
            <div className="dh-p-h">Bob</div>
            <div className="dh-p-priv">b = {b}</div>
            <div className="dh-p-pub">B = gᵇ = {r.B}</div>
            <div className={`dh-p-key ${r.compromised ? 'bad' : 'ok'}`}>key {r.detected ? '— aborted' : r.bobKey}</div>
          </div>
        </div>

        <div className="dh-shared">
          {!r.detected && (r.agree
            ? <>Alice and Bob hold the <strong>same</strong> key ({r.aliceKey}){mitm ? '' : ' — exactly what DH promises'}.</>
            : <>Alice’s key (<strong>{r.aliceKey}</strong>) ≠ Bob’s key (<strong>{r.bobKey}</strong>) — they’re each talking to <strong>Eve</strong>, not each other.</>)}
        </div>
        <div className={`dh-verdict ${verdict}`}>{VTXT[verdict]}</div>

        <p className="dh-note">
          This is why unauthenticated key exchange is never enough. TLS signs the server’s ephemeral DH/ECDH public key with the
          certificate’s private key (<span className="dh-link">verified in the cert-chain section</span>), so a substituted key
          share fails the signature and the connection dies — turning silent interception into a visible error. With p = {Number(P)},
          g = {Number(G)} the numbers are tiny on purpose; real DH uses 2048-bit (or 256-bit elliptic-curve) values.
        </p>
      </section>
    </div>
  );
}
