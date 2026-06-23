// Cryptography sandbox — REAL WebCrypto on sandbox values only (never a captured
// stream), across three tools:
//   • Encrypt — AES-256-GCM; shows the opaque TLS record + GCM avalanche.
//   • Hash    — SHA-256; flip one input bit and watch ~half the digest change.
//   • HMAC    — keyed SHA-256; same message + different key → unrelated tag.
// Apex never invents decrypted plaintext for real captures.
import { useEffect, useMemo, useState } from 'react';
import { sha256, hmacSha256, bitDifference } from './hashing';

const hexJoin = (b: Uint8Array) => [...b].map((x) => x.toString(16).toUpperCase().padStart(2, '0')).join(' ');
const enc = (s: string) => new TextEncoder().encode(s);

type Tool = 'encrypt' | 'hash' | 'hmac';
const TOOLS: { id: Tool; label: string }[] = [
  { id: 'encrypt', label: 'Encrypt (AES-GCM)' },
  { id: 'hash', label: 'Hash (SHA-256)' },
  { id: 'hmac', label: 'HMAC' },
];

export function CryptoView() {
  const [tool, setTool] = useState<Tool>('encrypt');
  return (
    <div className="journey">
      <section className="jsec">
        <nav className="subtabs">
          {TOOLS.map((t) => (
            <button key={t.id} className={tool === t.id ? 'on' : ''} onClick={() => setTool(t.id)}>{t.label}</button>
          ))}
        </nav>
        {tool === 'encrypt' && <EncryptTool />}
        {tool === 'hash' && <HashTool />}
        {tool === 'hmac' && <HmacTool />}
      </section>
    </div>
  );
}

// ---- Hash (SHA-256) with a clickable avalanche --------------------------------

function HashTool() {
  const [text, setText] = useState('attack at dawn');
  const [mask, setMask] = useState(0); // XOR mask applied to the first input byte
  const [digest, setDigest] = useState<Uint8Array | null>(null);
  const [perturbed, setPerturbed] = useState<Uint8Array | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const base = useMemo(() => { const b = enc(text.length ? text : ' '); return b; }, [text]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const a = await sha256(base);
        const mutated = base.slice();
        mutated[0] ^= mask;
        const b = mask ? await sha256(mutated) : a;
        if (!cancelled) { setErr(null); setDigest(a); setPerturbed(b); }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [base, mask]);

  const diff = digest && perturbed ? bitDifference(digest, perturbed) : 0;
  const pct = digest ? Math.round((diff / 256) * 100) : 0;
  const byte0 = base[0];

  return (
    <>
      <h2>SHA-256 — a one-way fingerprint</h2>
      <p className="jsec-sub">
        A hash maps any input to a fixed 256-bit fingerprint. It's deterministic (same input → same hash),
        one-way (you can't run it backwards), and <strong>avalanching</strong>: change a single input bit and
        about half of the 256 output bits flip. Type below, then <strong>click a bit of the first byte</strong> to
        flip it and watch the whole digest scramble.
      </p>
      <label className="crypto-input">
        <span>input (sandbox)</span>
        <input value={text} onChange={(e) => { setText(e.target.value); setMask(0); }} spellCheck={false} placeholder="type anything…" />
      </label>
      {err && <p className="crypto-err">⚠ {err}</p>}

      <div className="hash-perturb">
        <span className="hp-label">first byte ‘{String.fromCharCode(byte0).replace(/\s/, '␣')}’ = {byte0.toString(2).padStart(8, '0')}</span>
        <div className="bitflip small">
          {Array.from({ length: 8 }, (_, i) => {
            const bitVal = ((byte0 ^ mask) >> (7 - i)) & 1;
            const flipped = (mask >> (7 - i)) & 1;
            return (
              <button key={i} className={`bf ${bitVal ? 'on' : ''} ${flipped ? 'flipped' : ''}`} onClick={() => setMask(mask ^ (1 << (7 - i)))}>{bitVal}</button>
            );
          })}
        </div>
        {mask !== 0 && <button className="ghost small" onClick={() => setMask(0)}>reset</button>}
      </div>

      {digest && perturbed && (
        <>
          <DigestRow label="SHA-256(input)" digest={digest} />
          {mask !== 0 && <DigestRow label="SHA-256(1 bit flipped)" digest={perturbed} compare={digest} />}
          {mask !== 0 && (
            <div className="av-stat">
              <strong>{diff}/256</strong> digest bits changed ({pct}%) from flipping a single input bit — that's the
              avalanche effect, and it's why you can't guess an input from its hash.
            </div>
          )}
        </>
      )}
    </>
  );
}

function DigestRow({ label, digest, compare }: { label: string; digest: Uint8Array; compare?: Uint8Array }) {
  return (
    <div className="digest-row">
      <span className="digest-label">{label}</span>
      <div className="digest-bytes">
        {[...digest].map((b, i) => {
          const changed = compare && compare[i] !== b;
          return <code key={i} className={`db ${changed ? 'changed' : ''}`}>{b.toString(16).padStart(2, '0')}</code>;
        })}
      </div>
    </div>
  );
}

// ---- HMAC ---------------------------------------------------------------------

function HmacTool() {
  const [key, setKey] = useState('secret-key');
  const [msg, setMsg] = useState('transfer $100');
  const [mac, setMac] = useState<Uint8Array | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const m = await hmacSha256(enc(key), enc(msg));
        if (!cancelled) { setErr(null); setMac(m); }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [key, msg]);

  return (
    <>
      <h2>HMAC — proving a message wasn’t forged</h2>
      <p className="jsec-sub">
        A plain hash proves integrity but not <em>origin</em> — anyone can recompute it. HMAC mixes a shared secret
        key into SHA-256, so only someone with the key can produce a valid tag. APIs, JWTs and TLS all rely on it.
        Change the key <strong>or</strong> a single character of the message and the tag is completely different.
      </p>
      <label className="crypto-input"><span>secret key (sandbox)</span>
        <input value={key} onChange={(e) => setKey(e.target.value)} spellCheck={false} /></label>
      <label className="crypto-input"><span>message</span>
        <input value={msg} onChange={(e) => setMsg(e.target.value)} spellCheck={false} /></label>
      {err && <p className="crypto-err">⚠ {err}</p>}
      {mac && (
        <>
          <DigestRow label="HMAC-SHA-256(key, message)" digest={mac} />
          <p className="enc-note">
            The receiver, who also knows the key, recomputes this tag and compares it in constant time. No key →
            no valid tag, even though the hash algorithm itself is public.
          </p>
        </>
      )}
    </>
  );
}

// ---- Encrypt (AES-256-GCM) — the original sandbox, unchanged ------------------

interface Result {
  key: Uint8Array; iv: Uint8Array; pt: Uint8Array; ct: Uint8Array;
  tag: Uint8Array; tag2: Uint8Array; avalanche: { bits: number; total: number };
}
const TAG_LEN = 16;

function EncryptTool() {
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
        const pt2 = pt.slice();
        pt2[0] ^= 0x80;
        const buf2 = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, pt2));
        const ct = buf1.slice(0, buf1.length - TAG_LEN);
        const tag = buf1.slice(buf1.length - TAG_LEN);
        const tag2 = buf2.slice(buf2.length - TAG_LEN);
        if (!cancelled) { setErr(null); setRes({ key: rawKey, iv, pt, ct, tag, tag2, avalanche: hamming(tag, tag2) }); }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [text]);

  const recordLen = res ? res.ct.length + res.tag.length : 0;
  const pct = res ? Math.round((res.avalanche.bits / res.avalanche.total) * 100) : 0;

  return (
    <>
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
    </>
  );
}

function hamming(a: Uint8Array, b: Uint8Array): { bits: number; total: number } {
  return { bits: bitDifference(a, b), total: Math.min(a.length, b.length) * 8 };
}

function Row({ k, v, cls }: { k: string; v: string; cls?: string }) {
  return (
    <div className={`crypto-row ${cls ?? ''}`}>
      <span className="crypto-k">{k}</span>
      <code className="crypto-v">{v}</code>
    </div>
  );
}
