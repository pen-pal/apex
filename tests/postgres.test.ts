import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { postgres } from '../src/protocols/postgres';
import { dissect } from '../src/core/engine';

// A hand-verified PostgreSQL v3 simple-Query message ('Q'), as a frontend sends
// to run a SQL command (PostgreSQL "Message Formats": Byte1('Q'), Int32 length,
// String query). Anchored to the protocol spec and to the literal ASCII bytes.
//
// Wire bytes (big-endian, network order):
//   0  51                       messageType = 'Q' (0x51) Query
//   1  00 00 00 0E              length = 14  (Int32, big-endian)
//   5  53 45 4C 45 43 54 20 31 3B 00   body = "SELECT 1;\0"  (10 bytes)
//
// LENGTH CHECK (PostgreSQL "Overview": length counts itself but NOT the type
// byte):  length 14 = 4 (the length field) + 10 (the "SELECT 1;\0" body).
// Whole message on the wire = 1 (type) + 14 = 15 bytes.
const queryBody = [0x53, 0x45, 0x4c, 0x45, 0x43, 0x54, 0x20, 0x31, 0x3b, 0x00]; // "SELECT 1;\0"
const frame = [
  0x51, // 'Q'
  0x00, 0x00, 0x00, 0x0e, // length = 14
  ...queryBody,
];

describe("PostgreSQL v3 Query message dissection (PostgreSQL 'Message Formats')", () => {
  const reg = new ProtocolRegistry();
  reg.register(postgres);

  it('parses the fixed 5-byte header and stops (no child)', () => {
    const node = dissect(frame, 'postgres', reg);
    expect(node.header.byteLength).toBe(5);
    expect(node.child).toBeNull();
  });

  it("identifies the message type as Query ('Q' = 0x51)", () => {
    const node = dissect(frame, 'postgres', reg);
    expect(node.header.get('messageType')).toBe(0x51);
    const f = node.header.fields.find((x) => x.field.name === 'messageType')!;
    expect(f.meaning).toContain("Query ('Q')");
    expect(f.meaning).toContain("0x51");
    expect(f.meaning).toContain("'Q'");
  });

  it('reads the big-endian Int32 length = 14', () => {
    const node = dissect(frame, 'postgres', reg);
    // Wire bytes 00 00 00 0E, big-endian = 14.
    expect(node.header.get('length')).toBe(14);
    const f = node.header.fields.find((x) => x.field.name === 'length')!;
    // 14 = 4 length bytes + 10 body bytes; whole message = 15.
    expect(f.meaning).toContain('10 body bytes');
    expect(f.meaning).toContain('15 bytes');
  });

  it('bounds the PDU to 1 + length bytes (type byte is OUTSIDE the length)', () => {
    const node = dissect(frame, 'postgres', reg);
    // pduBytes = 1 + length = 1 + 14 = 15 = the whole frame. The body
    // ("SELECT 1;\0") falls through as the payload; nothing leaks past it.
    expect(node.payload).toEqual(queryBody);
    expect(node.trailer).toEqual([]);
  });

  it('does not let a following concatenated message leak into the payload', () => {
    // PostgreSQL streams messages back-to-back; append a Terminate ('X', len 4).
    const next = [0x58, 0x00, 0x00, 0x00, 0x04];
    const node = dissect([...frame, ...next], 'postgres', reg);
    // This message is still bounded to its own 15 bytes; the trailing Terminate
    // is a separate message, surfaced as the trailer, not part of the payload.
    expect(node.header.byteLength).toBe(5);
    expect(node.payload).toEqual(queryBody);
    expect(node.trailer).toEqual(next);
  });

  it("the body round-trips to the exact ASCII SQL string", () => {
    const node = dissect(frame, 'postgres', reg);
    const text = String.fromCharCode(...node.payload);
    expect(text).toBe('SELECT 1;\0');
  });

  it('header field bit widths sum to exactly 5 bytes', () => {
    const totalBits = postgres.fields.reduce((s, f) => s + f.bits, 0);
    expect(totalBits).toBe(5 * 8);
  });
});
