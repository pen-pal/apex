// ECDSA — sign with the private scalar, verify with the public point, and then the
// cautionary tale: reuse the per-signature nonce k and two signatures hand the
// attacker your private key by linear algebra. Real ECDSA on the toy curve from
// ecc.ts (order 19). This is the actual flaw behind the 2010 Sony PS3 master-key
// leak and multiple Bitcoin wallet thefts.
import { useState } from 'react';
import { ecdsaSign, ecdsaVerify, publicKey, recoverFromReuse, curveOrder as N } from './ecdsa';

const pt = (p: { x: number; y: number }) => `(${p.x}, ${p.y})`;

export function EcdsaSection() {
  const [d, setD] = useState(7);
  const [z, setZ] = useState(10);
  const [k, setK] = useState(3);
  const [tamper, setTamper] = useState(false);

  const Q = publicKey(d);
  const sig = ecdsaSign(z, d, k);
  const seenZ = tamper ? (z + 1) % N : z;
  const ok = ecdsaVerify(seenZ, sig, Q);

  // panel 2
  const [z1, setZ1] = useState(10);
  const [z2, setZ2] = useState(5);
  const [reuse, setReuse] = useState(true);
  const s1 = ecdsaSign(z1, d, k);
  const s2 = ecdsaSign(z2, d, reuse ? k : (k % (N - 1)) + 1);
  const sameR = reuse && s1.r === s2.r;
  // only a genuine reuse of k on two DIFFERENT message hashes leaks the key;
  // z1 === z2 would make s1 - s2 ≡ 0 and modinv(0) throw, so guard it out.
  const rec = sameR && z1 !== z2 ? recoverFromReuse(z1, s1.s, z2, s2.s, s1.r) : null;

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>① Sign with d, verify with Q = dG</h2></div>
        <p className="jsec-sub">
          Your private key is a scalar <strong>d</strong>; the public key is the point <strong>Q = dG</strong>. To sign a message
          hash <code>z</code> you pick a one-time nonce <code>k</code>, set <code>r = (kG).x mod {N}</code> and{' '}
          <code>s = k⁻¹(z + r·d) mod {N}</code>. Verification recomputes a point from (r, s, z, Q) and checks its x-coordinate
          equals r — provable only by the holder of d.
        </p>
        <div className="ec-sliders">
          <label>private d = {d}<input type="range" min={1} max={N - 1} value={d} onChange={(e) => setD(Number(e.target.value))} /></label>
          <label>hash z = {z}<input type="range" min={1} max={N - 1} value={z} onChange={(e) => setZ(Number(e.target.value))} /></label>
          <label>nonce k = {k}<input type="range" min={1} max={N - 1} value={k} onChange={(e) => setK(Number(e.target.value))} /></label>
        </div>
        <div className="ec-readout">
          public key Q = dG = <strong>{pt(Q)}</strong> &nbsp;·&nbsp; signature (r, s) = <strong>({sig.r}, {sig.s})</strong>
        </div>
        <label className="ec-toggle"><input type="checkbox" checked={tamper} onChange={(e) => setTamper(e.target.checked)} /> tamper: verifier receives z+1 instead of z</label>
        <div className={`ec-verdict ${ok ? 'good' : 'bad'}`}>
          {ok ? <>✅ <strong>valid signature</strong> for hash {seenZ} under Q.</> : <>🚫 <strong>invalid</strong> — the recomputed point’s x ≠ r. Wrong message or wrong key.</>}
        </div>
      </section>

      <section className="jsec">
        <div className="jsec-head"><h2>② Reuse the nonce → leak the private key</h2></div>
        <p className="jsec-sub">
          The nonce k must be unique and secret per signature. Here is <em>why</em> reuse is fatal: each signature
          <code> s = k⁻¹(z + r·d)</code> is one equation with two unknowns you don’t know — the nonce k and the private key d — so
          a single signature is unsolvable. But sign two different messages with the <strong>same</strong> k and you now have
          <strong> two equations in those same two unknowns</strong> (and both signatures share the same r — a dead giveaway). Two
          equations, two unknowns: solve them. <code>k = (z₁−z₂)(s₁−s₂)⁻¹</code>, then <code>d = (s₁k − z₁)·r⁻¹</code>, all mod {N}.
          The key is gone.
        </p>
        <div className="ec-sliders">
          <label>message hash z₁ = {z1}<input type="range" min={1} max={N - 1} value={z1} onChange={(e) => setZ1(Number(e.target.value))} /></label>
          <label>message hash z₂ = {z2}<input type="range" min={1} max={N - 1} value={z2} onChange={(e) => setZ2(Number(e.target.value))} /></label>
          <label className="ec-toggle inline"><input type="checkbox" checked={reuse} onChange={(e) => setReuse(e.target.checked)} /> reuse k for both</label>
        </div>
        <div className="ec-sigs">
          <div>signature 1: (r₁, s₁) = (<b className={sameR ? 'hot' : ''}>{s1.r}</b>, {s1.s})</div>
          <div>signature 2: (r₂, s₂) = (<b className={sameR ? 'hot' : ''}>{s2.r}</b>, {s2.s})</div>
        </div>
        {rec ? (
          <div className="ec-verdict bad">
            🔓 same r → attacker recovers nonce k = <strong>{rec.k}</strong> and the <strong>private key d = {rec.d}</strong>
            {rec.d === d ? ' ✓ (matches the real key — fully compromised)' : ''}.
            <div className="ec-foot">This is exactly how the PS3 master key leaked (2010, Sony reused a constant k) and how Bitcoins were stolen from wallets with a broken RNG.</div>
          </div>
        ) : sameR ? (
          <div className="ec-verdict good">🔒 same nonce, but the two message hashes are identical — so the signatures are identical and there’s nothing to subtract. Set z₁ ≠ z₂ to leak the key.</div>
        ) : (
          <div className="ec-verdict good">🔒 different nonces → different r → the equations don’t line up. Nothing leaks. (Real ECDSA derives k deterministically per RFC 6979 to guarantee this.)</div>
        )}
      </section>
    </div>
  );
}
