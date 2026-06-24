// EdDSA, made visible. Pick a secret and a message and watch the signature built: a
// deterministic nonce r = H(secret, message), R = rG, challenge e, and s = r + e·secret.
// Verification checks sG == R + eA. The key demo: signing the same message twice gives
// the identical signature (no RNG), and two different messages get two different nonces —
// so the catastrophic ECDSA nonce-reuse key recovery cannot happen by construction. Real
// toy-curve math (ecc.ts) + SHA-256 (eddsa.ts, tested).
import { useMemo, useState } from 'react';
import { sign, verify, publicKey } from './eddsa';
import { type Pt } from './ecc';

const pt = (P: Pt) => (P ? `(${P.x}, ${P.y})` : 'O');

export function EdDsaSection() {
  const [secret, setSecret] = useState(7);
  const [msg, setMsg] = useState(42);
  const [msg2, setMsg2] = useState(99);

  const A = useMemo(() => publicKey(secret), [secret]);
  const sig = useMemo(() => sign(secret, msg), [secret, msg]);
  const ok = useMemo(() => verify(A, msg, sig), [A, msg, sig]);
  const sigAgain = useMemo(() => sign(secret, msg), [secret, msg]);
  const sig2 = useMemo(() => sign(secret, msg2), [secret, msg2]);

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>EdDSA — a signature with a deterministic nonce</h2></div>
        <p className="jsec-sub">
          EdDSA signs like Schnorr but derives its per-signature nonce <em>from the secret and the message</em> instead of drawing it
          at random. That one design choice removes the single most dangerous footgun in elliptic-curve signing — nonce reuse — and
          deletes the RNG you’d otherwise have to trust. (Toy curve y²=x³+2x+2 mod 17, order 19.)
        </p>

        <div className="eds-io">
          <label>secret a <input type="range" min={1} max={18} value={secret} onChange={(e) => setSecret(+e.target.value)} /><b>{secret}</b></label>
          <label>message m <input type="number" value={msg} onChange={(e) => setMsg(+e.target.value || 0)} /></label>
        </div>

        <div className="eds-steps">
          <div className="eds-step"><span>public key</span><code>A = a·G = {pt(A)}</code></div>
          <div className="eds-step"><span>nonce (deterministic)</span><code>r = H(a, m) = {sig.r}</code></div>
          <div className="eds-step"><span>commitment</span><code>R = r·G = {pt(sig.R)}</code></div>
          <div className="eds-step"><span>challenge</span><code>e = H(R, A, m) = {sig.e}</code></div>
          <div className="eds-step"><span>signature scalar</span><code>s = r + e·a = {sig.s}</code></div>
        </div>

        <div className="eds-sig">signature = (R={pt(sig.R)}, s={sig.s})</div>
        <div className={`eds-verify ${ok ? 'ok' : 'bad'}`}>
          verify: s·G {ok ? '=' : '≠'} R + e·A → {ok ? '✓ valid' : '✗ invalid'}
        </div>

        <div className="eds-demo">
          <h3>Why deterministic nonces are safe</h3>
          <div className="eds-demo-row good">
            <span>sign m={msg} again →</span>
            <code>(R={pt(sigAgain.R)}, s={sigAgain.s})</code>
            <em>{sigAgain.r === sig.r && sigAgain.s === sig.s ? 'identical — no randomness involved' : 'differs'}</em>
          </div>
          <div className="eds-demo-row">
            <span>sign a different m=<input type="number" value={msg2} onChange={(e) => setMsg2(+e.target.value || 0)} /> →</span>
            <code>nonce r = {sig2.r}</code>
            <em className={sig2.r !== sig.r ? 'diff' : 'same'}>{sig2.r !== sig.r ? `different nonce (was ${sig.r}) ✓` : 'same nonce (rare toy-curve collision)'}</em>
          </div>
          <p className="eds-note">
            Because the nonce is a function of the message, two <em>different</em> messages get two <em>different</em> nonces. In ECDSA,
            reusing one random nonce across two messages lets anyone solve <code>s₁,s₂</code> for the private key (see the ECDSA
            section’s nonce-reuse break). EdDSA makes that mistake impossible to commit.
          </p>
        </div>

        <p className="eds-foot">
          Real Ed25519 uses the twisted-Edwards curve edwards25519 with SHA-512 and a 256-bit key, but the structure is exactly this:
          deterministic nonce, R = rB, s = r + H(R,A,M)·a, verify sB = R + H(R,A,M)·A. It’s fast, has small keys and signatures, and is
          resistant to many side-channels — which is why it backs modern SSH, TLS 1.3 certificates, and signing systems like Signal and
          age.
        </p>
      </section>
    </div>
  );
}
