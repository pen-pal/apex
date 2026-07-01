// ElGamal, made visible. Fixed public prime p and generator g; a private key x gives the public key y = g^x.
// Encrypt a message and watch the ephemeral k produce c1 = g^k and the shared secret s = y^k that masks it as
// c2 = m·s. Re-roll k and the ciphertext changes completely (semantic security) though it still decrypts to the
// same m. A second panel shows the multiplicative homomorphism: multiply two ciphertexts, decrypt, get the
// product. Real modular arithmetic from elgamal.ts (small primes for legibility).
import { useState } from 'react';
import { modpow, keygen, encrypt, decrypt, homomorphicMultiply } from './elgamal';

const P = 2087, G = 5, X = 1023;
const PUB = keygen(P, G, X);
const nextK = (seed: number) => { const s = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff; return { seed: s, k: 1 + (s % (P - 2)) }; };

export function ElGamalSection() {
  const [m, setM] = useState(42);
  const [kState, setKState] = useState({ seed: 7, k: 7 });
  const [m1, setM1] = useState(17);
  const [m2, setM2] = useState(23);

  const safeM = Math.max(1, Math.min(P - 1, Math.floor(m) || 1));
  const k = kState.k;
  const s = modpow(PUB.y, k, P);            // shared secret y^k
  const ct = encrypt(safeM, PUB, k);
  const sRecomputed = modpow(ct.c1, X, P);  // c1^x = g^(kx) = y^k
  const decrypted = decrypt(ct, P, X);

  const e1 = encrypt(Math.max(1, Math.min(P - 1, m1)), PUB, 11);
  const e2 = encrypt(Math.max(1, Math.min(P - 1, m2)), PUB, 29);
  const prod = homomorphicMultiply(e1, e2, P);
  const prodDec = decrypt(prod, P, X);

  return (
    <div className="egm">
      <p className="egm-intro">
        ElGamal encrypts by <em>multiplying</em> your message with a fresh Diffie–Hellman shared secret only the
        private-key holder can rebuild. Public: prime <b>p={P}</b>, generator <b>g={G}</b>. The private key
        <b> x={X}</b> gives the public key <b>y = g<sup>x</sup> mod p = {PUB.y}</b>.
      </p>

      <div className="egm-panel">
        <div className="egm-ph">🔒 Encrypt</div>
        <label className="egm-mf">message m =<input type="number" min={1} max={P - 1} value={m} onChange={(e) => setM(+e.target.value)} /></label>
        <div className="egm-krow">
          ephemeral <b>k = {k}</b>
          <button type="button" className="egm-reroll" onClick={() => setKState((s2) => nextK(s2.seed))}>🎲 re-roll k</button>
        </div>
        <div className="egm-calc">
          <div className="egm-line"><span>c₁ = g<sup>k</sup> mod p</span><b>{ct.c1}</b></div>
          <div className="egm-line"><span>shared secret s = y<sup>k</sup> mod p</span><b>{s}</b></div>
          <div className="egm-line"><span>c₂ = m · s mod p</span><b>{ct.c2}</b></div>
        </div>
        <div className="egm-ct">ciphertext = (<b>{ct.c1}</b>, <b>{ct.c2}</b>)</div>
      </div>

      <div className="egm-panel">
        <div className="egm-ph">🔑 Decrypt <span className="egm-note">with private key x</span></div>
        <div className="egm-calc">
          <div className="egm-line"><span>recompute s = c₁<sup>x</sup> mod p</span><b className={sRecomputed === s ? 'ok' : ''}>{sRecomputed}</b></div>
          <div className="egm-line"><span>m = c₂ · s⁻¹ mod p</span><b className={decrypted === safeM ? 'ok' : 'bad'}>{decrypted}</b></div>
        </div>
        <div className="egm-verdict">{decrypted === safeM ? `✓ recovered the message ${safeM}` : '✗'} — the receiver rebuilds the <em>same</em> secret ({sRecomputed}) from x, because c₁<sup>x</sup> = g<sup>kx</sup> = y<sup>k</sup>.</div>
      </div>

      <div className="egm-semantic">
        🎲 <strong>Randomized:</strong> re-roll k above and the ciphertext changes completely, yet still decrypts
        to {safeM}. The same message encrypts to a different pair every time — so you can't even tell whether two
        ciphertexts hold the same value (semantic security).
      </div>

      <div className="egm-panel homo">
        <div className="egm-ph">✖ Multiplicatively homomorphic</div>
        <div className="egm-homrow">
          <label>m₁ =<input type="number" min={1} max={45} value={m1} onChange={(e) => setM1(+e.target.value)} /></label>
          <label>m₂ =<input type="number" min={1} max={45} value={m2} onChange={(e) => setM2(+e.target.value)} /></label>
        </div>
        <div className="egm-homcalc">
          Enc(m₁) = ({e1.c1}, {e1.c2}) &nbsp;×&nbsp; Enc(m₂) = ({e2.c1}, {e2.c2})<br />
          = (<b>{prod.c1}</b>, <b>{prod.c2}</b>) &nbsp;→&nbsp; decrypts to <b className="egm-ans">{prodDec}</b> = m₁·m₂ mod p = {(m1 * m2) % P}
        </div>
        <div className="egm-note2">Multiplied the ciphertexts without ever decrypting — the product came out encrypted.</div>
      </div>

      <p className="egm-foot">
        Security rests on the <strong>Decisional Diffie–Hellman</strong> assumption: seeing g, y=g<sup>x</sup>,
        and c₁=g<sup>k</sup>, an attacker still can't distinguish the secret y<sup>k</sup> from random, so c₂ =
        m·y<sup>k</sup> leaks nothing about m. Two footguns matter in practice. The randomness k must be
        <strong> fresh and secret every time</strong> — reuse it across two messages and dividing the ciphertexts
        cancels the secret, exposing m₁/m₂ (the same nonce-reuse disaster as ECDSA). And plain ElGamal is
        malleable precisely <em>because</em> it's homomorphic: an attacker can multiply your ciphertext by 2 and
        change the plaintext, so unauthenticated ElGamal must be wrapped with a MAC or a CCA-secure construction
        for confidentiality. That same malleability is a feature when you want it: encrypted e-voting tallies
        votes by multiplying ciphertexts, and threshold/mix-net systems lean on it. ElGamal moves cleanly to
        elliptic-curve groups (ECIES is the modern, efficient descendant), and its signature variant is the root
        of DSA. RSA hides messages multiplicatively too, but deterministically — ElGamal's built-in randomness is
        why it's the template for semantically-secure public-key encryption. (ElGamal, 1985.)
      </p>
    </div>
  );
}
