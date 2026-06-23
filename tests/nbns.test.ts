import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dissect } from '../src/core/engine';
import { nbns } from '../src/protocols/nbns';

// A real broadcast NetBIOS name query (NBT-NS over UDP 137), the kind a Windows
// b-node sends to resolve a name on the LAN. Hand-verified against RFC 1002 §4.2.1.1.
//
// 12-byte header:
//   TRN_ID   = 0x830A
//   flags    = 0x0110  -> R=0 (request), OPCODE=0 (query),
//                         NM_FLAGS=0b0010001 (RD=1, B=1), RCODE=0
//   QDCOUNT  = 0x0001  (one question)
//   ANCOUNT  = 0x0000
//   NSCOUNT  = 0x0000
//   ARCOUNT  = 0x0000
// Then the question section: a 32-byte RFC 1001 second-level-encoded NetBIOS name
// preceded by a length byte 0x20, terminated by 0x00, then QTYPE=0x0020 (NB),
// QCLASS=0x0001 (IN). The name here is "CKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" — the
// encoding of a name padded with spaces (0x20 -> 'CA' ... 'AA'); we don't dissect
// it, it just falls to the payload.
const header = [
  0x83, 0x0a, // transaction id
  0x01, 0x10, // flags
  0x00, 0x01, // qdcount
  0x00, 0x00, // ancount
  0x00, 0x00, // nscount
  0x00, 0x00, // arcount
];

// Question section (encoded name + type + class) — not modelled, lands in payload.
const question = [
  0x20, // length of encoded name = 32
  0x43, 0x4b, // 'C','K'
  ...new Array(30).fill(0x41), // 'A' x 30
  0x00, // name terminator
  0x00, 0x20, // QUESTION_TYPE = NB
  0x00, 0x01, // QUESTION_CLASS = IN
];

describe('NetBIOS-NS (NBNS) dissection', () => {
  const reg = new ProtocolRegistry();
  reg.register(nbns);

  it('parses the 12-byte header fields per RFC 1002', () => {
    const node = dissect([...header, ...question], 'nbns', reg);
    const h = node.header;
    expect(h.byteLength).toBe(12);
    expect(h.get('transactionId')).toBe(0x830a);
    expect(h.get('response')).toBe(0); // R bit clear -> request
    expect(h.get('opcode')).toBe(0); // query
    expect(h.get('nmFlags')).toBe(0x11); // 0b0010001 -> RD + B
    expect(h.get('rcode')).toBe(0);
    expect(h.get('qdcount')).toBe(1);
    expect(h.get('ancount')).toBe(0);
    expect(h.get('nscount')).toBe(0);
    expect(h.get('arcount')).toBe(0);
  });

  it('decodes the response and opcode meanings', () => {
    const node = dissect([...header, ...question], 'nbns', reg);
    const f = (name: string) => node.header.fields.find((x) => x.field.name === name)!;
    expect(f('response').meaning).toBe('request');
    expect(f('opcode').meaning).toBe('query');
  });

  it('decodes the broadcast + recursion-desired flag bits', () => {
    const node = dissect([...header, ...question], 'nbns', reg);
    const nm = node.header.fields.find((x) => x.field.name === 'nmFlags')!;
    // type 'flags' formats set bits by their flagBits labels
    expect(nm.display).toContain('RD');
    expect(nm.display).toContain('B');
    expect(nm.display).not.toContain('AA');
    expect(nm.display).not.toContain('RA');
  });

  it('leaves the encoded-name question section in the payload and stops dissecting', () => {
    const node = dissect([...header, ...question], 'nbns', reg);
    expect(node.payload.length).toBe(question.length);
    expect(node.payload[0]).toBe(0x20); // encoded-name length byte
    expect(node.child).toBeNull(); // next() returns null
  });
});
