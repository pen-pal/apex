import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dns } from '../src/protocols/dns';
import { dissect } from '../src/core/engine';

// A hand-verified DNS standard query for "www.example.com" type A, class IN.
// This is the canonical query a stub resolver sends to a recursive resolver,
// matching the layout in RFC 1035 section 4.1.1 (header) + 4.1.2 (question).
//
// Header (12 bytes):
//   0xdb42                 Transaction ID
//   0x01 0x00              Flags: QR=0, Opcode=0, AA=0, TC=0, RD=1, RA=0, Z=0, RCODE=0
//   0x0001                 QDCOUNT = 1
//   0x0000                 ANCOUNT = 0
//   0x0000                 NSCOUNT = 0
//   0x0000                 ARCOUNT = 0
// Question (variable, must fall through as payload):
//   03 'www' 07 'example' 03 'com' 00   QNAME (length-prefixed labels)
//   0x0001                 QTYPE  = A
//   0x0001                 QCLASS = IN
const query = [
  // --- 12-byte header ---
  0xdb, 0x42,
  0x01, 0x00,
  0x00, 0x01,
  0x00, 0x00,
  0x00, 0x00,
  0x00, 0x00,
  // --- question section (payload) ---
  0x03, 0x77, 0x77, 0x77,             // "www"
  0x07, 0x65, 0x78, 0x61, 0x6d, 0x70, 0x6c, 0x65, // "example"
  0x03, 0x63, 0x6f, 0x6d,             // "com"
  0x00,                               // root label (end of name)
  0x00, 0x01,                         // QTYPE = A
  0x00, 0x01,                         // QCLASS = IN
];

describe('DNS header dissection', () => {
  const reg = new ProtocolRegistry();
  reg.register(dns);

  it('parses the 12-byte fixed header per RFC 1035 4.1.1', () => {
    const node = dissect(query, 'dns', reg);
    const h = node.header;

    // Header is exactly 12 bytes regardless of what follows.
    expect(h.byteLength).toBe(12);

    // Transaction ID 0xdb42.
    expect(h.get('transactionId')).toBe(0xdb42);

    // Flags word 0x0100: only RD set.
    expect(h.get('qr')).toBe(0);
    expect(h.get('opcode')).toBe(0);
    expect(h.get('aa')).toBe(0);
    expect(h.get('tc')).toBe(0);
    expect(h.get('rd')).toBe(1);
    expect(h.get('ra')).toBe(0);
    expect(h.get('z')).toBe(0);
    expect(h.get('rcode')).toBe(0);

    // Section counts: exactly one question, nothing else.
    expect(h.get('qdcount')).toBe(1);
    expect(h.get('ancount')).toBe(0);
    expect(h.get('nscount')).toBe(0);
    expect(h.get('arcount')).toBe(0);
  });

  it('formats coded fields via their enum/decode', () => {
    const node = dissect(query, 'dns', reg);
    const f = (name: string) => node.header.fields.find((x) => x.field.name === name)!;
    expect(f('transactionId').display).toBe('0xDB42');
    expect(f('opcode').display).toBe('0 (QUERY)');
    expect(f('rcode').display).toBe('0 (NoError)');
    expect(f('qr').meaning).toBe('query (0)');
  });

  it('leaves the variable question section as payload (not modeled as fields)', () => {
    const node = dissect(query, 'dns', reg);
    // 21 bytes of question follow the 12-byte header.
    expect(node.payload.length).toBe(query.length - 12);
    // First payload byte is the length of the first label "www" = 3.
    expect(node.payload[0]).toBe(0x03);
    // Dissection stops here: DNS records are not modeled as a child layer.
    expect(node.child).toBeNull();
  });
});
