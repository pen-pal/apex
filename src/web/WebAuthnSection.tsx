// WebAuthn passkeys, made visible. Register a passkey (the device keeps the private key,
// the server stores the public key), then try to log in — on the real site it works, on a
// pixel-perfect phishing site it fails, because the authenticator signs the ORIGIN it is
// actually visiting and the real server only accepts its own. Real signatures via the toy
// EdDSA; logic in webauthn.ts (tested).
import { useMemo, useState } from 'react';
import { register, authenticate, verifyAssertion } from './webauthn';

const SECRET = 7;
const REAL = 'https://bank.example';
const PHISH = 'https://bank-secure.evil';

const pt = (P: { x: number; y: number } | null) => (P ? `(${P.x},${P.y})` : 'O');

export function WebAuthnSection() {
  const cred = useMemo(() => register(SECRET, REAL), []);
  const [visiting, setVisiting] = useState<string>(REAL);
  const challenge = 'srv-challenge-7f3a';

  const assertion = useMemo(() => authenticate(SECRET, challenge, visiting), [visiting]);
  const verdict = useMemo(() => verifyAssertion(cred, challenge, REAL, assertion), [cred, assertion]);

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Passkeys (WebAuthn) — login that can’t be phished</h2></div>
        <p className="jsec-sub">
          A passkey is a key pair. At registration your device keeps the <strong>private</strong> key and the server stores only the
          <strong> public</strong> one — there’s no shared secret to steal, phish, or leak in a breach. To log in, the server sends a
          random challenge and your device signs it. The trick that beats phishing: it signs the <em>origin it’s actually talking to</em>.
        </p>

        <div className="wan-reg">
          <span className="wan-reg-icon">🔐</span>
          <div>
            <div className="wan-reg-title">Registered passkey for <code>{REAL}</code></div>
            <div className="wan-reg-detail">device keeps private key · server stored public key <code>{pt(cred.publicKey)}</code></div>
          </div>
        </div>

        <div className="wan-pick">
          <span>You click “log in” while on:</span>
          <button className={visiting === REAL ? 'on' : ''} onClick={() => setVisiting(REAL)}>✅ {REAL}</button>
          <button className={visiting === PHISH ? 'on phish' : 'phish'} onClick={() => setVisiting(PHISH)}>🎣 {PHISH}</button>
        </div>

        <div className="wan-flow">
          <div className="wan-step"><b>1 · challenge</b><span>server sends random <code>{challenge}</code></span></div>
          <div className="wan-step"><b>2 · sign</b><span>authenticator signs (challenge ‖ <code>{visiting}</code>) — the origin it sees</span></div>
          <div className="wan-step"><b>3 · verify</b><span>server checks the signature <em>and</em> that the signed origin is <code>{REAL}</code></span></div>
        </div>

        <div className="wan-checks">
          <div className={`wan-check ${verdict.signatureOk ? 'ok' : 'bad'}`}>{verdict.signatureOk ? '✓' : '✗'} signature valid</div>
          <div className={`wan-check ${verdict.originOk ? 'ok' : 'bad'}`}>{verdict.originOk ? '✓' : '✗'} origin matches ({assertion.signedOrigin === REAL ? REAL : assertion.signedOrigin})</div>
        </div>

        <div className={`wan-verdict ${verdict.accepted ? 'ok' : 'bad'}`}>
          {verdict.accepted
            ? '✅ Authenticated — you are logged in.'
            : visiting === PHISH
              ? '⛔ Login rejected. The phishing site relayed a real challenge, and your device even produced a valid signature — but it signed “bank-secure.evil”, so the real bank refuses it. The attacker gets nothing reusable.'
              : '⛔ Rejected.'}
        </div>

        <p className="wan-foot">
          Compare with a password: on a phishing page you’d happily type it and the attacker would replay it. A passkey can’t be replayed
          (each challenge is fresh and signed) and can’t be misdirected (the origin is part of what’s signed, enforced by the browser,
          not the user’s judgement). Real WebAuthn adds an attestation at registration, a user-presence/verification check (biometric or
          PIN), and a signature counter to detect cloned authenticators — but this origin-bound challenge-response is the heart of it.
        </p>
      </section>
    </div>
  );
}
