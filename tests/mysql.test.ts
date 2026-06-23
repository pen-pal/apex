import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { mysql } from '../src/protocols/mysql';
import { dissect } from '../src/core/engine';

// A hand-verified MySQL COM_QUERY packet (Command Phase) as a client would send
// it on a TCP/3306 connection. The 4-byte header (MySQL "Basic Packets") is
// LITTLE-ENDIAN; the spec marks payloadLength endian:'le' so the engine reads the
// true value directly. Assertions are anchored to the real wire bytes and to the
// MySQL protocol documentation.
//
// Frame layout:
//   0  1C 00 00      payload_length = 0x00001C = 28  (LE; payload that follows)
//   3  00            sequence_id    = 0  (first packet of this command)
//   4  03            COM_QUERY command tag
//   5  "select * from city limit 10"  (27 ASCII bytes of SQL)
//
// payload = 1 (0x03 tag) + 27 (SQL) = 28 bytes, matching payload_length.
const SQL = 'select * from city limit 10'; // 27 chars
const sqlBytes = [...SQL].map((c) => c.charCodeAt(0));
const payload = [0x03, ...sqlBytes]; // COM_QUERY tag + SQL text = 28 bytes
const header = [0x1c, 0x00, 0x00, 0x00]; // length 28 (LE), seq 0
const frame = [...header, ...payload];

describe('MySQL packet header dissection (Client/Server protocol, Basic Packets)', () => {
  const reg = new ProtocolRegistry();
  reg.register(mysql);

  it('parses the fixed 4-byte header and stops (no child)', () => {
    const node = dissect(frame, 'mysql', reg);
    expect(node.header.byteLength).toBe(4);
    expect(node.child).toBeNull();
  });

  it('reads payload_length little-endian (=28) and bounds the PDU', () => {
    const node = dissect(frame, 'mysql', reg);
    // Wire bytes 0x1C 0x00 0x00 read little-endian = 28.
    expect(node.header.get('payloadLength')).toBe(28);
    const f = node.header.fields.find((x) => x.field.name === 'payloadLength')!;
    expect(f.display).toBe('28');
    // The payload is bounded to exactly payload_length bytes (the COM_QUERY body).
    expect(node.payload.length).toBe(28);
    expect(node.payload).toEqual(payload);
  });

  it('reads sequence_id = 0 (first packet of the command)', () => {
    const node = dissect(frame, 'mysql', reg);
    expect(node.header.get('sequenceId')).toBe(0);
    const f = node.header.fields.find((x) => x.field.name === 'sequenceId')!;
    expect(f.display).toBe('0');
  });

  it('the payload begins with the COM_QUERY tag 0x03 and the exact SQL text', () => {
    const node = dissect(frame, 'mysql', reg);
    expect(node.payload[0]).toBe(0x03); // COM_QUERY
    const text = String.fromCharCode(...node.payload.slice(1));
    expect(text).toBe(SQL);
  });

  it('keeps a following pipelined packet out of this payload', () => {
    // Append a second packet's bytes; pduBytes must bound this packet to 4 + 28.
    const next = [0x01, 0x00, 0x00, 0x00, 0x01]; // an unrelated following packet
    const node = dissect([...frame, ...next], 'mysql', reg);
    expect(node.payload.length).toBe(28); // not 28 + 5
    expect(node.payload).toEqual(payload);
    expect(node.trailer).toEqual(next); // the trailing packet is not part of this PDU
  });

  it('field bit widths sum to exactly 4 bytes', () => {
    const totalBits = mysql.fields.reduce((s, f) => s + f.bits, 0);
    expect(totalBits).toBe(4 * 8);
  });
});
