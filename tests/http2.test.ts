import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dissect } from '../src/core/engine';
import { http2 } from '../src/protocols/http2';

// A real HTTP/2 empty SETTINGS frame (RFC 7540 §4.1, §6.5). This is the very
// first frame every endpoint sends after the connection preface; an empty
// SETTINGS frame (no settings, hence Length 0) is what curl/nghttp2 emit when
// all defaults are accepted. Bytes anchored to RFC 7540, not to our output.
//
// Frame header (9 bytes):
//   Length   00 00 00   -> 0     (payload length; the 9-byte header is excluded)
//   Type     04         -> 4     SETTINGS
//   Flags    00         -> 0x00  (no ACK)
//   R+StreamID  00 00 00 00 -> R=0, Stream Identifier = 0 (connection control)
const settingsFrame = [0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00];

// The first bytes of the NEXT frame on the same connection (a WINDOW_UPDATE
// header start). Used only to prove pduBytes stops this frame at byte 9.
const nextFrameStart = [0x00, 0x00, 0x04, 0x08, 0x00];

describe('HTTP/2 frame header dissection', () => {
  const reg = new ProtocolRegistry();
  reg.register(http2);

  it('parses the fixed 9-byte SETTINGS frame header', () => {
    const node = dissect(settingsFrame, 'http2', reg);
    const h = node.header;
    expect(h.byteLength).toBe(9);
    // Length 0: an empty SETTINGS frame carries no payload.
    expect(h.get('length')).toBe(0);
    // Type 4 = SETTINGS.
    expect(h.get('type')).toBe(4);
    expect(h.fields.find((f) => f.field.name === 'type')!.meaning).toBe('SETTINGS');
    // Flags 0x00 (no ACK).
    expect(h.get('flags')).toBe(0x00);
    // Reserved R bit clear; Stream Identifier 0 = connection-level.
    expect(h.get('reserved')).toBe(0);
    expect(h.get('streamIdentifier')).toBe(0);
  });

  it('bounds the PDU to 9 + Length so the next frame does not leak in', () => {
    const node = dissect([...settingsFrame, ...nextFrameStart], 'http2', reg);
    // Length 0 -> pduBytes = 9, so payload is empty even though more bytes follow.
    expect(node.payload.length).toBe(0);
    expect(node.trailer).toEqual(nextFrameStart);
    // No generic child protocol for the (HPACK/opaque) frame payload.
    expect(http2.next!(node.header, reg)).toBeNull();
  });

  it('reads a non-zero Length and an odd client stream identifier', () => {
    // A HEADERS frame (type 1) on client stream 1, Length 5, END_HEADERS|END_STREAM
    // flags (0x4 | 0x1 = 0x5), followed by 5 payload bytes.
    //   Length 00 00 05, Type 01, Flags 05, StreamID 00 00 00 01
    const headers = [0x00, 0x00, 0x05, 0x01, 0x05, 0x00, 0x00, 0x00, 0x01];
    const payload = [0x82, 0x86, 0x84, 0x41, 0x00]; // arbitrary HPACK bytes
    const node = dissect([...headers, ...payload], 'http2', reg);
    const h = node.header;
    expect(h.get('length')).toBe(5);
    expect(h.get('type')).toBe(1);
    expect(h.fields.find((f) => f.field.name === 'type')!.meaning).toBe('HEADERS');
    expect(h.get('flags')).toBe(0x05);
    expect(h.get('streamIdentifier')).toBe(1); // odd => client-initiated
    // pduBytes = 9 + 5 = 14; the 5 payload bytes are the (HPACK) header block.
    expect(node.payload).toEqual(payload);
  });
});
