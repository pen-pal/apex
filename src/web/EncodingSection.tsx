// The Encoding section — how data is represented as bytes, made interactive.
// Type and watch: UTF-8, number bases (flip a bit!), Base64 step-by-step, and
// IEEE-754 float bit layout. All transformations are real (see encoding.ts).
import { useMemo, useState } from 'react';
import { utf8Breakdown, toBases, base64Steps, float32Bits } from './encoding';
import { varintEncode, zigzagEncode, derParse, type Tlv, toAscii, percentEncode, hexdump } from './encoding2';
import { parseUrl } from './urlparse';

const hex2 = (v: number) => v.toString(16).toUpperCase().padStart(2, '0');

type Tool = 'utf8' | 'bases' | 'base64' | 'float' | 'varint' | 'der' | 'puny' | 'url' | 'urlanat' | 'hexdump';
const TOOLS: { id: Tool; label: string }[] = [
  { id: 'bases', label: 'Bits & bytes' },
  { id: 'utf8', label: 'Text → UTF-8' },
  { id: 'base64', label: 'Base64' },
  { id: 'float', label: 'Float (IEEE-754)' },
  { id: 'varint', label: 'Varint / ZigZag' },
  { id: 'der', label: 'ASN.1 / DER' },
  { id: 'puny', label: 'Punycode (IDN)' },
  { id: 'url', label: 'URL encoding' },
  { id: 'urlanat', label: 'URL anatomy' },
  { id: 'hexdump', label: 'Hexdump' },
];

export function EncodingSection() {
  const [tool, setTool] = useState<Tool>('bases');
  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head">
          <h2>Encoding — how data becomes bytes</h2>
        </div>
        <p className="jsec-sub">
          Underneath everything, a computer stores only numbers. A <strong>byte</strong> is 8 <strong>bits</strong> — eight tiny
          on/off switches — and their pattern is a number from 0 to 255. Text, colours, sound, code: all of it is just bytes,
          encoded one way or another. Pick a tab, type something, and watch it turn into the actual bytes.
        </p>
        <nav className="subtabs">
          {TOOLS.map((t) => (
            <button key={t.id} className={tool === t.id ? 'on' : ''} onClick={() => setTool(t.id)}>{t.label}</button>
          ))}
        </nav>
        {tool === 'utf8' && <Utf8Tool />}
        {tool === 'bases' && <BasesTool />}
        {tool === 'base64' && <Base64Tool />}
        {tool === 'float' && <FloatTool />}
        {tool === 'varint' && <VarintTool />}
        {tool === 'der' && <DerTool />}
        {tool === 'puny' && <PunyTool />}
        {tool === 'url' && <UrlTool />}
        {tool === 'urlanat' && <UrlAnatomyTool />}
        {tool === 'hexdump' && <HexdumpTool />}
      </section>
    </div>
  );
}

function VarintTool() {
  const [text, setText] = useState('150');
  const parsed = /^-?\d+$/.test(text.trim()) ? BigInt(text.trim()) : null;
  const unsigned = parsed !== null && parsed >= 0n;
  const varBytes = parsed !== null && parsed >= 0n ? varintEncode(parsed) : null;
  const zz = parsed !== null ? zigzagEncode(parsed) : null;
  const zzBytes = zz !== null ? varintEncode(zz) : null;
  return (
    <>
      <p className="jsec-sub">
        Protocol Buffers (and QUIC, and more) store integers as <strong>varints</strong>: 7 bits of value per byte,
        the high bit meaning “another byte follows”. Small numbers take one byte. Signed values first go through
        <strong> ZigZag</strong> so −1 becomes 1, not a huge unsigned number.
      </p>
      <input className="enc-input narrow" value={text} onChange={(e) => setText(e.target.value)} placeholder="An integer, e.g. 150 or -1" spellCheck={false} />
      {parsed === null ? <p className="enc-err">Enter an integer.</p> : (
        <div className="enc-grid">
          {unsigned && varBytes && <Row k="varint(value)" val={varBytes.map(hex2).join(' ') + `  (${varBytes.length} byte${varBytes.length === 1 ? '' : 's'})`} />}
          {!unsigned && <Row k="varint(value)" val="— negatives must use ZigZag first" />}
          <Row k="zigzag(value)" val={zz!.toString()} />
          <Row k="varint(zigzag)" val={zzBytes!.map(hex2).join(' ')} />
          {varBytes && <Row k="bits" val={varBytes.map((b) => b.toString(2).padStart(8, '0')).join(' ')} />}
        </div>
      )}
    </>
  );
}

function renderTlv(t: Tlv, depth = 0) {
  return (
    <div className="der-node" style={{ marginLeft: depth * 16 }} key={`${depth}-${t.tag}-${t.length}`}>
      <span className="der-tag">{t.tagName}</span>
      <span className="der-meta">{t.cls !== 'universal' ? `${t.cls} ` : ''}len {t.length}</span>
      {!t.constructed && <code className="der-val">{[...t.value].slice(0, 24).map(hex2).join(' ')}{t.value.length > 24 ? ' …' : ''}</code>}
      {t.children?.map((c, i) => <div key={i}>{renderTlv(c, depth + 1)}</div>)}
    </div>
  );
}

function DerTool() {
  const [text, setText] = useState('30 06 02 01 01 02 01 02');
  const result = useMemo(() => {
    try {
      const bytes = new Uint8Array(text.trim().split(/\s+/).map((h) => parseInt(h, 16)));
      if (bytes.some((b) => Number.isNaN(b))) return { err: 'Enter space-separated hex bytes.' };
      return { tlv: derParse(bytes) };
    } catch (e) { return { err: e instanceof Error ? e.message : 'Parse error.' }; }
  }, [text]);
  return (
    <>
      <p className="jsec-sub">
        ASN.1 DER is <strong>Tag–Length–Value</strong>, nested. Every X.509 certificate, PKCS key and LDAP message is
        built from it. Paste DER hex (a <code>SEQUENCE {'{'} INTEGER 1, INTEGER 2 {'}'}</code> is shown) and watch it parse.
      </p>
      <input className="enc-input" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
      {result.err ? <p className="enc-err">{result.err}</p> : <div className="der-tree">{renderTlv(result.tlv!)}</div>}
    </>
  );
}

function PunyTool() {
  const [text, setText] = useState('münchen.de');
  const ascii = useMemo(() => { try { return toAscii(text.trim()); } catch { return text; } }, [text]);
  const hasUnicode = [...text].some((c) => c.codePointAt(0)! > 0x7f);
  // crude mixed-script / confusable check for the homograph warning
  const hasCyrillic = /[Ѐ-ӿ]/.test(text);
  const hasLatin = /[a-z]/i.test(text);
  const mixed = hasCyrillic && hasLatin;
  return (
    <>
      <p className="jsec-sub">
        Domain names are ASCII, so internationalized names are encoded as <code>xn--…</code> via punycode (RFC 3492).
        This is also the <strong>homograph trap</strong>: a name using Cyrillic look-alikes can read like a brand but
        resolve somewhere else. Type a domain — its real, on-the-wire form appears below.
      </p>
      <input className="enc-input" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
      <div className="enc-grid">
        <Row k="what you see" val={text} />
        <Row k="what DNS sees (IDNA ASCII)" val={ascii} />
      </div>
      {mixed && <p className="jwt-warn">⚠ Mixed Latin + Cyrillic scripts — a classic homograph spoof. Browsers show the xn-- form to defend against this.</p>}
      {hasUnicode && !mixed && <p className="enc-note">This label is internationalized; the <code>xn--</code> form is what actually travels in DNS.</p>}
    </>
  );
}

function UrlTool() {
  const [text, setText] = useState('name=José Pérez & rôle=admin');
  return (
    <>
      <p className="jsec-sub">
        URLs may only contain a limited ASCII set, so everything else — spaces, accents, reserved characters — is
        <strong> percent-encoded</strong> as its UTF-8 bytes (RFC 3986). This is why <code>%20</code> means a space.
      </p>
      <input className="enc-input" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
      <div className="enc-grid">
        <Row k="percent-encoded" val={percentEncode(text) || '—'} />
      </div>
    </>
  );
}

function HexdumpTool() {
  const [text, setText] = useState('Apex: the bytes are real.');
  const lines = useMemo(() => hexdump(new TextEncoder().encode(text)), [text]);
  return (
    <>
      <p className="jsec-sub">
        The view every reverse-engineer lives in: byte offset, the raw hex, and the printable ASCII alongside
        (non-printable bytes shown as <code>.</code>). Type anything.
      </p>
      <input className="enc-input" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
      <pre className="hexdump">{lines.join('\n') || '—'}</pre>
    </>
  );
}

function Utf8Tool() {
  const [text, setText] = useState('café 🎉');
  const cells = useMemo(() => utf8Breakdown(text), [text]);
  const totalBytes = cells.reduce((s, c) => s + c.bytes.length, 0);
  return (
    <>
      <p className="jsec-sub">
        A character isn’t a byte. UTF-8 encodes each Unicode code point in 1–4 bytes — ASCII stays one byte,
        accented letters take two, emoji take four. Type anything and watch.
      </p>
      <input className="enc-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Type text…" spellCheck={false} />
      <div className="enc-readout">
        <span><strong>{cells.length}</strong> character{cells.length === 1 ? '' : 's'}</span>
        <span><strong>{totalBytes}</strong> byte{totalBytes === 1 ? '' : 's'}</span>
      </div>
      <div className="utf8-grid">
        {cells.map((c, i) => (
          <div key={i} className={`utf8-cell w${c.bytes.length}`}>
            <div className="u-char">{c.char === ' ' ? '␣' : c.char}</div>
            <div className="u-cp">U+{c.codepoint.toString(16).toUpperCase().padStart(4, '0')}</div>
            <div className="u-bytes">{c.bytes.map(hex2).join(' ')}</div>
            <div className="u-n">{c.bytes.length}B</div>
          </div>
        ))}
      </div>
    </>
  );
}

function BasesTool() {
  const [text, setText] = useState('200');
  const [width, setWidth] = useState<8 | 16 | 32>(8);
  const v = useMemo(() => toBases(text, width), [text, width]);

  const flip = (idx: number) => {
    if (!v.ok) return;
    const bits = v.bits.slice();
    bits[idx] ^= 1;
    // recompute as signed two's complement of the new bit pattern
    let val = 0n;
    for (const b of bits) val = (val << 1n) | BigInt(b);
    const signed = bits[0] === 1 ? val - (1n << BigInt(width)) : val;
    setText(signed.toString());
  };

  return (
    <>
      <p className="jsec-sub">
        Start at the very bottom: a byte is <strong>8 bits</strong>, and each bit is one on/off switch — a <strong>0 or a 1</strong>.
        Line them up and the pattern <em>is</em> a number. <strong>Click the switches</strong> to flip them and watch the same value
        appear in <strong>decimal</strong> (base 10, how we count), <strong>hex</strong> (base 16, how bytes are usually written), and
        <strong> binary</strong> (the bits themselves). Wider numbers use 16 or 32 bits; negatives use two’s complement.
      </p>
      <div className="enc-row">
        <input className="enc-input narrow" value={text} onChange={(e) => setText(e.target.value)} placeholder="Integer, e.g. 200 or -1" spellCheck={false} />
        <div className="seg">
          {([8, 16, 32] as const).map((w) => (
            <button key={w} className={width === w ? 'on' : ''} onClick={() => setWidth(w)}>{w}-bit</button>
          ))}
        </div>
      </div>
      {v.ok ? (
        <>
          <div className="enc-grid">
            <Row k="decimal" val={v.decimal} />
            <Row k="hex" val={v.hex} />
            <Row k="octal" val={v.octal} />
            <Row k="binary" val={v.binary} />
          </div>
          <div className="bitflip">
            {v.bits.map((b, i) => {
              const bitNo = width - 1 - i;
              return (
                <button key={i} className={`bf ${b ? 'on' : ''} ${bitNo === width - 1 ? 'sign' : ''}`} onClick={() => flip(i)} title={`bit ${bitNo}${bitNo === width - 1 ? ' (sign)' : ''}`}>
                  {b}
                </button>
              );
            })}
          </div>
          <p className="enc-note">{v.negative ? 'The top (sign) bit is 1 → negative, read as two’s complement.' : 'Top bit 0 → positive.'} Highest bit is on the left.</p>
        </>
      ) : (
        <p className="enc-err">Enter an integer (negatives allowed).</p>
      )}
    </>
  );
}

function Base64Tool() {
  const [text, setText] = useState('Man');
  const bytes = useMemo(() => [...new TextEncoder().encode(text)], [text]);
  const r = useMemo(() => base64Steps(bytes), [bytes]);
  return (
    <>
      <p className="jsec-sub">
        Base64 packs 3 bytes (24 bits) into 4 printable characters of 6 bits each — that’s why encoded data grows
        ~33% and ends in <code>=</code> padding. Each group is shown step by step.
      </p>
      <input className="enc-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Type text…" spellCheck={false} />
      <div className="enc-readout"><span className="k">output</span><code className="b64-out">{r.output || '—'}</code></div>
      <div className="b64-groups">
        {r.groups.map((g, i) => (
          <div className="b64-group" key={i}>
            <div className="b64-src">{g.bytes.map((b) => <span key={b} className="b64-byte">{hex2(b)}</span>)}</div>
            <div className="b64-bits">{g.bits.replace(/(.{6})/g, '$1 ').trim()}</div>
            <div className="b64-out-chars">
              {g.chars.map((c, j) => (
                <span key={j} className={`b64-char ${c === '=' ? 'pad' : ''}`}>
                  {c}<em>{g.indices[j] === null ? 'pad' : g.indices[j]}</em>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function FloatTool() {
  const [text, setText] = useState('0.1');
  const f = useMemo(() => float32Bits(text), [text]);
  return (
    <>
      <p className="jsec-sub">
        A 32-bit float is <strong>sign</strong> (1 bit) · <strong>exponent</strong> (8 bits, bias 127) ·
        <strong> mantissa</strong> (23 bits). This is why 0.1 isn’t exactly 0.1 — type a number and see its real bits.
      </p>
      <input className="enc-input narrow" value={text} onChange={(e) => setText(e.target.value)} placeholder="A number, e.g. 0.1" spellCheck={false} />
      {f.ok ? (
        <>
          <div className="float-bits">
            <span className="fbit sign">{f.sign}</span>
            {f.exponentBits.map((b, i) => <span key={`e${i}`} className="fbit exp">{b}</span>)}
            {f.mantissaBits.map((b, i) => <span key={`m${i}`} className="fbit man">{b}</span>)}
          </div>
          <div className="float-legend">
            <span className="fl sign">sign = {f.sign} ({f.sign ? '−' : '+'})</span>
            <span className="fl exp">exponent = {f.exponentRaw} − 127 = {f.exponentUnbiased}</span>
            <span className="fl man">mantissa (23 bits)</span>
          </div>
          <div className="enc-grid">
            <Row k="you typed" val={text} />
            <Row k="stored as" val={String(f.reconstructed)} />
            <Row k="raw hex" val={f.hex} />
          </div>
          {String(f.reconstructed) !== text.trim() && (
            <p className="enc-note">Notice the stored value differs from what you typed — that’s floating-point rounding, made visible.</p>
          )}
        </>
      ) : (
        <p className="enc-err">Enter a number (e.g. 3.14, -0.5, 1e10).</p>
      )}
    </>
  );
}

function UrlAnatomyTool() {
  const [text, setText] = useState('https://user:p%40ss@example.com:8443/docs/intro?q=two%20words&lang=en#section-3');
  const u = useMemo(() => parseUrl(text), [text]);
  return (
    <>
      <p className="jsec-sub">
        Every part of a URL has a job. Type one and watch it split into <strong>scheme · userinfo · host · port · path ·
        query · fragment</strong> (RFC 3986) — each shown raw and percent-decoded, with the query broken into key/value pairs.
      </p>
      <input className="enc-input" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} placeholder="https://example.com/path?x=1#top" />
      {!u.ok ? <p className="enc-err">{u.error}</p> : (
        <>
          <div className="url-raw">
            <span className="up scheme">{u.scheme}</span><span className="up sep">://</span>
            {u.userinfo && <><span className="up user">{u.userinfo}</span><span className="up sep">@</span></>}
            <span className="up host">{u.host}</span>
            {u.port && <><span className="up sep">:</span><span className="up port">{u.port}</span></>}
            <span className="up path">{u.path}</span>
            {u.query && <><span className="up sep">?</span><span className="up query">{u.query}</span></>}
            {u.fragment && <><span className="up sep">#</span><span className="up frag">{u.fragment}</span></>}
          </div>

          <div className="url-parts">
            <UrlPart cls="scheme" k="scheme" v={u.scheme} note="the protocol — how to talk to the host" />
            {u.userinfo && <UrlPart cls="user" k="userinfo" v={`${u.user}${u.password ? ' : ' + u.password : ''}`} note="username[:password] — deprecated and unsafe in real URLs" />}
            <UrlPart cls="host" k="host" v={u.host + (u.isPunycode ? '  ⚠ IDN/punycode' : '')} note="the server to connect to (DNS name or IP literal)" />
            <UrlPart cls="port" k="port" v={u.effectivePort != null ? `${u.effectivePort}${u.port === '' ? ' (scheme default)' : u.isDefaultPort ? ' (redundant — it is the default)' : ''}` : '—'} note="TCP port; omitted means the scheme's default" />
            <UrlPart cls="path" k="path" v={u.pathDecoded || '/'} note={u.path !== u.pathDecoded ? `raw: ${u.path}` : 'the resource on the host'} />
            {u.fragment && <UrlPart cls="frag" k="fragment" v={u.fragmentDecoded} note="client-only anchor — never sent to the server" />}
          </div>

          {u.params.length > 0 && (
            <div className="url-query">
              <div className="url-q-head">query parameters</div>
              {u.params.map((p, i) => (
                <div className="url-q-row" key={i}>
                  <code className="url-q-k">{p.key}</code><span className="url-q-eq">=</span><code className="url-q-v">{p.value}</code>
                  {p.rawValue !== p.value && <span className="url-q-raw">raw: {p.rawValue}</span>}
                </div>
              ))}
            </div>
          )}
          {u.isPunycode && <p className="jwt-warn">⚠ The host is in punycode (xn--…), i.e. an internationalized name. Confirm it’s the brand you expect — homograph spoofs hide here.</p>}
        </>
      )}
    </>
  );
}

function UrlPart({ cls, k, v, note }: { cls: string; k: string; v: string; note: string }) {
  return (
    <div className="url-part">
      <span className={`url-badge ${cls}`}>{k}</span>
      <code className="url-val">{v || '—'}</code>
      <span className="url-note">{note}</span>
    </div>
  );
}

function Row({ k, val }: { k: string; val: string }) {
  return (
    <div className="enc-line"><span className="k">{k}</span><code>{val}</code></div>
  );
}
