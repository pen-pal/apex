// Feistel networks, made visible. Watch a 16-bit block move through the rounds —
// each round swaps the halves and XORs one with F(other, key) — then decrypt and see
// the exact same structure run backward recover the plaintext, even though F itself
// throws information away. That reversibility-for-free is what sets Feistel ciphers
// (DES, Blowfish) apart from AES's substitution-permutation network. Model: feistel.ts
// (tested).
import { useState } from 'react';
import { roundF, roundKeys, encryptTrace, decryptTrace, encrypt } from './feistel';

const hx = (b: number) => b.toString(16).padStart(2, '0').toUpperCase();
const hue = (b: number) => `hsl(${Math.round((b / 256) * 360)} 60% 86%)`;

export function FeistelSection() {
  const [L0, setL0] = useState(0x12);
  const [R0, setR0] = useState(0x34);
  const [key, setKey] = useState(0xab);
  const keys = roundKeys(key);

  const [cL, cR] = encrypt(L0, R0, keys);
  const encT = encryptTrace(L0, R0, keys);
  const decT = decryptTrace(cL, cR, keys);

  const ladder = (rows: typeof encT, mode: 'enc' | 'dec') => (
    <div className="ft-ladder">
      {rows.map((r, i) => (
        <div key={i} className={`ft-rrow ${i === 0 || i === rows.length - 1 ? 'edge' : ''}`}>
          <span className="ft-rn">{i === 0 ? (mode === 'enc' ? 'plain' : 'cipher') : i === rows.length - 1 ? (mode === 'enc' ? 'cipher' : 'plain') : `r${mode === 'enc' ? r.round : r.round + 1}`}</span>
          <span className="ft-half" style={{ background: hue(r.L) }}>{hx(r.L)}</span>
          <span className="ft-half" style={{ background: hue(r.R) }}>{hx(r.R)}</span>
          {i > 0 && <span className="ft-op">{mode === 'enc' ? `R⊕F = ${hx(rows[i - 1].L)}⊕${hx(r.f)}` : `L⊕F = ${hx(rows[i - 1].R)}⊕${hx(r.f)}`} · K={hx(r.key)}</span>}
        </div>
      ))}
    </div>
  );

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Feistel networks — reversible for free</h2></div>
        <p className="jsec-sub">
          Split the block into halves L and R. Each round: <code>L, R ← R, L ⊕ F(R, Kᵢ)</code>. The round function{' '}
          <strong>F</strong> can be anything — even non-invertible — because to decrypt you just run the structure backward. That’s
          the opposite of AES, where every step must itself be reversible. DES uses 16 of these rounds.
        </p>

        <div className="ft-controls">
          <label>L = {hx(L0)}<input type="range" min={0} max={255} value={L0} onChange={(e) => setL0(Number(e.target.value))} /></label>
          <label>R = {hx(R0)}<input type="range" min={0} max={255} value={R0} onChange={(e) => setR0(Number(e.target.value))} /></label>
          <label>key = {hx(key)}<input type="range" min={0} max={255} value={key} onChange={(e) => setKey(Number(e.target.value))} /></label>
        </div>

        <div className="ft-fnote">
          The round function here is <code>F(r,k) = (r² ⊕ k) mod 256</code> — <strong>non-invertible</strong>: e.g.{' '}
          <code>F(0x01,{hx(key)}) = F(0xFF,{hx(key)}) = {hx(roundF(1, key))}</code> (1² ≡ 255² mod 256), so you can’t recover r from
          F. The cipher reverses anyway.
        </div>

        <div className="ft-cols">
          <div className="ft-col">
            <div className="ft-col-h">① encrypt →</div>
            {ladder(encT, 'enc')}
          </div>
          <div className="ft-col">
            <div className="ft-col-h">② decrypt (same structure, reversed) →</div>
            {ladder(decT, 'dec')}
          </div>
        </div>
        <div className={`ft-verdict ${decT[decT.length - 1].L === L0 && decT[decT.length - 1].R === R0 ? 'ok' : 'bad'}`}>
          decrypt recovered <strong>{hx(decT[decT.length - 1].L)} {hx(decT[decT.length - 1].R)}</strong> = the original plaintext ✓ — even though F discards information every round.
        </div>

        <p className="ft-foot">
          Each round only confuses one half, so Feistel ciphers need many rounds for full diffusion (DES: 16). The design’s gift is
          that encryption and decryption share the same hardware/code — you just feed the round keys in reverse. Its classic
          weakness was key size: DES’s 56-bit key fell to brute force, which is why 3DES and then AES replaced it.
        </p>
      </section>
    </div>
  );
}
