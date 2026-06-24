// Post-quantum, made visible — Learning With Errors. The public key is A and
// b = A·s + e; the secret s hides inside the small noise e. Encrypt a bit by
// burying it near 0 or q/2, decrypt by subtracting s·u and rounding. Drag the
// noise up and watch the bit flip once it crosses q/4 — exactly the budget ML-KEM
// (Kyber) is engineered to keep. Real arithmetic from lwe.ts; tiny teaching params.
import { useMemo, useState } from 'react';
import { PARAMS, keyGen, encryptBit, decryptBit, half, noiseMargin } from './lwe';

const { n, q } = PARAMS;
const A = [
  [52, 9, 31, 77],
  [14, 63, 5, 40],
  [88, 21, 66, 3],
  [7, 49, 18, 70],
];
const randSmall = () => Math.floor(Math.random() * 5) - 2; // -2..2
const vec = () => Array.from({ length: n }, randSmall);

function Vec({ data, cls, label }: { data: number[]; cls?: string; label: string }) {
  return (
    <div className="lwe-vec">
      <span className="lwe-vl">{label}</span>
      <span className="lwe-cells">{data.map((x, i) => <code key={i} className={cls}>{x}</code>)}</span>
    </div>
  );
}

export function LweSection() {
  const [keySeed, setKeySeed] = useState(0);
  const [encSeed, setEncSeed] = useState(0);
  const [bit, setBit] = useState<0 | 1>(1);
  const [extra, setExtra] = useState(0); // attacker/error noise added to e2

  const key = useMemo(() => ({ s: vec(), e: vec() }), [keySeed]);
  const rnd = useMemo(() => ({ r: vec(), e1: vec(), e2: randSmall() }), [encSeed]);
  const pk = useMemo(() => keyGen(A, key.s, key.e, q), [key]);
  const cipher = encryptBit(pk, rnd.r, rnd.e1, rnd.e2 + extra, bit, q);
  const dec = decryptBit(key.s, cipher, q);
  const margin = noiseMargin(q);
  const pos = (dec.raw / q) * 100;

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>① The hard problem: b = A·s + e</h2></div>
        <p className="jsec-sub">
          Pick a public matrix <strong>A</strong> and a secret vector <strong>s</strong>, then publish{' '}
          <strong>b = A·s + e</strong> with a little <strong>noise e</strong>. Without the noise this is just linear algebra you
          could solve instantly; <em>with</em> it, recovering s is <strong>Learning With Errors</strong> — believed hard even for a
          quantum computer, because there’s no periodic structure for Shor’s algorithm to exploit (the way it factors RSA / breaks ECC).
        </p>
        <button className="lwe-btn" onClick={() => { setKeySeed((k) => k + 1); setEncSeed((k) => k + 1); }}>↻ new keypair</button>
        <div className="lwe-grid">
          <div className="lwe-mat">
            <span className="lwe-vl">A (public)</span>
            <div className="lwe-A">{A.map((row, i) => row.map((x, j) => <code key={`${i}-${j}`}>{x}</code>))}</div>
          </div>
          <div className="lwe-vecs">
            <Vec data={key.s} cls="secret" label="s (secret)" />
            <Vec data={key.e} cls="noise" label="e (noise)" />
            <Vec data={pk.b} cls="pub" label="b = A·s+e" />
          </div>
        </div>
        <p className="lwe-note">Public key = (A, b). The secret s never leaves; an eavesdropper sees only A, b, and the ciphertext below.</p>
      </section>

      <section className="jsec">
        <div className="jsec-head"><h2>② Encrypt a bit by burying it</h2></div>
        <p className="jsec-sub">
          To send a bit, pick small randomness r, e1, e2 and compute <code>u = Aᵀ·r + e1</code> and{' '}
          <code>v = b·r + e2 + bit·⌊q/2⌋</code>. A <strong>0</strong> lands near 0; a <strong>1</strong> lands near{' '}
          <strong>⌊q/2⌋ = {half(q)}</strong>. The ciphertext is the pair (u, v).
        </p>
        <div className="lwe-controls">
          <div className="lwe-bit">
            <button className={bit === 0 ? 'on' : ''} onClick={() => setBit(0)}>send 0</button>
            <button className={bit === 1 ? 'on' : ''} onClick={() => setBit(1)}>send 1</button>
          </div>
          <button className="lwe-btn" onClick={() => setEncSeed((k) => k + 1)}>↻ fresh randomness</button>
        </div>
        <div className="lwe-vecs">
          <Vec data={rnd.r} cls="noise" label="r" />
          <Vec data={cipher.u} cls="pub" label="u = Aᵀr+e1" />
          <div className="lwe-vec"><span className="lwe-vl">v</span><span className="lwe-cells"><code className="pub">{cipher.v}</code></span></div>
        </div>
      </section>

      <section className="jsec">
        <div className="jsec-head"><h2>③ Decrypt by subtracting the secret, then round</h2></div>
        <p className="jsec-sub">
          Only the holder of s can compute <code>v − s·u ≈ bit·⌊q/2⌋ + (small noise)</code>. Round to the nearer of 0 or ⌊q/2⌋ and
          the noise washes out — <strong>as long as |noise| &lt; q/4 = {margin}</strong>. Drag in extra noise and watch the bit flip.
        </p>
        <div className="lwe-dial">
          <div className="lwe-zone z0" style={{ left: '0%', width: '25%' }}>bit 0</div>
          <div className="lwe-zone z1" style={{ left: '25%', width: '50%' }}>bit 1</div>
          <div className="lwe-zone z0" style={{ left: '75%', width: '25%' }}>bit 0</div>
          <div className="lwe-ticks"><span style={{ left: '0%' }}>0</span><span style={{ left: '50%' }}>{half(q)}</span><span style={{ left: '100%' }}>{q}</span></div>
          <div className="lwe-ptr" style={{ left: `${pos}%` }} title={`v − s·u = ${dec.raw}`} />
        </div>
        <label className="lwe-slider">extra noise: {extra}
          <input type="range" min={0} max={half(q)} value={extra} onChange={(e) => setExtra(Number(e.target.value))} /></label>
        <div className={`lwe-verdict ${dec.bit === bit ? 'good' : 'bad'}`}>
          v − s·u = <strong>{dec.raw}</strong> · noise <strong>{dec.noise}</strong> (budget ±{margin}) → decoded bit <strong>{dec.bit}</strong>
          {dec.bit === bit
            ? ' ✓ matches the sent bit.'
            : ` ✗ wrong! the noise (${dec.noise}) crossed the q/4 boundary and flipped it — this is why ML-KEM picks its parameters so carefully.`}
        </div>
        <p className="lwe-foot">
          This single-bit Regev scheme is the kernel of <strong>ML-KEM (Kyber)</strong>, NIST’s post-quantum standard — which runs the
          same idea over polynomial rings (q = 3329) to encapsulate 256 bits at once. TLS 1.3 is rolling it out as the{' '}
          <strong>hybrid X25519 + ML-KEM</strong> key exchange, so a future quantum computer can’t decrypt today’s recorded traffic.
        </p>
      </section>
    </div>
  );
}
