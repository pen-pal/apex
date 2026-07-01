// HMAC, made visible. Type a key and message and watch HMAC-SHA256 build from the two-pass construction on real
// SHA-256: the key is padded to 64 bytes, XOR'd with ipad (0x36) and opad (0x5c), and hashed inner-then-outer.
// Every intermediate byte string is shown. The tag matches the RFC 4231 vectors and the platform's HMAC. Real
// model from hmac.ts.
import { useEffect, useState } from 'react';
import { hmac, enc, hex, type HmacSteps } from './hmac';

const short = (b: Uint8Array, n = 12) => hex(b.slice(0, n)) + (b.length > n ? '…' : '');

export function HmacSection() {
  const [key, setKey] = useState('shared-secret');
  const [msg, setMsg] = useState('transfer $100 to alice');
  const [steps, setSteps] = useState<HmacSteps | null>(null);

  useEffect(() => {
    let live = true;
    hmac(enc(key), enc(msg)).then((s) => { if (live) setSteps(s); });
    return () => { live = false; };
  }, [key, msg]);

  return (
    <div className="hmc">
      <p className="hmc-intro">
        A <strong>MAC</strong> proves a message came from someone holding the shared key and wasn't altered.
        Naively hashing <code>H(key ‖ msg)</code> is broken by a <strong>length-extension</strong> attack; HMAC
        fixes it by hashing twice with two key-derived pads: <code>H((K⊕opad) ‖ H((K⊕ipad) ‖ msg))</code>. Type a
        key and message:
      </p>

      <div className="hmc-inputs">
        <label className="hmc-f">key<input value={key} onChange={(e) => setKey(e.target.value)} spellCheck={false} /></label>
        <label className="hmc-f">message<input value={msg} onChange={(e) => setMsg(e.target.value)} spellCheck={false} /></label>
      </div>

      {steps && (
        <div className="hmc-steps">
          <div className="hmc-step">
            <span className="hmc-lbl">K → block key</span>
            <span className="hmc-note">{steps.keyWasHashed ? 'key > 64 B, hashed first, then' : ''} zero-padded to 64 bytes</span>
            <code className="hmc-bytes">{short(steps.blockKey, 16)}</code>
          </div>
          <div className="hmc-pass inner">
            <div className="hmc-step"><span className="hmc-lbl">K ⊕ ipad</span><span className="hmc-note">each byte XOR 0x36</span><code className="hmc-bytes">{short(steps.ipadKey, 16)}</code></div>
            <div className="hmc-hash">↓ SHA-256( <b>K⊕ipad</b> ‖ message )</div>
            <div className="hmc-step"><span className="hmc-lbl">inner digest</span><span className="hmc-note">32 bytes</span><code className="hmc-bytes in">{hex(steps.inner)}</code></div>
          </div>
          <div className="hmc-pass outer">
            <div className="hmc-step"><span className="hmc-lbl">K ⊕ opad</span><span className="hmc-note">each byte XOR 0x5c</span><code className="hmc-bytes">{short(steps.opadKey, 16)}</code></div>
            <div className="hmc-hash">↓ SHA-256( <b>K⊕opad</b> ‖ inner digest )</div>
            <div className="hmc-step out"><span className="hmc-lbl">HMAC-SHA256</span><span className="hmc-note">the tag</span><code className="hmc-bytes mac">{hex(steps.mac)}</code></div>
          </div>
        </div>
      )}

      <div className="hmc-why">
        <strong>Why two passes?</strong> The inner hash binds the message under the key; the outer hash wraps that
        digest under the key again. An attacker only ever sees the outer hash of a fixed-length inner digest —
        there's nothing to length-extend, so <code>H(key ‖ msg)</code>'s forgery attack simply doesn't apply.
      </div>

      <p className="hmc-foot">
        HMAC is everywhere secret-keyed integrity is needed: TLS record MACs (pre-1.3), the signature in a
        <code> JWT</code> (<code>HS256</code> is HMAC-SHA256), AWS SigV4 request signing, GitHub/Stripe webhook
        verification, and as the PRF inside <strong>HKDF</strong> and <strong>PBKDF2</strong>. Three things worth
        knowing. First, HMAC needs the key even to VERIFY, which is its whole point (it's symmetric — sender and
        receiver share the secret) — unlike a digital signature, where anyone can verify with a public key but
        only the holder can sign. Second, comparing a received tag against the computed one must be done in
        <strong> constant time</strong>: a byte-by-byte compare that returns early leaks, via timing, how many
        leading bytes matched, letting an attacker forge a tag one byte at a time — so use a constant-time equal.
        Third, HMAC is provably secure even with hashes like SHA-256 that have no exploitable weakness, and it
        stays secure even with hashes (MD5, SHA-1) that are broken for collisions — the nested construction needs
        far less of the hash — which is why it's the belt-and-suspenders standard. Newer designs sometimes skip
        it: SHA-3/Keccak isn't length-extendable, so a plain keyed hash (<code>KMAC</code>) is safe, and
        Poly1305/GMAC are faster polynomial MACs used in modern AEAD ciphers. (RFC 2104; RFC 4231; Bellare,
        Canetti &amp; Krawczyk, 1996.)
      </p>
    </div>
  );
}
