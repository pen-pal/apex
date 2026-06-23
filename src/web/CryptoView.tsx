// Cryptography sandbox — REAL WebCrypto on sandbox values only (never a captured
// stream), across three tools:
//   • Encrypt — AES-256-GCM; shows the opaque TLS record + GCM avalanche.
//   • Hash    — SHA-256; flip one input bit and watch ~half the digest change.
//   • HMAC    — keyed SHA-256; same message + different key → unrelated tag.
// Apex never invents decrypted plaintext for real captures.
import { useEffect, useMemo, useState } from 'react';
import { sha256, hmacSha256, bitDifference } from './hashing';
import { aesEcbEncrypt, aesCbcEncrypt } from './aes';
import { pbkdf2 } from './kdf';
import { dhExchange } from './dh';
import { tls13Flow, type EncLevel } from './tls13';

const hexJoin = (b: Uint8Array) => [...b].map((x) => x.toString(16).toUpperCase().padStart(2, '0')).join(' ');
const enc = (s: string) => new TextEncoder().encode(s);

type Tool = 'encrypt' | 'hash' | 'hmac' | 'modes' | 'pbkdf2' | 'dh' | 'tls';
const TOOLS: { id: Tool; label: string }[] = [
  { id: 'encrypt', label: 'Encrypt (AES-GCM)' },
  { id: 'hash', label: 'Hash (SHA-256)' },
  { id: 'hmac', label: 'HMAC' },
  { id: 'modes', label: 'Modes (ECB vs CBC)' },
  { id: 'pbkdf2', label: 'Password hashing' },
  { id: 'dh', label: 'Key exchange (DH)' },
  { id: 'tls', label: 'TLS 1.3 handshake' },
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
        {tool === 'modes' && <ModesTool />}
        {tool === 'pbkdf2' && <Pbkdf2Tool />}
        {tool === 'dh' && <DhTool />}
        {tool === 'tls' && <TlsHandshakeTool />}
      </section>
    </div>
  );
}

// ---- TLS 1.3 handshake arc (animated sequence) --------------------------------

const ENC_LABEL: Record<EncLevel, string> = {
  plaintext: 'in the clear',
  handshake: 'encrypted · handshake keys',
  application: 'encrypted · application keys',
};

function TlsHandshakeTool() {
  const flow = useMemo(() => tls13Flow(), []);
  const [step, setStep] = useState(0); // 0 = nothing sent yet; 1..N = messages delivered
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    if (step >= flow.length) { setPlaying(false); return; }
    const id = setTimeout(() => setStep((s) => Math.min(s + 1, flow.length)), 1100);
    return () => clearTimeout(id);
  }, [playing, step, flow.length]);

  const current = step > 0 ? flow[step - 1] : null;
  const appOpen = step >= flow.length; // handshake complete, app data flowing

  return (
    <>
      <h2>TLS 1.3 handshake — one round trip to a secure channel</h2>
      <p className="jsec-sub">
        TLS 1.3 needs a single round trip. Only the two Hellos are in the clear; the moment both sides share a
        key (right after ServerHello) the <em>rest of the handshake is already encrypted</em>, and once both
        Finished messages land, application data flows under separate keys — opaque on the wire. Step through it.
      </p>

      <div className="tls-play">
        <button className="ghost small" onClick={() => { setStep(0); setPlaying(false); }}>⏮ reset</button>
        <button className="ghost small" disabled={step === 0} onClick={() => { setStep((s) => Math.max(0, s - 1)); setPlaying(false); }}>‹ back</button>
        <button className="ghost small" disabled={step >= flow.length} onClick={() => { setStep((s) => Math.min(flow.length, s + 1)); setPlaying(false); }}>next ›</button>
        <button className="ghost small" onClick={() => { if (step >= flow.length) setStep(0); setPlaying((p) => !p); }}>{playing ? '⏸ pause' : '▶ play'}</button>
        <span className="tls-progress">{step} / {flow.length}</span>
      </div>

      <div className="tls-arc">
        <div className="tls-cols"><span className="tls-actor client">Client</span><span className="tls-actor server">Server</span></div>
        <div className="tls-lane client" /><div className="tls-lane server" />
        {flow.map((m, i) => {
          const delivered = i < step;
          const active = i === step - 1;
          const dir = m.from === 'client' ? 'to-server' : 'to-client';
          return (
            <div key={m.id} className={`tls-msg ${dir} ${m.enc} ${delivered ? 'on' : ''} ${active ? 'active' : ''}`}>
              <span className="tls-arrow">{m.from === 'client' ? '→' : '←'}</span>
              <span className="tls-name">{m.name}</span>
              <span className="tls-lock">{m.enc === 'plaintext' ? '' : '🔒'}</span>
            </div>
          );
        })}
      </div>

      <div className="tls-detail">
        {current ? (
          <>
            <div className="tls-d-head">
              <strong>{current.name}</strong>
              <span className={`tls-tag ${current.enc}`}>{ENC_LABEL[current.enc]}</span>
              <span className="tls-from">{current.from} → {current.from === 'client' ? 'server' : 'client'}</span>
            </div>
            <p className="tls-purpose">{current.purpose}</p>
            {current.establishes && <div className="tls-key">🔑 {current.establishes}</div>}
          </>
        ) : <p className="tls-purpose">Press <strong>next ›</strong> to send the ClientHello.</p>}
      </div>

      {appOpen && (
        <div className="crypto-record">
          <div className="cr-title">Application data is now an opaque TLS 1.3 record — Apex shows its shape, not its plaintext:</div>
          <div className="cr-bar">
            <span className="cr-seg hdr">23</span>
            <span className="cr-seg hdr">03 03</span>
            <span className="cr-seg len">len</span>
            <span className="cr-seg op" style={{ flex: 3 }}>opaque ciphertext</span>
            <span className="cr-seg tg">tag (16B)</span>
          </div>
          <div className="cr-note">type 23 = application_data · everything after the handshake is encrypted under the application traffic keys.</div>
        </div>
      )}
    </>
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

// ---- Modes (ECB vs CBC): the structure leak -----------------------------------

// A fixed sandbox key/IV — this whole tool is about block STRUCTURE, not secrecy.
const MODE_KEY = new Uint8Array([0x2b, 0x7e, 0x15, 0x16, 0x28, 0xae, 0xd2, 0xa6, 0xab, 0xf7, 0x15, 0x88, 0x09, 0xcf, 0x4f, 0x3c]);
const MODE_IV = new Uint8Array(16);

const blockHex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');

/** Assign a stable colour to each DISTINCT block value, so repeats are visible. */
function colourBlocks(blocks: Uint8Array[]): string[] {
  const seen = new Map<string, number>();
  return blocks.map((b) => {
    const k = blockHex(b);
    if (!seen.has(k)) seen.set(k, seen.size);
    const idx = seen.get(k)!;
    return `hsl(${(idx * 71) % 360} 62% 80%)`;
  });
}

function ModesTool() {
  const [text, setText] = useState('ATTACK AT DAWN!!ATTACK AT DAWN!!ATTACK AT DAWN!!');
  const bytes = useMemo(() => enc(text.length ? text : ' '), [text]);
  const pt = useMemo(() => {
    const n = Math.ceil(Math.max(bytes.length, 1) / 16) * 16;
    const out = new Uint8Array(n); out.set(bytes);
    const blocks: Uint8Array[] = [];
    for (let i = 0; i < n; i += 16) blocks.push(out.subarray(i, i + 16));
    return blocks;
  }, [bytes]);
  const ecb = useMemo(() => aesEcbEncrypt(bytes, MODE_KEY), [bytes]);
  const cbc = useMemo(() => aesCbcEncrypt(bytes, MODE_KEY, MODE_IV), [bytes]);

  const distinctPt = new Set(pt.map(blockHex)).size;
  const distinctEcb = new Set(ecb.map(blockHex)).size;

  return (
    <>
      <h2>Cipher modes — why a block cipher isn’t enough</h2>
      <p className="jsec-sub">
        AES encrypts 16 bytes at a time. <strong>ECB</strong> mode encrypts each block independently — so two
        identical plaintext blocks become two <em>identical</em> ciphertext blocks, leaking the pattern (the famous
        “ECB penguin”). <strong>CBC</strong> mode XORs each block with the previous ciphertext first, so the same
        input never repeats. This is real AES-128 (verified against NIST vectors). Type repeated text and watch.
      </p>
      <label className="crypto-input"><span>plaintext (sandbox)</span>
        <input value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} /></label>

      <BlockRow title={`plaintext — ${pt.length} blocks, ${distinctPt} distinct`} blocks={pt} />
      <BlockRow title={`AES-ECB — ${distinctEcb} distinct ciphertext blocks (repeats leak through!)`} blocks={ecb} leak={distinctEcb < ecb.length} />
      <BlockRow title={`AES-CBC — ${new Set(cbc.map(blockHex)).size} distinct (chaining hides the pattern)`} blocks={cbc} />

      <p className="enc-note">
        Notice ECB reuses colours exactly where the plaintext repeats — an attacker learns the structure without
        ever breaking AES. CBC’s blocks are all different. This is why ECB is effectively never used, and why
        WebCrypto refuses to offer it.
      </p>
    </>
  );
}

function BlockRow({ title, blocks, leak }: { title: string; blocks: Uint8Array[]; leak?: boolean }) {
  const colours = colourBlocks(blocks);
  return (
    <div className="mode-row">
      <span className={`mode-title ${leak ? 'leak' : ''}`}>{title}</span>
      <div className="mode-blocks">
        {blocks.map((b, i) => (
          <code key={i} className="mode-block" style={{ background: colours[i] }} title={blockHex(b)}>
            {blockHex(b).slice(0, 8)}
          </code>
        ))}
      </div>
    </div>
  );
}

// ---- Password hashing (PBKDF2) ------------------------------------------------

const ITER_OPTS = [1, 1000, 100_000, 600_000];

function Pbkdf2Tool() {
  const [pw, setPw] = useState('hunter2');
  const [salt, setSalt] = useState('s4lt-per-user');
  const [iter, setIter] = useState(100_000);
  const [dk, setDk] = useState<Uint8Array | null>(null);
  const [naive, setNaive] = useState<Uint8Array | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const derived = await pbkdf2(enc(pw), enc(salt), iter, 'SHA-256', 32);
        const plain = await sha256(enc(pw)); // the WRONG way, for contrast
        if (!cancelled) { setErr(null); setDk(derived); setNaive(plain); }
      } catch (e) { if (!cancelled) setErr(e instanceof Error ? e.message : String(e)); }
    })();
    return () => { cancelled = true; };
  }, [pw, salt, iter]);

  return (
    <>
      <h2>Password hashing — PBKDF2</h2>
      <p className="jsec-sub">
        Storing <code>SHA-256(password)</code> is a classic mistake: it's fast (so brute force is cheap) and
        unsalted (so identical passwords collide and rainbow tables work). PBKDF2 fixes both — a per-user
        <strong> salt</strong> and a tunable <strong>iteration count</strong> (work factor). OWASP suggests ~600k
        iterations for PBKDF2-SHA256 today. Change the salt and the whole key changes.
      </p>
      <label className="crypto-input"><span>password (sandbox)</span>
        <input value={pw} onChange={(e) => setPw(e.target.value)} spellCheck={false} /></label>
      <label className="crypto-input"><span>salt (per user)</span>
        <input value={salt} onChange={(e) => setSalt(e.target.value)} spellCheck={false} /></label>
      <div className="hash-perturb">
        <span className="hp-label">iterations (work factor)</span>
        <div className="seg">
          {ITER_OPTS.map((n) => (
            <button key={n} className={iter === n ? 'on' : ''} onClick={() => setIter(n)}>{n.toLocaleString()}</button>
          ))}
        </div>
      </div>
      {err && <p className="crypto-err">⚠ {err}</p>}
      {dk && naive && (
        <>
          <DigestRow label={`PBKDF2-SHA256, ${iter.toLocaleString()} iterations + salt (store THIS)`} digest={dk} />
          <DigestRow label="naïve SHA-256(password) — no salt, no work factor (never store this)" digest={naive} />
          <p className="enc-note">
            The naïve hash never changes for a given password — an attacker precomputes it once and cracks every
            user who chose it. The PBKDF2 output is unique per salt and costs {iter.toLocaleString()}× more to test
            a single guess.
          </p>
        </>
      )}
    </>
  );
}

// ---- Diffie–Hellman key exchange ----------------------------------------------

function DhTool() {
  const [p, setP] = useState(23);
  const [g, setG] = useState(5);
  const [a, setA] = useState(6);
  const [b, setB] = useState(15);
  const r = useMemo(() => dhExchange(BigInt(p || 1), BigInt(g || 1), BigInt(a || 1), BigInt(b || 1)), [p, g, a, b]);

  const num = (v: number, set: (n: number) => void, label: string, hint: string) => (
    <label className="dh-field"><span>{label}</span>
      <input type="number" value={v} min={1} onChange={(e) => set(Math.max(1, parseInt(e.target.value) || 1))} />
      <em>{hint}</em>
    </label>
  );

  return (
    <>
      <h2>Diffie–Hellman — agreeing on a secret in public</h2>
      <p className="jsec-sub">
        Alice and Bob each pick a private number, exchange <code>g<sup>private</sup> mod p</code> in the clear, then
        raise the other's public value to their own private exponent. Both land on the <strong>same</strong> shared
        secret — yet an eavesdropper who sees p, g and both public values can't compute it (that's the discrete-log
        problem). Real groups are 2048+ bits; small numbers here just to watch it work.
      </p>
      <div className="dh-params">
        {num(p, setP, 'p (prime modulus)', 'public')}
        {num(g, setG, 'g (generator)', 'public')}
      </div>
      <div className="dh-grid">
        <div className="dh-party alice">
          <div className="dh-name">Alice</div>
          {num(a, setA, 'a (private)', 'secret')}
          <div className="dh-calc">A = {g}<sup>{a}</sup> mod {p} = <strong>{r.A.toString()}</strong></div>
          <div className="dh-shared">shares secret = B<sup>a</sup> mod p = <strong>{r.sharedAlice.toString()}</strong></div>
        </div>
        <div className="dh-wire">
          <div className="dh-pub">→ A = {r.A.toString()} →</div>
          <div className="dh-pub">← B = {r.B.toString()} ←</div>
          <div className="dh-eve">👁 Eve sees p, g, A, B — but not the secret</div>
        </div>
        <div className="dh-party bob">
          <div className="dh-name">Bob</div>
          {num(b, setB, 'b (private)', 'secret')}
          <div className="dh-calc">B = {g}<sup>{b}</sup> mod {p} = <strong>{r.B.toString()}</strong></div>
          <div className="dh-shared">shares secret = A<sup>b</sup> mod p = <strong>{r.sharedBob.toString()}</strong></div>
        </div>
      </div>
      <p className={r.agree ? 'ed-ok' : 'ed-bad'}>
        {r.agree
          ? `✓ both computed the same shared secret: ${r.sharedAlice.toString()} — never sent over the wire.`
          : '✗ secrets differ — check that p is prime and g is a valid generator.'}
      </p>
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
