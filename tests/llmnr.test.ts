import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { llmnr } from '../src/protocols/llmnr';
import { dissect } from '../src/core/engine';

// A hand-verified LLMNR standard query for the single-label name "wpad",
// type A (1), class IN (1). This is the canonical LLMNR query a Windows host
// multicasts to 224.0.0.252:5355, matching RFC 4795 section 2.1.1 (header) plus
// the DNS-format question (RFC 1035 4.1.2) that LLMNR reuses.
//
// Header (12 bytes, RFC 4795 2.1.1):
//   0xa1b2                 ID
//   0x00 0x00              Flags: QR=0, Opcode=0, C=0, TC=0, T=0, Z=0, RCODE=0
//   0x0001                 QDCOUNT = 1 (LLMNR mandates exactly one question)
//   0x0000                 ANCOUNT = 0
//   0x0000                 NSCOUNT = 0
//   0x0000                 ARCOUNT = 0
// Question (variable, falls through as payload):
//   04 'wpad' 00           QNAME (length-prefixed labels; LLMNR uses single label)
//   0x0001                 QTYPE  = A
//   0x0001                 QCLASS = IN
const query = [
  // --- 12-byte header ---
  0xa1, 0xb2,
  0x00, 0x00,
  0x00, 0x01,
  0x00, 0x00,
  0x00, 0x00,
  0x00, 0x00,
  // --- question section (payload) ---
  0x04, 0x77, 0x70, 0x61, 0x64, // "wpad"
  0x00,                         // root label (end of name)
  0x00, 0x01,                   // QTYPE = A
  0x00, 0x01,                   // QCLASS = IN
];

describe('LLMNR header dissection', () => {
  const reg = new ProtocolRegistry();
  reg.register(llmnr);

  it('parses the 12-byte fixed header per RFC 4795 section 2.1.1', () => {
    const node = dissect(query, 'llmnr', reg);
    const h = node.header;

    // Header is exactly 12 bytes regardless of what follows.
    expect(h.byteLength).toBe(12);

    // ID 0xa1b2.
    expect(h.get('transactionId')).toBe(0xa1b2);

    // Flags word 0x0000: every flag bit clear (a plain query).
    expect(h.get('qr')).toBe(0);
    expect(h.get('opcode')).toBe(0);
    expect(h.get('c')).toBe(0);
    expect(h.get('tc')).toBe(0);
    expect(h.get('t')).toBe(0);
    expect(h.get('z')).toBe(0);
    expect(h.get('rcode')).toBe(0);

    // Section counts: exactly one question (LLMNR mandates QDCOUNT=1), nothing else.
    expect(h.get('qdcount')).toBe(1);
    expect(h.get('ancount')).toBe(0);
    expect(h.get('nscount')).toBe(0);
    expect(h.get('arcount')).toBe(0);
  });

  it('decodes the LLMNR-specific flag bits at their exact positions', () => {
    // Build a response flags word that exercises the bits LLMNR redefines:
    //   QR=1, Opcode=0, C=1 (conflict), TC=0, T=1 (tentative), Z=0, RCODE=0.
    // Bit layout MSB-first in the 16-bit word:
    //   QR(1) Op(4) C(1) TC(1) T(1) Z(4) RCODE(4)
    //   1 0000 1 0 1 0000 0000 = 0b1000_0101_0000_0000 = 0x8500
    const resp = [
      0xa1, 0xb2,
      0x85, 0x00, // flags 0x8500
      0x00, 0x01,
      0x00, 0x01,
      0x00, 0x00,
      0x00, 0x00,
    ];
    const h = dissect(resp, 'llmnr', reg).header;
    expect(h.get('qr')).toBe(1);
    expect(h.get('opcode')).toBe(0);
    expect(h.get('c')).toBe(1);
    expect(h.get('tc')).toBe(0);
    expect(h.get('t')).toBe(1);
    expect(h.get('z')).toBe(0);
    expect(h.get('rcode')).toBe(0);
  });

  it('formats coded fields via their enum/decode', () => {
    const node = dissect(query, 'llmnr', reg);
    const f = (name: string) => node.header.fields.find((x) => x.field.name === name)!;
    expect(f('transactionId').display).toBe('0xA1B2');
    expect(f('opcode').display).toBe('0 (QUERY)');
    expect(f('rcode').display).toBe('0 (NoError)');
    expect(f('qr').meaning).toBe('query (0)');
    expect(f('c').meaning).toBe('no conflict (0)');
  });

  it('leaves the variable question section as payload and stops dissecting', () => {
    const node = dissect(query, 'llmnr', reg);
    // The question follows the 12-byte header as raw payload.
    expect(node.payload.length).toBe(query.length - 12);
    // First payload byte is the length of the label "wpad" = 4.
    expect(node.payload[0]).toBe(0x04);
    // LLMNR records use DNS name encoding, not a fixed grid: dissection stops.
    expect(node.child).toBeNull();
  });
});
