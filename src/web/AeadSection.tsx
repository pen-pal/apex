// CTR, nonce reuse & AEAD — the depth beyond ECB/CBC, all on real bytes.
//  1. CTR turns the block cipher into a stream cipher: encrypt a counter, XOR the
//     keystream over the data (no padding; encrypt == decrypt).
//  2. Reuse a (key, nonce) and the keystream repeats, so C1 ⊕ C2 = P1 ⊕ P2 — the
//     keystream cancels and the plaintexts leak. The single most common crypto bug.
//  3. AEAD (AES-GCM) adds a GHASH tag so tampering is detected before you trust a
//     byte. Flip a ciphertext byte and watch verification reject it.
// Everything here is computed by the NIST-verified aesgcm.ts on sandbox values.
import { useMemo, useState } from 'react';
import { aesCtr, ctrBlock, aesGcmEncrypt, aesGcmDecrypt, xorBytes } from './aesgcm';

const KEY = Uint8Array.from('2b7e151628aed2a6abf7158809cf4f3c'.match(/../g)!.map((b) => parseInt(b, 16)));
const NONCE = Uint8Array.from('cafebabefacedbaddecaf888'.match(/../g)!.map((b) => parseInt(b, 16)));

const hx = (b: number) => b.toString(16).padStart(2, '0');
const toHex = (b: Uint8Array) => [...b].map(hx).join('');
const enc = (s: string) => new TextEncoder().encode(s);
const printable = (b: Uint8Array) => [...b].map((x) => (x >= 32 && x < 127 ? String.fromCharCode(x) : '·')).join('');
const byteHue = (b: number) => `hsl(${Math.round((b / 256) * 360)} 62% 86%)`;

function Bytes({ data, hue = true, onByte, mark }: { data: Uint8Array; hue?: boolean; onByte?: (i: number) => void; mark?: number }) {
  return (
    <span className="ag-bytes">
      {[...data].map((b, i) => (
        <code key={i} className={`ag-b ${onByte ? 'click' : ''} ${mark === i ? 'mark' : ''}`}
          style={{ background: hue ? byteHue(b) : undefined }} onClick={() => onByte?.(i)} title={`byte ${i}`}>
          {hx(b)}
        </code>
      ))}
    </span>
  );
}

export function AeadSection() {
  return (
    <div className="journey">
      <CtrPanel />
      <NoncePanel />
      <AeadPanel />
    </div>
  );
}

// ── 1. CTR: a block cipher becomes a stream cipher ──────────────────────────
function CtrPanel() {
  const [msg, setMsg] = useState('stream me, no padding!');
  const data = enc(msg);
  const res = useMemo(() => aesCtr(data, KEY, ctrBlock(NONCE)), [msg]);
  return (
    <section className="jsec">
      <div className="jsec-head"><h2>① CTR mode — a block cipher, used as a stream cipher</h2></div>
      <p className="jsec-sub">
        Instead of encrypting the <em>message</em>, CTR encrypts a <strong>counter</strong> (nonce ‖ block number) and XORs the
        resulting <strong>keystream</strong> over the data. No padding, blocks are independent (parallelisable, random-access),
        and decrypting is the <em>same</em> operation — XOR the keystream back.
      </p>
      <label className="ag-field"><span>message</span>
        <input value={msg} onChange={(e) => setMsg(e.target.value)} /></label>
      <div className="ag-ctr">
        {res.counters.map((c, i) => {
          const off = i * 16;
          const ks = res.keystream.subarray(off, off + 16);
          const pt = data.subarray(off, off + 16);
          const ct = res.out.subarray(off, off + 16);
          return (
            <div key={i} className="ag-ctr-block">
              <div className="ag-row"><span className="ag-lab">counter {i}</span><Bytes data={c} hue={false} /></div>
              <div className="ag-op">↓ AES<sub>K</sub>(counter)</div>
              <div className="ag-row"><span className="ag-lab">keystream</span><Bytes data={ks} /></div>
              <div className="ag-op">⊕ plaintext</div>
              <div className="ag-row"><span className="ag-lab">plaintext</span><Bytes data={pt} /></div>
              <div className="ag-op">=</div>
              <div className="ag-row"><span className="ag-lab ct">ciphertext</span><Bytes data={ct} /></div>
            </div>
          );
        })}
      </div>
      <p className="ag-note">{data.length} bytes in → {res.out.length} bytes out (no padding). Run it again on the ciphertext and you get the message back.</p>
    </section>
  );
}

// ── 2. Nonce reuse: the keystream cancels ───────────────────────────────────
function NoncePanel() {
  const [p1, setP1] = useState('attack at dawn');
  const [p2, setP2] = useState('retreat by noon');
  const [reuse, setReuse] = useState(true);
  const d1 = enc(p1), d2 = enc(p2);
  const nonce2 = reuse ? NONCE : (() => { const n = NONCE.slice(); n[11] ^= 0x01; return n; })();
  const c1 = aesCtr(d1, KEY, ctrBlock(NONCE)).out;
  const c2 = aesCtr(d2, KEY, ctrBlock(nonce2)).out;
  const cxor = xorBytes(c1, c2);
  const pxor = xorBytes(d1, d2);
  const leaked = toHex(cxor) === toHex(pxor);
  const recovered = xorBytes(cxor, d1); // attacker knows P1 → gets P2

  return (
    <section className="jsec">
      <div className="jsec-head"><h2>② Nonce reuse — the one bug that breaks everything</h2></div>
      <p className="jsec-sub">
        The keystream depends only on (key, nonce). Encrypt two messages under the <strong>same</strong> pair and the keystream is
        identical, so it cancels: <code>C1 ⊕ C2 = (P1 ⊕ KS) ⊕ (P2 ⊕ KS) = P1 ⊕ P2</code>. The cipher vanishes and the plaintexts
        leak against each other.
      </p>
      <div className="ag-two">
        <label className="ag-field"><span>message 1</span><input value={p1} onChange={(e) => setP1(e.target.value)} /></label>
        <label className="ag-field"><span>message 2</span><input value={p2} onChange={(e) => setP2(e.target.value)} /></label>
        <label className="ag-toggle"><input type="checkbox" checked={reuse} onChange={(e) => setReuse(e.target.checked)} /> reuse the nonce</label>
      </div>
      <div className="ag-row"><span className="ag-lab ct">C1</span><Bytes data={c1} /></div>
      <div className="ag-row"><span className="ag-lab ct">C2</span><Bytes data={c2} /></div>
      <div className="ag-row"><span className="ag-lab">C1 ⊕ C2</span><Bytes data={cxor} hue={false} /></div>
      <div className="ag-row"><span className="ag-lab">P1 ⊕ P2</span><Bytes data={pxor} hue={false} /></div>
      <div className={`ag-verdict ${leaked ? 'bad' : 'good'}`}>
        {leaked ? (
          <>🔓 <strong>C1 ⊕ C2 == P1 ⊕ P2.</strong> The keystream cancelled. Knowing P1, the attacker recovers
            P2 = (C1 ⊕ C2) ⊕ P1 = <code className="ag-reveal">“{printable(recovered)}”</code></>
        ) : (
          <>🔒 Different nonces → different keystreams → <strong>no cancellation.</strong> The XORs don’t match; nothing leaks.</>
        )}
      </div>
    </section>
  );
}

// ── 3. AEAD (GCM): confidentiality + integrity ──────────────────────────────
function AeadPanel() {
  const [msg, setMsg] = useState('transfer $5000 now');
  const [tamperAt, setTamperAt] = useState<number | null>(null);
  const data = enc(msg);
  const { ciphertext, tag, H } = useMemo(() => aesGcmEncrypt(data, KEY, NONCE), [msg]);

  const received = ciphertext.slice();
  if (tamperAt !== null && tamperAt < received.length) received[tamperAt] ^= 0x40;
  const open = aesGcmDecrypt(received, KEY, NONCE, tag);

  return (
    <section className="jsec">
      <div className="jsec-head"><h2>③ AEAD (AES-GCM) — secrecy <em>and</em> tamper-detection</h2></div>
      <p className="jsec-sub">
        CTR hides the data but can’t tell if someone flipped a bit in transit. <strong>GCM</strong> wraps CTR with a{' '}
        <strong>GHASH</strong> tag over GF(2¹²⁸): a 128-bit checksum, keyed by H = AES<sub>K</sub>(0), that the receiver recomputes
        and compares <em>before</em> trusting any plaintext. Click a ciphertext byte to tamper with it.
      </p>
      <label className="ag-field"><span>message</span><input value={msg} onChange={(e) => { setMsg(e.target.value); setTamperAt(null); }} /></label>
      <div className="ag-row"><span className="ag-lab">H = AES(0)</span><Bytes data={H} hue={false} /></div>
      <div className="ag-row"><span className="ag-lab ct">ciphertext</span><Bytes data={received} onByte={(i) => setTamperAt(tamperAt === i ? null : i)} mark={tamperAt ?? -1} /></div>
      <div className="ag-row"><span className="ag-lab">tag (sent)</span><Bytes data={tag} hue={false} /></div>
      <div className="ag-tamper">
        {tamperAt === null
          ? <span>untampered — click a ciphertext byte to flip it</span>
          : <span>tampered byte {tamperAt}. <button onClick={() => setTamperAt(null)}>undo</button></span>}
      </div>
      <div className={`ag-verdict ${open.authentic ? 'good' : 'bad'}`}>
        {open.authentic
          ? <>✅ <strong>tag verified.</strong> Decrypts to <code className="ag-reveal">“{printable(open.plaintext)}”</code></>
          : <>🚫 <strong>authentication failed — rejected.</strong> The recomputed tag doesn’t match, so GCM refuses to release the (now corrupt) plaintext. This is why you <em>verify, then decrypt</em>.</>}
      </div>
    </section>
  );
}
