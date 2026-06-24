// HTTP/3 — HTTP over QUIC, and the QPACK header compression that makes it work
// without re-introducing head-of-line blocking. Panel 1 contrasts the stacks (h3
// folds TLS into QUIC and maps each request to its own QUIC stream); panel 2 is a
// live QPACK demo — send the same request twice and watch literal headers collapse
// into one-byte dynamic-table indices. Model in qpack.ts (tested). The transport
// HoL win itself lives in the QUIC section.
import { useState } from 'react';
import { encode, learn, type Header, type Encoded } from './qpack';

const REQUEST: Header[] = [
  { name: ':method', value: 'GET' },
  { name: ':scheme', value: 'https' },
  { name: ':path', value: '/' },
  { name: ':authority', value: 'example.com' },
  { name: 'accept', value: '*/*' },
  { name: 'user-agent', value: 'apex/1.0' },
  { name: 'cookie', value: 'sid=8f2a…' },
];

const REPR_LABEL: Record<Encoded['repr'], string> = { static: 'static idx', dynamic: 'dynamic idx', literal: 'literal' };

export function HttpThreeSection() {
  const [dyn, setDyn] = useState<Header[]>([]);
  const [sends, setSends] = useState(0);
  const { items, compressed, raw } = encode(REQUEST, dyn);
  const pct = Math.round((1 - compressed / raw) * 100);

  const send = () => { setDyn((d) => learn(REQUEST, d)); setSends((s) => s + 1); };
  const reset = () => { setDyn([]); setSends(0); };

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>① The HTTP/3 stack — HTTP over QUIC</h2></div>
        <p className="jsec-sub">
          HTTP/3 keeps HTTP’s semantics but swaps the whole transport: instead of HTTP/2 frames over TCP and a separate TLS layer,
          it runs over <strong>QUIC</strong>, which builds in TLS 1.3 and gives every request its <em>own</em> stream. A lost packet
          stalls only its stream, not all of them (the transport win is in the QUIC section). Headers move from HPACK to{' '}
          <strong>QPACK</strong>.
        </p>
        <div className="h3-stacks">
          {[
            { name: 'HTTP/2', layers: ['HTTP/2 frames + HPACK', 'TLS 1.3', 'TCP', 'IP'], cls: 'old' },
            { name: 'HTTP/3', layers: ['HTTP/3 frames + QPACK', 'QUIC (streams + TLS 1.3)', 'UDP', 'IP'], cls: 'new' },
          ].map((s) => (
            <div key={s.name} className={`h3-stack ${s.cls}`}>
              <div className="h3-stack-h">{s.name}</div>
              {s.layers.map((l, i) => <div key={i} className={`h3-layer ${i === 0 ? 'app' : ''} ${l.startsWith('QUIC') ? 'quic' : ''}`}>{l}</div>)}
            </div>
          ))}
        </div>
        <p className="h3-note">HTTP/3 also runs unidirectional <strong>control</strong> and <strong>QPACK encoder/decoder</strong> streams alongside the request streams — that separation is exactly what keeps header compression from blocking.</p>
      </section>

      <section className="jsec">
        <div className="jsec-head"><h2>② QPACK header compression</h2></div>
        <p className="jsec-sub">
          Common headers live in a fixed <strong>static table</strong> (one index byte). Anything else is sent as a <strong>literal</strong>
          the first time and inserted into a <strong>dynamic table</strong>, so the next request references it by index. Send the
          request again and watch the literals collapse.
        </p>
        <div className="h3-send">
          <button className="h3-btn" onClick={send}>▶ send request (#{sends + 1})</button>
          <button className="h3-btn ghost" onClick={reset} disabled={sends === 0}>reset</button>
          <span className="h3-ratio">{compressed} / {raw} bytes · <strong>{pct}% smaller</strong></span>
        </div>
        <div className="h3-headers">
          {items.map((it, i) => (
            <div key={i} className={`h3-hdr ${it.repr}`}>
              <span className="h3-h-name">{it.header.name}</span>
              <span className="h3-h-val">{it.header.value || '∅'}</span>
              <span className={`h3-h-repr ${it.repr}`}>{REPR_LABEL[it.repr]}{it.index !== undefined ? ` ${it.index}` : ''}</span>
              <span className="h3-h-bytes">{it.bytes}B</span>
            </div>
          ))}
        </div>
        <p className="h3-note">
          HPACK (HTTP/2) updates its dynamic table strictly in order — fine on one TCP stream, but over QUIC’s independent streams a
          missing update would block every stream waiting on it. QPACK fixes this: table inserts travel on a dedicated encoder
          stream, and each request declares the “required insert count” it depends on, so a request only blocks on the entries it
          actually needs — keeping QUIC’s no-head-of-line-blocking promise all the way up to the headers.
        </p>
      </section>
    </div>
  );
}
