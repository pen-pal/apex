// Redis RESP dissection test. Spec:
// https://redis.io/docs/latest/develop/reference/protocol-spec/
//
// RESP is US-ASCII text framed by CRLF (\r\n), where the first byte of every
// value is a TYPE marker. A client sends a command as an ARRAY OF BULK STRINGS.
// The capture below is the exact, canonical encoding of `GET foo` quoted by the
// Redis protocol spec:
//
//   *2\r\n$3\r\nGET\r\n$3\r\nfoo\r\n
//
// We encode that exact string to its ASCII byte values and dissect starting at
// our own layer ('redis'). Because RESP has no binary header (fields: [], and
// headerBytes() => 0), the engine consumes a 0-byte header and the ENTIRE
// message text lands in node.payload. We assert the bytes round-trip back to the
// exact command text — i.e. RESP is text-framed by CRLF, not by fixed offsets.
import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dissect } from '../src/core/engine';
import { redis } from '../src/protocols/redis';

const COMMAND_TEXT = '*2\r\n$3\r\nGET\r\n$3\r\nfoo\r\n';

// US-ASCII encode (each char is one byte; all chars here are < 0x80).
const bytes = [...COMMAND_TEXT].map((c) => c.charCodeAt(0));

const reg = new ProtocolRegistry();
reg.register(redis);

describe('Redis RESP', () => {
  it('has no fixed binary header (text-framed protocol)', () => {
    const node = dissect(bytes, 'redis', reg);
    expect(node.header.spec.fields).toHaveLength(0);
    expect(node.header.byteLength).toBe(0);
  });

  it('exposes the entire ASCII RESP message as the payload', () => {
    const node = dissect(bytes, 'redis', reg);
    // The whole segment is the payload (header consumed 0 bytes).
    expect(node.payload).toHaveLength(bytes.length);
    expect(node.payload).toEqual(bytes);
    // And it round-trips back to the exact command text.
    const decoded = String.fromCharCode(...node.payload);
    expect(decoded).toBe(COMMAND_TEXT);
  });

  it('is an array of bulk strings, CRLF-framed (per the RESP spec)', () => {
    const node = dissect(bytes, 'redis', reg);
    const decoded = String.fromCharCode(...node.payload);
    // CRLF separates every RESP part; the canonical GET foo splits into:
    // ['*2','$3','GET','$3','foo',''] (trailing '' after the final CRLF).
    const parts = decoded.split('\r\n');
    expect(parts[0]).toBe('*2');  // array of 2 elements
    expect(parts[1]).toBe('$3');  // bulk string, 3 bytes
    expect(parts[2]).toBe('GET'); // the 3-byte payload
    expect(parts[3]).toBe('$3');  // bulk string, 3 bytes
    expect(parts[4]).toBe('foo'); // the 3-byte payload
    expect(parts[5]).toBe('');    // trailing empty after final CRLF
  });

  it('begins with the array type marker, with $ bulk-string markers inside', () => {
    const node = dissect(bytes, 'redis', reg);
    // First byte is '*' (0x2a) — the array type marker.
    expect(node.payload[0]).toBe(0x2a);
    // The bulk-string markers '$' (0x24) appear at the start of each element.
    // After "*2\r\n" (4 bytes) the first element begins with '$'.
    expect(node.payload[4]).toBe(0x24);
    // 'GET' = 0x47,0x45,0x54 is visible in the raw bytes. After "*2\r\n$3\r\n"
    // (8 bytes) the 3-byte payload begins.
    expect(node.payload.slice(8, 11)).toEqual([0x47, 0x45, 0x54]);
  });

  it('stops dissecting — RESP is the application layer (no child)', () => {
    const node = dissect(bytes, 'redis', reg);
    expect(node.child).toBeNull();
  });
});
