// The one-time pad, made visible — perfect secrecy, and why it's almost never usable.
// XOR a message with a random equal-length key; the ciphertext is uniform noise. The
// "perfect secrecy" panel shows that ANY decoy message has a key giving the SAME
// ciphertext — so it leaks nothing. The reuse panel shows the fatal flaw: one repeated
// pad and C1⊕C2 = P1⊕P2. Real XOR (otpad.ts, tested).
import { useMemo, useState } from 'react';
import { otpEncrypt, keyFor, xorBytes } from './otpad';

const enc = (s: string) => new TextEncoder().encode(s);
const hx = (b: number) => b.toString(16).padStart(2, '0');
const Bytes = ({ d, cls }: { d: Uint8Array; cls?: string }) => <span className="pad-bytes">{[...d].map((b, i) => <code key={i} className={cls}>{hx(b)}</code>)}</span>;

export function OneTimePadSection() {
  const [msg, setMsg] = useState('MEET AT DAWN');
  const [seed, setSeed] = useState(0);
  const data = enc(msg);
  const key = useMemo(() => Uint8Array.from({ length: data.length }, () => Math.floor(Math.random() * 256)), [msg, seed]);
  const cipher = otpEncrypt(data, key);

  const [decoy, setDecoy] = useState('RUN AWAY NOW');
  const decoyData = enc(decoy.slice(0, data.length).padEnd(data.length, ' '));
  const fakeKey = keyFor(cipher, decoyData);

  const [p2, setP2] = useState('FIRE AT NOON');
  const data2 = enc(p2);
  const c2 = otpEncrypt(data2, key); // same key — the bug
  const cxor = xorBytes(cipher, c2), pxor = xorBytes(data, data2);

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>① XOR with a random pad</h2></div>
        <p className="jsec-sub">
          Take a key as long as the message, every byte truly random. Ciphertext = message ⊕ key; decryption XORs the same key back.
          With a random key the ciphertext is uniform — every output byte equally likely — so on its own it tells an eavesdropper
          nothing.
        </p>
        <label className="pad-field"><span>message</span><input value={msg} onChange={(e) => setMsg(e.target.value)} /></label>
        <div className="pad-row"><span className="pad-l">plaintext</span><Bytes d={data} /></div>
        <div className="pad-row"><span className="pad-l">⊕ key</span><Bytes d={key} cls="k" /><button className="pad-re" onClick={() => setSeed((s) => s + 1)}>↻</button></div>
        <div className="pad-row"><span className="pad-l ct">= cipher</span><Bytes d={cipher} cls="c" /></div>
      </section>

      <section className="jsec">
        <div className="jsec-head"><h2>② Perfect secrecy — any message is possible</h2></div>
        <p className="jsec-sub">
          Here’s the proof made concrete: pick any decoy message of the same length, and there’s a key that decrypts the <em>same</em>
          ciphertext to it. So the ciphertext can’t favour the real message over any other — that’s what “reveals nothing” means.
        </p>
        <label className="pad-field"><span>claim the message was…</span><input value={decoy} onChange={(e) => setDecoy(e.target.value)} /></label>
        <div className="pad-row"><span className="pad-l ct">cipher</span><Bytes d={cipher} cls="c" /></div>
        <div className="pad-row"><span className="pad-l">needs key</span><Bytes d={fakeKey} cls="k" /></div>
        <div className="pad-secrecy">⊕ that key, the cipher decodes to “<strong>{new TextDecoder().decode(otpEncrypt(cipher, fakeKey))}</strong>” — a perfectly valid, equally-likely key. The attacker can’t tell which key is real.</div>
      </section>

      <section className="jsec">
        <div className="jsec-head"><h2>③ Use it twice and it shatters</h2></div>
        <p className="jsec-sub">
          The whole guarantee rests on “one-time”. Encrypt two messages with the <strong>same</strong> pad and the key cancels:
          <code> C1 ⊕ C2 = P1 ⊕ P2</code> — the same trap as CTR/GCM and ECDSA nonce reuse, and how the Soviet one-time pads were
          read in the VENONA project.
        </p>
        <label className="pad-field"><span>second message (same pad)</span><input value={p2} onChange={(e) => setP2(e.target.value)} /></label>
        <div className="pad-row"><span className="pad-l">C1 ⊕ C2</span><Bytes d={cxor} /></div>
        <div className="pad-row"><span className="pad-l">P1 ⊕ P2</span><Bytes d={pxor} /></div>
        <div className={`pad-verdict ${[...cxor].every((b, i) => b === pxor[i]) ? 'bad' : ''}`}>🔓 equal — the pad vanished, leaking the XOR of both plaintexts. This is why a one-time pad is a museum piece: a truly random key as long as all your traffic, used once, is almost never practical.</div>
      </section>
    </div>
  );
}
