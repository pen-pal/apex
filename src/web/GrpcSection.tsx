// gRPC, made visible. Build a request message and watch it become protobuf bytes
// (tag → length → value, varints and all), get wrapped in the gRPC length prefix, and
// ride inside an HTTP/2 stream's DATA frame with the trailing grpc-status. Real
// encoding (grpcmsg.ts, verified to the canonical vectors). Ties to the HTTP/2 section.
import { useState } from 'react';
import { encodeMessage, grpcFrame, wireName, type ProtoField } from './grpcmsg';

const hx = (b: number) => b.toString(16).padStart(2, '0');
const ascii = (b: number) => (b >= 32 && b < 127 ? String.fromCharCode(b) : '·');
const decodeVarint = (bytes: number[]) => bytes.reduce((n, b, i) => n + (b & 0x7f) * Math.pow(128, i), 0);

const MODES = [
  { name: 'unary', d: '1 request → 1 response' },
  { name: 'server-streaming', d: '1 request → many responses' },
  { name: 'client-streaming', d: 'many requests → 1 response' },
  { name: 'bidirectional', d: 'many ⇄ many, interleaved' },
];

export function GrpcSection() {
  const [name, setName] = useState('Alice');
  const [id, setId] = useState(150);

  const fields: ProtoField[] = [{ field: 1, type: 'string', value: name }, { field: 2, type: 'int', value: id }];
  const msg = encodeMessage(fields);
  const frame = grpcFrame(msg.bytes);

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>① The message → protobuf bytes</h2></div>
        <p className="jsec-sub">
          A protobuf message is just fields back-to-back. Each starts with a <strong>tag</strong> = (field-number ≪ 3 | wire-type):
          integers are <strong>varints</strong> (base-128, high bit = “more”), strings are length-delimited. Compact and schema-driven
          — no field names on the wire.
        </p>
        <div className="grpc-schema">message HelloRequest {'{'} string name = 1; int32 id = 2; {'}'}</div>
        <div className="grpc-inputs">
          <label>name <input value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label>id <input type="number" value={id} onChange={(e) => setId(Math.max(0, Number(e.target.value) || 0))} /></label>
        </div>
        <div className="grpc-fields">
          {msg.fields.map((f) => (
            <div key={f.field} className="grpc-field">
              <code className="grpc-tag">{hx(f.tagByte)}</code>
              <span className="grpc-meta">field {f.field} · {wireName(f.wireType)}</span>
              {f.lenBytes.length > 0 && <><code className="grpc-len">{f.lenBytes.map(hx).join(' ')}</code><span className="grpc-meta">len {f.valueBytes.length}</span></>}
              <span className="grpc-val">{f.valueBytes.map((b, bi) => <code key={bi} className="grpc-b">{hx(b)}</code>)}</span>
              <span className="grpc-ascii">{f.wireType === 2 ? '“' + f.valueBytes.map(ascii).join('') + '”' : `= ${decodeVarint(f.valueBytes)}`}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="jsec">
        <div className="jsec-head"><h2>② gRPC frame → HTTP/2 stream</h2></div>
        <p className="jsec-sub">
          gRPC prefixes each message with a 1-byte compressed flag and a 4-byte big-endian length, then carries it in an HTTP/2
          DATA frame on its own stream. The result code rides in HTTP/2 <strong>trailers</strong> after the data.
        </p>
        <div className="grpc-frame">
          <span className="grpc-fpart flag" title="compressed flag">{hx(frame[0])}</span>
          <span className="grpc-fpart len" title="4-byte length">{[...frame.slice(1, 5)].map(hx).join(' ')}</span>
          <span className="grpc-fpart body" title="protobuf message">{[...frame.slice(5)].map((b) => hx(b)).join(' ')}</span>
        </div>
        <div className="grpc-h2">
          <div className="grpc-h2row head"><span>HEADERS</span> :method POST · :path /helloworld.Greeter/SayHello · content-type application/grpc</div>
          <div className="grpc-h2row data"><span>DATA</span> ← the {frame.length}-byte gRPC frame above</div>
          <div className="grpc-h2row trail"><span>TRAILERS</span> grpc-status: 0 (OK)</div>
        </div>
      </section>

      <section className="jsec">
        <div className="jsec-head"><h2>③ Four call types, one stream model</h2></div>
        <p className="jsec-sub">Because each call is an HTTP/2 stream, gRPC gets streaming for free in both directions.</p>
        <div className="grpc-modes">
          {MODES.map((m) => <div key={m.name} className="grpc-mode"><strong>{m.name}</strong><span>{m.d}</span></div>)}
        </div>
        <p className="grpc-foot">
          That HTTP/2 foundation is why gRPC multiplexes many calls over one connection with no head-of-line blocking at the app
          layer, and why gRPC-Web needs a proxy (browsers can’t expose trailers or raw HTTP/2 frames). Protobuf’s schema-on-both-ends
          is what lets the wire format drop field names entirely.
        </p>
      </section>
    </div>
  );
}
