// TLS honest-encryption sandbox. Does REAL AES-256-GCM with WebCrypto on
// sandbox values only (never a captured stream), shows the encrypted TLS
// application-data record shape (opaque), and demonstrates the avalanche
// effect: flip one plaintext bit and GCM's 128-bit auth tag changes by ~half —
// which is exactly how authenticated encryption detects any tampering.
import { useEffect, useState } from 'react';

const hexJoin = (b: Uint8Array) => [...b].map((x) => x.toString(16).toUpperCase().padStart(2, '0')).join(' ');

function hamming(a: Uint8Array, b: Uint8Array): { bits: number; total: number } {
  const n = Math.min(a.length, b.length);
  let bits = 0;
  for (let i = 0; i < n; i++) {
    let x = a[i] ^ b[i];
    while (x) { bits += x & 1; x >>= 1; }
  }
  return { bits, total: n * 8 };
}

interface Result {
  key: Uint8Array;
  iv: Uint8Array;
  pt: Uint8Array;
  ct: Uint8Array;
  tag: Uint8Array;
  tag2: Uint8Array;
  avalanche: { bits: number; total: number };
}

const TAG_LEN = 16;

export function CryptoView() {
  const [text, setText] = useState('attack at dawn');
  const [res, setRes] = useState<Result | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!globalThis.crypto?.subtle) throw new Error('WebCrypto (crypto.subtle) is unavailable in this context.');
        const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt']);
        const rawKey = new Uint8Array(await crypto.subtle.exportKey('raw', key));
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const pt = new TextEncoder().encode(text.length ? text : ' ');
        const buf1 = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, pt));
        // Flip the most-significant bit of the first plaintext byte and re-encrypt with the SAME key+IV.
        const pt2 = pt.slice();
        pt2[0] ^= 0x80;
        const buf2 = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, pt2));
        const ct = buf1.slice(0, buf1.length - TAG_LEN);
        const tag = buf1.slice(buf1.length - TAG_LEN);
        const tag2 = buf2.slice(buf2.length - TAG_LEN);
        if (!cancelled) {
          setErr(null);
          setRes({ key: rawKey, iv, pt, ct, tag, tag2, avalanche: hamming(tag, tag2) });
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [text]);

  const recordLen = res ? res.ct.length + res.tag.length : 0;
  const pct = res ? Math.round((res.avalanche.bits / res.avalanche.total) * 100) : 0;

  return (
    <div className="journey">
      <section className="jsec">
        <h2>TLS encryption sandbox — real AES-256-GCM</h2>
        <p className="jsec-sub">
          This runs genuine WebCrypto AES-GCM on the value you type below — a sandbox value, never a
          captured stream. After a TLS handshake, application data looks exactly like this: an opaque
          record of ciphertext + authentication tag. Apex never invents decrypted plaintext for real captures.
        </p>

        <label className="crypto-input">
          <span>plaintext (sandbox)</span>
          <input value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} placeholder="type a secret…" />
        </label>

        {err && <p className="crypto-err">⚠ {err}</p>}

        {res && (
          <>
            <div className="crypto-grid">
              <Row k="AES-256 key" v={hexJoin(res.key)} cls="dim" />
              <Row k="IV (96-bit nonce)" v={hexJoin(res.iv)} />
              <Row k="plaintext bytes" v={hexJoin(res.pt)} />
              <Row k="ciphertext" v={hexJoin(res.ct)} cls="cipher" />
              <Row k="auth tag (128-bit)" v={hexJoin(res.tag)} cls="tag" />
            </div>

            <div className="crypto-record">
              <div className="cr-title">…which on the wire is a TLS 1.3 application_data record:</div>
              <div className="cr-bar">
                <span className="cr-seg hdr">23</span>
                <span className="cr-seg hdr">03 03</span>
                <span className="cr-seg len">len {recordLen}</span>
                <span className="cr-seg op" style={{ flex: 3 }}>opaque ciphertext ({res.ct.length}B)</span>
                <span className="cr-seg tg">tag ({res.tag.length}B)</span>
              </div>
              <div className="cr-note">type 23 = application_data · legacy version 0x0303 · then the encrypted record — indistinguishable from noise to anyone without the key.</div>
            </div>

            <div className="crypto-avalanche">
              <div className="av-head">Avalanche — why tampering is always caught</div>
              <p className="av-text">
                Flip <strong>one bit</strong> of the plaintext and re-encrypt with the same key &amp; IV. The
                ciphertext changes only at that position (GCM is a stream cipher underneath) — but the 128-bit
                authentication tag changes completely:
              </p>
              <div className="av-tags">
                <code className="tag-a">{hexJoin(res.tag)}</code>
                <code className="tag-b">{hexJoin(res.tag2)}</code>
              </div>
              <div className="av-stat">
                <strong>{res.avalanche.bits}/{res.avalanche.total}</strong> tag bits changed ({pct}%) — any change to the
                ciphertext makes the tag verification fail, so the receiver detects it.
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function Row({ k, v, cls }: { k: string; v: string; cls?: string }) {
  return (
    <div className={`crypto-row ${cls ?? ''}`}>
      <span className="crypto-k">{k}</span>
      <code className="crypto-v">{v}</code>
    </div>
  );
}
