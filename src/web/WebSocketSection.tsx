// WebSocket, made visible. Watch a plain HTTP request upgrade into a full-duplex
// channel: the server proves it speaks WebSocket by hashing your key with the magic
// GUID into Sec-WebSocket-Accept, then messages flow as small framed packets with a
// FIN/opcode byte, a mask bit + length, and (client→server) an XOR mask. Real RFC 6455
// computation (websocketws.ts, verified to the spec vector).
import { useState } from 'react';
import { accept, buildFrame, maskPayload, OPCODES, WS_GUID, base64 } from './websocketws';

const hx = (b: number) => b.toString(16).padStart(2, '0');
const randKey = () => base64(Uint8Array.from({ length: 16 }, () => Math.floor(Math.random() * 256)));

export function WebSocketSection() {
  const [key, setKey] = useState('dGhlIHNhbXBsZSBub25jZQ==');
  const [opcode, setOpcode] = useState(0x1);
  const [text, setText] = useState('hi!');
  const acc = accept(key);

  const payload = new TextEncoder().encode(text);
  const maskKey = Uint8Array.from([0x37, 0xfa, 0x21, 0x3d]);
  const frame = buildFrame(opcode, payload, maskKey);
  const masked = maskPayload(payload, maskKey);

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>① The upgrade handshake</h2></div>
        <p className="jsec-sub">
          A WebSocket starts as an ordinary HTTP request with <code>Upgrade: websocket</code> and a random{' '}
          <strong>Sec-WebSocket-Key</strong>. The server replies <strong>101 Switching Protocols</strong> and proves it really
          speaks WebSocket by returning <code>Sec-WebSocket-Accept = base64(SHA-1(key + GUID))</code> — a fixed challenge so a confused
          HTTP server or cache can’t be tricked into the handshake. Then the same TCP connection becomes a two-way message channel.
        </p>
        <div className="wsk-key">
          <label>Sec-WebSocket-Key <input value={key} onChange={(e) => setKey(e.target.value)} /></label>
          <button onClick={() => setKey(randKey())}>↻ random</button>
        </div>
        <div className="wsk-http">
          <div className="wsk-req">
            <div className="wsk-h">client → server</div>
            <pre>GET /chat HTTP/1.1{'\n'}Host: example.com{'\n'}Upgrade: websocket{'\n'}Connection: Upgrade{'\n'}Sec-WebSocket-Key: {key}{'\n'}Sec-WebSocket-Version: 13</pre>
          </div>
          <div className="wsk-res">
            <div className="wsk-h">server → client</div>
            <pre>HTTP/1.1 101 Switching Protocols{'\n'}Upgrade: websocket{'\n'}Connection: Upgrade{'\n'}Sec-WebSocket-Accept: <span className="wsk-accept">{acc}</span></pre>
          </div>
        </div>
        <div className="wsk-calc">accept = base64( SHA-1( key ‖ <span className="wsk-guid">{WS_GUID}</span> ) ) = <code>{acc}</code></div>
      </section>

      <section className="jsec">
        <div className="jsec-head"><h2>② Frames — small, typed, masked</h2></div>
        <p className="jsec-sub">
          After the upgrade, every message is a frame: a <strong>FIN</strong> bit + 4-bit <strong>opcode</strong>, a <strong>mask</strong>
          bit + 7-bit length, an optional 4-byte masking key, then the payload. Client→server payloads are XOR-masked (a defense
          against proxy cache poisoning); server→client frames are not.
        </p>
        <div className="wsk-controls">
          <label>opcode
            <select value={opcode} onChange={(e) => setOpcode(Number(e.target.value))}>
              {[0x1, 0x2, 0x9, 0x8].map((o) => <option key={o} value={o}>0x{o.toString(16)} {OPCODES[o]}</option>)}
            </select>
          </label>
          <label>payload <input value={text} onChange={(e) => setText(e.target.value)} /></label>
        </div>
        <div className="wsk-frame">
          <span className="wsk-fpart fin" title={`FIN=1, opcode=0x${opcode.toString(16)}`}>{hx(frame.bytes[0])}<i>FIN+op</i></span>
          <span className="wsk-fpart len" title={`MASK=1, len=${frame.len}`}>{hx(frame.bytes[1])}<i>mask+len</i></span>
          <span className="wsk-fpart mk">{[...maskKey].map(hx).join(' ')}<i>mask key</i></span>
          <span className="wsk-fpart pl">{[...masked].map(hx).join(' ')}<i>masked payload</i></span>
        </div>
        <div className="wsk-unmask">unmasked: <code>{[...payload].map(hx).join(' ')}</code> = “{text}” (server XORs the payload back with the mask key)</div>
        <p className="wsk-foot">
          That’s the whole protocol: one upgrade, then bidirectional frames with ping/pong keepalives and a close handshake. It’s why
          chat, live dashboards and multiplayer games use it instead of polling — the server can push the instant it has data, over a
          single long-lived connection. (HTTP/2 and /3 add their own server-push and streams, but WebSocket remains the simplest
          full-duplex pipe.)
        </p>
      </section>
    </div>
  );
}
