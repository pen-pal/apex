import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { ldap } from '../src/protocols/ldap';
import { dissect } from '../src/core/engine';

// A hand-verified LDAPv3 anonymous simple BindRequest, encoded in ASN.1 BER per
// RFC 4511. This is exactly what a client emits for an anonymous bind:
// messageID 1, version 3, empty DN, simple authentication with empty password.
//
// Full BER TLV breakdown:
//   30 0c                          SEQUENCE, length 0x0c = 12 bytes (short form)  -- LDAPMessage
//     02 01 01                     INTEGER  len 1  value 1   -> messageID = 1
//     60 07                        [APPLICATION 0] BindRequest, length 7
//       02 01 03                   INTEGER  len 1  value 3   -> version = 3 (LDAPv3)
//       04 00                      OCTET STRING len 0        -> name = "" (empty DN)
//       80 00                      [0] OCTET STRING len 0    -> simple auth = "" (anonymous)
//
// Tag-byte check (RFC 4511): BindRequest is [APPLICATION 0] SEQUENCE. APPLICATION
// class = 0b01, constructed = 1, number = 0: 0b01 1 00000 = 0x60.
//
// Apex models only the fixed 5-byte outer wrapper: the SEQUENCE tag+length and
// the messageID INTEGER TLV. Everything from the protocolOp (0x60) onward is the
// BER payload.
const bindRequest = [
  // --- modeled 5-byte wrapper ---
  0x30, 0x0c, // SEQUENCE, 12 bytes
  0x02, 0x01, 0x01, // INTEGER len 1 value 1 (messageID = 1)
  // --- payload: protocolOp = BindRequest [APPLICATION 0] ---
  0x60, 0x07, // BindRequest, 7 bytes
  0x02, 0x01, 0x03, // version INTEGER = 3
  0x04, 0x00, // name OCTET STRING "" (empty DN)
  0x80, 0x00, // [0] simple authentication "" (anonymous)
];

describe('LDAP outer-wrapper dissection', () => {
  const reg = new ProtocolRegistry();
  reg.register(ldap);

  it('parses the fixed 5-byte SEQUENCE + messageID INTEGER per RFC 4511', () => {
    const node = dissect(bindRequest, 'ldap', reg);
    const h = node.header;

    // Header is exactly the 5 fixed wrapper bytes.
    expect(h.byteLength).toBe(5);

    // Outer SEQUENCE tag and short-form length.
    expect(h.get('seqTag')).toBe(0x30);
    expect(h.get('seqLen')).toBe(0x0c); // 12 bytes of contents

    // messageID INTEGER TLV: tag 0x02, length 1, value 1.
    expect(h.get('msgIdTag')).toBe(0x02);
    expect(h.get('msgIdLen')).toBe(1);
    expect(h.get('messageId')).toBe(1);
  });

  it('formats coded fields via their type/decode', () => {
    const node = dissect(bindRequest, 'ldap', reg);
    const f = (name: string) => node.header.fields.find((x) => x.field.name === name)!;
    expect(f('seqTag').display).toBe('0x30');
    expect(f('msgIdTag').display).toBe('0x02');
    expect(f('seqLen').meaning).toBe('12 bytes (short form)');
    expect(f('msgIdLen').meaning).toBe('1 byte');
  });

  it('leaves the protocolOp as the BER payload, and stops', () => {
    const node = dissect(bindRequest, 'ldap', reg);
    // 5-byte wrapper consumed; the rest is the BER payload.
    expect(node.payload.length).toBe(bindRequest.length - 5);
    // The payload begins with the protocolOp tag: 0x60 = BindRequest [APP 0].
    expect(node.payload[0]).toBe(0x60);
    expect(node.payload[1]).toBe(0x07); // BindRequest length = 7
    // version INTEGER = 3 (LDAPv3) follows inside the BindRequest.
    expect(node.payload.slice(2, 5)).toEqual([0x02, 0x01, 0x03]);
    // We do not dissect the recursive BER protocolOp as a child layer.
    expect(node.child).toBeNull();
  });
});
