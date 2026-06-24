// Poly1305, made visible — the one-time authenticator that pairs with ChaCha20.
// Watch the message become polynomial coefficients and accumulate acc = (acc+block)·r
// mod 2¹³⁰−5, then + s for the tag. Tamper a byte and the tag misses. Real BigInt
// math (poly1305.ts, verified to RFC 8439). Sandbox values only.
import { useState } from 'react';
import { poly1305 } from './poly1305';

const KEY = Uint8Array.from('85d6be7857556d337f4452fe42d506a80103808afb0db2fd4abff6af4149f51b'.match(/../g)!.map((b) => parseInt(b, 16)));
const toHex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
const big = (n: bigint, w = 26) => { const h = n.toString(16); return h.length > w ? '…' + h.slice(-w) : h; };

export function Poly1305Section() {
  const [msg, setMsg] = useState('Cryptographic Forum Research Group');
  const [tamper, setTamper] = useState(false);

  const data = new TextEncoder().encode(msg);
  const sent = poly1305(data, KEY);
  const received = tamper && data.length ? (() => { const d = data.slice(); d[d.length - 1] ^= 0x01; return d; })() : data;
  const recomputed = poly1305(received, KEY);
  const ok = toHex(recomputed.tag) === toHex(sent.tag);

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Poly1305 — a one-time message authenticator</h2></div>
        <p className="jsec-sub">
          Poly1305 evaluates a polynomial in the field <strong>2¹³⁰−5</strong>: each 16-byte block of the message is a coefficient
          (with a high 1 bit appended), folded in as <code>acc = (acc + block)·r mod p</code>, then <code>+ s</code> and truncated to
          128 bits. The key <strong>(r, s)</strong> must be fresh per message — in ChaCha20-Poly1305 it’s the cipher’s first keystream
          block.
        </p>

        <div className="pl-key">
          <span>r (clamped) = <code>{big(sent.r, 32)}</code></span>
          <span>s = <code>{big(sent.s, 32)}</code></span>
        </div>

        <label className="pl-field"><span>message</span><input value={msg} onChange={(e) => setMsg(e.target.value)} /></label>

        <table className="pl-steps">
          <thead><tr><th>block</th><th>coefficient (block ‖ 1)</th><th>acc = (acc+coeff)·r mod p</th></tr></thead>
          <tbody>
            {sent.steps.map((st) => (
              <tr key={st.block}><td>{st.block}</td><td>{big(st.coeff)}</td><td>{big(st.acc)}</td></tr>
            ))}
          </tbody>
        </table>
        <div className="pl-tag">tag = (acc + s) mod 2¹²⁸ = <code>{toHex(sent.tag)}</code></div>

        <label className="pl-toggle"><input type="checkbox" checked={tamper} onChange={(e) => setTamper(e.target.checked)} /> tamper: flip the last message byte in transit</label>
        <div className={`pl-verdict ${ok ? 'ok' : 'bad'}`}>
          {ok
            ? <>✅ recomputed tag <code>{toHex(recomputed.tag)}</code> matches — message authentic.</>
            : <>🚫 recomputed tag <code>{toHex(recomputed.tag)}</code> ≠ sent <code>{toHex(sent.tag)}</code> — rejected. One flipped byte changes a coefficient, and the polynomial avalanches.</>}
        </div>

        <p className="pl-foot">
          Poly1305 is only secure as a <strong>one-time</strong> MAC: reuse (r, s) across two messages and an attacker can solve for
          r and forge tags — the same nonce-reuse trap as <span className="pl-ref">CTR/GCM and ECDSA</span>. AEAD ties it together:
          ChaCha20 encrypts, Poly1305 authenticates the ciphertext + associated data, and the tag is checked before any plaintext is
          released.
        </p>
      </section>
    </div>
  );
}
