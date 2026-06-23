import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { kerberos } from '../src/protocols/kerberos';
import { dissect } from '../src/core/engine';

// A hand-verified Kerberos AS-REQ, encoded in ASN.1 DER per RFC 4120 (§5.4.1
// KDC-REQ; §5.10 application tags). This is a minimal but well-formed AS-REQ
// whose body is < 128 bytes so the outer DER length is SHORT FORM — exactly the
// case Apex models. The msg-type field inside (INTEGER 10) confirms the message
// kind independently of the outer APPLICATION tag.
//
// Full DER TLV breakdown:
//   6a 1b                          [APPLICATION 10] AS-REQ, length 0x1b = 27 bytes (short form)
//     30 19                        SEQUENCE  (KDC-REQ body), length 0x19 = 25 bytes
//       a1 03 02 01 05             [1] pvno      INTEGER 5   (Kerberos V5)
//       a2 03 02 01 0a             [2] msg-type  INTEGER 10  (= AS-REQ, matches the app tag)
//       a3 0d                      [3] padata    SEQUENCE OF PA-DATA, length 13
//         30 0b                    PA-DATA SEQUENCE, length 11
//           a1 04 02 02 00 02      [1] padata-type INTEGER 2 (PA-ENC-TIMESTAMP)
//           a2 03 04 01 00         [2] padata-value OCTET STRING, len 1, 0x00 (placeholder)
//
// Apex models only the fixed 2-byte prefix: the APPLICATION tag byte and the
// short-form DER length. Everything from the body SEQUENCE (0x30) onward is the
// DER payload, shown verbatim in the byte view.
const asReq = [
  // --- modeled 2-byte prefix ---
  0x6a, 0x1b, // [APPLICATION 10] AS-REQ, body length 27 (short form)
  // --- payload: KDC-REQ body SEQUENCE ---
  0x30, 0x19, // SEQUENCE, length 25
  0xa1, 0x03, 0x02, 0x01, 0x05, // [1] pvno = 5
  0xa2, 0x03, 0x02, 0x01, 0x0a, // [2] msg-type = 10 (AS-REQ)
  0xa3, 0x0d, // [3] padata SEQUENCE OF, len 13
  0x30, 0x0b, // PA-DATA SEQUENCE, len 11
  0xa1, 0x04, 0x02, 0x02, 0x00, 0x02, // [1] padata-type = 2 (PA-ENC-TIMESTAMP)
  0xa2, 0x03, 0x04, 0x01, 0x00, // [2] padata-value OCTET STRING len 1
];

describe('Kerberos outer application-tag dissection', () => {
  const reg = new ProtocolRegistry();
  reg.register(kerberos);

  it('parses the fixed 2-byte APPLICATION tag + DER length per RFC 4120 §5.10', () => {
    const node = dissect(asReq, 'kerberos', reg);
    const h = node.header;

    // Header is exactly the 2 fixed prefix bytes.
    expect(h.byteLength).toBe(2);

    // [APPLICATION 10] AS-REQ = 0x60 + 10 = 0x6a, constructed.
    expect(h.get('appTag')).toBe(0x6a);
    // Short-form DER length: 27 contained bytes.
    expect(h.get('derLen')).toBe(0x1b);
  });

  it('formats coded fields via their enum/decode', () => {
    const node = dissect(asReq, 'kerberos', reg);
    const f = (name: string) => node.header.fields.find((x) => x.field.name === name)!;
    // enum formats as "<decimal> (<name>)"; 0x6a = 106.
    expect(f('appTag').display).toBe('106 (AS-REQ [APPLICATION 10])');
    expect(f('appTag').meaning).toBe('AS-REQ [APPLICATION 10]');
    expect(f('derLen').meaning).toBe('27 bytes (short form)');
  });

  it('recognises the other defined message tags (0x60 + n)', () => {
    const f = kerberos.fields.find((x) => x.name === 'appTag')!;
    const map = f.enumMap!;
    // RFC 4120 §5.10 application numbers, encoded as 0x60 + n.
    expect(map[0x6a]).toMatch(/AS-REQ/);      // [APPLICATION 10]
    expect(map[0x6b]).toMatch(/AS-REP/);      // [APPLICATION 11]
    expect(map[0x6c]).toMatch(/TGS-REQ/);     // [APPLICATION 12]
    expect(map[0x6d]).toMatch(/TGS-REP/);     // [APPLICATION 13]
    expect(map[0x6e]).toMatch(/AP-REQ/);      // [APPLICATION 14]
    expect(map[0x6f]).toMatch(/AP-REP/);      // [APPLICATION 15]
    expect(map[0x7e]).toMatch(/KRB-ERROR/);   // [APPLICATION 30] => 0x60+30 = 0x7e
  });

  it('flags a long-form DER length instead of mis-parsing it', () => {
    const f = kerberos.fields.find((x) => x.name === 'derLen')!;
    // 0x81 = long form, 1 following length octet.
    expect(f.decode!(0x81, {} as any)).toMatch(/long form/);
    // Short form is reported as a plain byte count.
    expect(f.decode!(0x19, {} as any)).toBe('25 bytes (short form)');
  });

  it('leaves the DER body as the payload, and stops dissecting', () => {
    const node = dissect(asReq, 'kerberos', reg);
    // 2-byte prefix consumed; the rest is the DER payload.
    expect(node.payload.length).toBe(asReq.length - 2);
    // The payload begins with the body SEQUENCE TLV: tag 0x30, len 0x19.
    expect(node.payload[0]).toBe(0x30);
    expect(node.payload[1]).toBe(0x19);
    // The [1] pvno context tag (0xa1) introduces INTEGER 5 (Kerberos V5).
    expect(node.payload.slice(2, 7)).toEqual([0xa1, 0x03, 0x02, 0x01, 0x05]);
    // The [2] msg-type context tag (0xa2) introduces INTEGER 10 (AS-REQ).
    expect(node.payload.slice(7, 12)).toEqual([0xa2, 0x03, 0x02, 0x01, 0x0a]);
    // We do not dissect the recursive DER body as a child layer.
    expect(node.child).toBeNull();
  });
});
