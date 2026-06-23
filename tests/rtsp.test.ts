// RTSP 1.0 dissection test. RFC 2326 §6.1 — an RTSP request is US-ASCII text:
//   Request-Line = Method SP Request-URI SP RTSP-Version CRLF
//   *( message-header CRLF ) CRLF [ message-body ]
//
// The capture below is a real RTSP DESCRIBE request as it appears in the TCP
// payload to an RTSP server on port 554 (this exact form is shown in RFC 2326
// §10.2 and is what tools like VLC/ffmpeg/live555 emit):
//
//   DESCRIBE rtsp://example.com/stream RTSP/1.0\r\nCSeq: 1\r\n\r\n
//
// We encode that exact string to ASCII and dissect starting at our own layer
// ('rtsp'). Because RTSP has no binary header (fields: [], headerBytes() => 0),
// the engine consumes a 0-byte header and the ENTIRE message text lands in
// node.payload. We assert the bytes round-trip back to the exact request text —
// i.e. RTSP is text-framed by CRLF, not by fixed offsets.
import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dissect } from '../src/core/engine';
import { rtsp } from '../src/protocols/rtsp';

const REQUEST_TEXT = 'DESCRIBE rtsp://example.com/stream RTSP/1.0\r\nCSeq: 1\r\n\r\n';

// US-ASCII encode (each char is one byte; all chars here are < 0x80).
const bytes = [...REQUEST_TEXT].map((c) => c.charCodeAt(0));

const reg = new ProtocolRegistry();
reg.register(rtsp);

describe('RTSP 1.0 (RFC 2326)', () => {
  it('has no fixed binary header (text-framed protocol)', () => {
    const node = dissect(bytes, 'rtsp', reg);
    expect(node.header.spec.fields).toHaveLength(0);
    expect(node.header.byteLength).toBe(0);
  });

  it('exposes the entire ASCII message as the payload', () => {
    const node = dissect(bytes, 'rtsp', reg);
    expect(node.payload).toHaveLength(bytes.length);
    expect(node.payload).toEqual(bytes);
    const decoded = String.fromCharCode(...node.payload);
    expect(decoded).toBe(REQUEST_TEXT);
  });

  it('is framed by CRLF: Request-Line, CSeq header, blank line (RFC 2326 §6.1)', () => {
    const node = dissect(bytes, 'rtsp', reg);
    const decoded = String.fromCharCode(...node.payload);
    const lines = decoded.split('\r\n');
    // Request-Line = Method SP Request-URI SP RTSP-Version (RFC 2326 §6.1)
    expect(lines[0]).toBe('DESCRIBE rtsp://example.com/stream RTSP/1.0');
    const [method, uri, version] = lines[0].split(' ');
    expect(method).toBe('DESCRIBE'); // one of the RTSP methods, RFC 2326 §10
    expect(uri).toBe('rtsp://example.com/stream'); // Request-URI
    expect(version).toBe('RTSP/1.0'); // RTSP-Version, RFC 2326 §3.1
    // CSeq header echoed by the response, RFC 2326 §12.17
    expect(lines[1]).toBe('CSeq: 1');
    // blank line ends the headers (no body on this request)
    expect(lines[2]).toBe('');
    // The byte view sees real ASCII: 'D','E','S' = 0x44,0x45,0x53.
    expect(node.payload.slice(0, 3)).toEqual([0x44, 0x45, 0x53]);
  });

  it('stops dissecting — the media flows separately over RTP (no child)', () => {
    const node = dissect(bytes, 'rtsp', reg);
    expect(node.child).toBeNull();
  });
});
