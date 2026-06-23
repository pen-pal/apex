import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { snmp } from '../src/protocols/snmp';
import { dissect } from '../src/core/engine';

// A hand-verified SNMPv2c GetRequest for sysDescr.0 (OID 1.3.6.1.2.1.1.1.0),
// community "public". This is the canonical packet `snmpget -v2c -c public ...`
// emits, encoded in ASN.1 BER per RFC 1157 (Message wrapper) / RFC 1901 (v2c).
//
// Full BER TLV breakdown:
//   30 28                          SEQUENCE, length 0x28 = 40 bytes (short form)
//     02 01 01                     INTEGER  len 1  value 1   -> version v2c
//     04 06 70 75 62 6c 69 63      OCTET STRING len 6 "public"  (community)
//     a0 1b                        [0] GetRequest PDU, length 0x1b = 27 bytes
//       02 04 12 34 56 78          INTEGER  request-id 0x12345678
//       02 01 00                   INTEGER  error-status   = 0 (noError)
//       02 01 00                   INTEGER  error-index    = 0
//       30 0d                      SEQUENCE  variable-bindings, len 13
//         30 0b                    SEQUENCE  one VarBind, len 11
//           06 07 2b 06 01 02 01 01 01 00   OID 1.3.6.1.2.1.1.1.0 (sysDescr.0)
//           05 00                  NULL      (unfilled value in a request)
//
// Apex models only the fixed 5-byte outer wrapper: the SEQUENCE tag+length and
// the version INTEGER TLV. Everything from the community OCTET STRING onward is
// the BER payload.
const getRequest = [
  // --- modeled 5-byte wrapper ---
  0x30, 0x28, // SEQUENCE, 40 bytes
  0x02, 0x01, 0x01, // INTEGER len 1 value 1 (v2c)
  // --- payload: community OCTET STRING ---
  0x04, 0x06, 0x70, 0x75, 0x62, 0x6c, 0x69, 0x63, // "public"
  // --- payload: GetRequest PDU ---
  0xa0, 0x1b,
  0x02, 0x04, 0x12, 0x34, 0x56, 0x78, // request-id
  0x02, 0x01, 0x00, // error-status
  0x02, 0x01, 0x00, // error-index
  0x30, 0x0d,
  0x30, 0x0b,
  0x06, 0x07, 0x2b, 0x06, 0x01, 0x02, 0x01, 0x01, 0x01, 0x00, // OID sysDescr.0
  0x05, 0x00, // NULL
];

describe('SNMP outer-wrapper dissection', () => {
  const reg = new ProtocolRegistry();
  reg.register(snmp);

  it('parses the fixed 5-byte SEQUENCE + version INTEGER per RFC 1157/1901', () => {
    const node = dissect(getRequest, 'snmp', reg);
    const h = node.header;

    // Header is exactly the 5 fixed wrapper bytes.
    expect(h.byteLength).toBe(5);

    // Outer SEQUENCE tag and short-form length.
    expect(h.get('seqTag')).toBe(0x30);
    expect(h.get('seqLen')).toBe(0x28); // 40 bytes of contents

    // Version INTEGER TLV: tag 0x02, length 1, value 1 (SNMPv2c).
    expect(h.get('versionTag')).toBe(0x02);
    expect(h.get('versionLen')).toBe(1);
    expect(h.get('version')).toBe(1);
  });

  it('formats coded fields via their enum/decode', () => {
    const node = dissect(getRequest, 'snmp', reg);
    const f = (name: string) => node.header.fields.find((x) => x.field.name === name)!;
    expect(f('seqTag').display).toBe('0x30');
    expect(f('versionTag').display).toBe('0x02');
    expect(f('version').display).toBe('1 (SNMPv2c (RFC 1901))');
    expect(f('seqLen').meaning).toBe('40 bytes (short form)');
  });

  it('leaves the community string + PDU as the BER payload, and stops', () => {
    const node = dissect(getRequest, 'snmp', reg);
    // 5-byte wrapper consumed; the rest is the BER payload.
    expect(node.payload.length).toBe(getRequest.length - 5);
    // The payload begins with the community OCTET STRING TLV: tag 0x04, len 6.
    expect(node.payload[0]).toBe(0x04);
    expect(node.payload[1]).toBe(0x06);
    // "public" in ASCII follows.
    expect(node.payload.slice(2, 8)).toEqual([0x70, 0x75, 0x62, 0x6c, 0x69, 0x63]);
    // The GetRequest PDU context tag 0xa0 comes right after the community.
    expect(node.payload[8]).toBe(0xa0);
    // We do not dissect the recursive BER PDU as a child layer.
    expect(node.child).toBeNull();
  });
});
