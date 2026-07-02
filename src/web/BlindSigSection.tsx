// RSA blind signatures, made visible. The client blinds its message with a random factor before sending
// it to the signer, so the signer's view is uniformly random — it signs without ever seeing the message.
// The client divides the blinding back out and is left with an ordinary RSA signature that verifies
// under the public key, yet can't be linked to the signing session. Watch the message stay hidden from
// the signer while the final signature still checks out. Real toy-RSA math from blindsig.ts.
import { useMemo, useState } from 'react';
import { blind, signBlinded, unblind, verify, signDirect, modpow, N, E, D } from './blindsig';

export function BlindSigSection() {
  const [m, setM] = useState(100);
  const [r, setR] = useState(7);

  const ok = useMemo(() => { const g = (x: number, y: number): number => (y === 0 ? x : g(y, x % y)); return g(r, N) === 1; }, [r]);
  const blinded = useMemo(() => (ok ? blind(m, r) : 0), [m, r, ok]);
  const sPrime = useMemo(() => signBlinded(blinded), [blinded]);
  const sig = useMemo(() => (ok ? unblind(sPrime, r) : 0), [sPrime, r, ok]);
  const valid = ok && verify(sig, m);
  const matchesDirect = ok && sig === signDirect(m);

  return (
    <div className="bsig">
      <div className="bsig-key">public key (n={N}, e={E}) — anyone can verify · private key (d={D}) — only the signer</div>
      <div className="bsig-inputs">
        <label>message m <input type="number" min={1} max={N - 1} value={m} onChange={(e) => setM(Math.max(1, Math.min(N - 1, +e.target.value)))} /></label>
        <label>blinding r <input type="number" min={2} max={N - 1} value={r} onChange={(e) => setR(Math.max(2, Math.min(N - 1, +e.target.value)))} /></label>
        {!ok && <span className="bsig-bad">r must be coprime to n — pick another</span>}
      </div>

      <div className="bsig-flow">
        <div className="bsig-actor client">
          <div className="bsig-actor-h">👩 Client</div>
          <div className="bsig-op">blind: m · r<sup>e</sup> mod n</div>
          <div className="bsig-val">= <b>{blinded}</b></div>
        </div>
        <div className="bsig-wire">
          <span className="bsig-send">send blinded → {blinded}</span>
          <span className="bsig-recv">← signed {sPrime}</span>
        </div>
        <div className="bsig-actor signer">
          <div className="bsig-actor-h">🏦 Signer</div>
          <div className="bsig-op">sign blindly: (blinded)<sup>d</sup></div>
          <div className="bsig-val">= <b>{sPrime}</b></div>
          <div className="bsig-blindnote">never sees m — only the random-looking {blinded}</div>
        </div>
      </div>

      <div className="bsig-unblind">
        <div className="bsig-actor client wide">
          <span className="bsig-op">unblind: s′ · r<sup>−1</sup> mod n = <b className="bsig-sig">{sig}</b></span>
          <span className="bsig-note">this is m<sup>d</sup> mod n — a normal signature on m {matchesDirect ? '(identical to signing m directly ✓)' : ''}</span>
        </div>
      </div>

      <div className={`bsig-verify ${valid ? 'ok' : 'bad'}`}>
        verify: s<sup>e</sup> mod n = {modpow(sig, E, N)} {valid ? `= m (${m}) ✓ valid signature — and the signer can’t link it to the session` : '≠ m'}
      </div>

      <p className="bsig-foot">
        The cancellation is the key step: <code>(m·r<sup>e</sup>)<sup>d</sup> · r<sup>−1</sup> = m<sup>d</sup>·r<sup>ed−1</sup> = m<sup>d</sup></code>
        because <code>r<sup>ed</sup> ≡ r</code>. So the signer’s exponentiation lands on the real signature without the signer ever handling m, and
        the random r makes the blinded value statistically independent of the message — the signer literally cannot tell which later-presented
        signature came from which session. That <strong>unlinkability</strong> is the foundation of <strong>Chaum’s digital cash</strong> (a bank
        signs a coin it can’t trace back to you), <strong>Privacy Pass</strong> / anonymous rate-limit tokens, and anonymous credentials. Real
        deployments hash-and-pad the message first (blind RSA-PSS / RSA-FDH) so an attacker can’t exploit the multiplicative structure. (Chaum, 1982.)
      </p>
    </div>
  );
}
