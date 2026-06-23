import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dissect } from '../src/core/engine';
import { ethernet } from '../src/protocols/ethernet';
import { macsec } from '../src/protocols/macsec';

// MACsec — IEEE 802.1AE SecTAG dissection.
//
// Every assertion is anchored to the IEEE 802.1AE clause-9 SecTAG bit layout (the
// same masks the Wireshark packet-macsec.c dissector uses), NOT to this code's
// own output:
//   TCI/AN octet (octet 1): V=0x80 ES=0x40 SC=0x20 SCB=0x10 E=0x08 C=0x04 AN=0x03
//   SL octet     (octet 2): 2 reserved bits (0xC0) + 6-bit Short Length (0x3F)
//   Packet Number          : 32 bits, big-endian
//   SCI                    : 64 bits, present IFF the SC bit (0x20) is set
//                            = 48-bit transmitter MAC + 16-bit Port Identifier
//   SecTAG length          : 6 octets without SCI, 14 with (9.5)
//   ICV                    : 16-octet trailer over the Secure Frame (14.6)
//
// In Apex the 2-byte MACsec EtherType 0x88E5 is consumed as the Ethernet
// EtherType, so the SecTAG modeled here begins at the TCI/AN octet.

const reg = new ProtocolRegistry();
reg.register(ethernet);
reg.register(macsec);

// ---------------------------------------------------------------------------
// Frame A: SC bit SET -> 14-byte SecTAG carrying an explicit SCI.
//
// TCI/AN octet = 0x2D = 0010 1101b:
//   V=0 ES=0 SC=1 SCB=0 E=1 C=1  (0x20 | 0x08 | 0x04)  AN=01b = 1
// SL octet = 0x00 (frame is >= 48 bytes, so no short-length value).
// Packet Number = 0x0000007B = 123 (big-endian).
// SCI = MAC 52:54:00:12:34:56 + Port Identifier 0x0001.
const sectagA = [
  0x2d,                                     // TCI/AN
  0x00,                                     // SL
  0x00, 0x00, 0x00, 0x7b,                   // Packet Number = 123
  0x52, 0x54, 0x00, 0x12, 0x34, 0x56,       // SCI: transmitter MAC
  0x00, 0x01,                               // SCI: Port Identifier = 1
];
// Secure Data (encrypted/opaque) + 16-byte ICV trailer. We never assert these as
// plaintext; they fall through as the opaque payload (see the spec's ICV note).
const secureDataA = [
  0xde, 0xad, 0xbe, 0xef, 0xca, 0xfe, 0xba, 0xbe, // opaque ciphertext (8 bytes)
];
const icvA = [
  0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, // 16-byte ICV (GCM-AES)
  0x99, 0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff, 0x00,
];

// ---------------------------------------------------------------------------
// Frame B: SC bit CLEAR -> 6-byte SecTAG, no SCI (implicit Secure Channel).
//
// TCI/AN octet = 0x42 = 0100 0010b:
//   V=0 ES=1 SC=0 SCB=0 E=0 C=0  (0x40)  AN=10b = 2
// SL octet = 0x10 = 16 (a short frame: 16 octets of user data).
// Packet Number = 0x00000001 = 1 (first frame on the SA).
const sectagB = [
  0x42,                                     // TCI/AN
  0x10,                                     // SL = 16
  0x00, 0x00, 0x00, 0x01,                   // Packet Number = 1
];
const secureDataB = [0xa0, 0xb1, 0xc2, 0xd3]; // opaque
const icvB = [
  0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef,
  0xfe, 0xdc, 0xba, 0x98, 0x76, 0x54, 0x32, 0x10,
];

describe('MACsec (802.1AE) SecTAG dissection', () => {
  it('parses a 14-byte SecTAG when the SC bit is set (with explicit SCI)', () => {
    const node = dissect([...sectagA, ...secureDataA, ...icvA], 'macsec', reg);
    const h = node.header;

    // SC set => SecTAG is 14 bytes (SECTAG_LEN_WITH_SC).
    expect(h.byteLength).toBe(14);

    // TCI flags: 0x2D has SC, E, C set; V/ES/SCB clear.
    const tci = h.fields.find((f) => f.field.name === 'tci')!;
    expect(tci.display).toBe('SC, E, C');
    // Association Number low 2 bits = 01b = 1.
    expect(h.get('an')).toBe(1);

    // SL octet 0x00: reserved bits 0, short length 0.
    expect(h.get('reservedSL')).toBe(0);
    expect(h.get('sl')).toBe(0);

    // Packet Number 0x0000007B = 123 (big-endian).
    expect(h.get('pn')).toBe(123);

    // SCI present: 8 bytes = MAC 52:54:00:12:34:56 + Port Id 0x0001.
    const sci = h.fields.find((f) => f.field.name === 'sci')!;
    expect(sci.bytes).toEqual([0x52, 0x54, 0x00, 0x12, 0x34, 0x56, 0x00, 0x01]);

    // Encrypted Secure Data + ICV are opaque; no inner protocol is invented.
    expect(node.child).toBeNull();
    expect(macsec.next!(h, reg)).toBeNull();
    // Per the spec's ICV note: Secure Data + 16-byte ICV fall through together as
    // the opaque payload (the last 16 of which are the ICV trailer).
    expect(node.payload).toEqual([...secureDataA, ...icvA]);
    expect(node.payload.slice(-16)).toEqual(icvA);
  });

  it('parses a 6-byte SecTAG when the SC bit is clear (implicit SCI)', () => {
    const node = dissect([...sectagB, ...secureDataB, ...icvB], 'macsec', reg);
    const h = node.header;

    // SC clear => SecTAG is 6 bytes (SECTAG_LEN_WITHOUT_SC) and there is NO SCI.
    expect(h.byteLength).toBe(6);

    // TCI flags: 0x42 has only ES set.
    const tci = h.fields.find((f) => f.field.name === 'tci')!;
    expect(tci.display).toBe('ES');
    // AN low 2 bits = 10b = 2.
    expect(h.get('an')).toBe(2);

    // SL = 16 (short frame), reserved bits clear.
    expect(h.get('reservedSL')).toBe(0);
    expect(h.get('sl')).toBe(16);

    // First frame on the SA -> Packet Number 1.
    expect(h.get('pn')).toBe(1);

    // The SCI field still parses (the engine reads all declared fields), but with
    // SC=0 the 8 bytes it read are actually the start of the Secure Data, NOT a
    // real SCI — which is exactly why headerBytes excludes it (byteLength = 6).
    // Proof: the 6-byte SecTAG ends right after the Packet Number, so byte 6
    // onward is the (opaque) Secure Data + ICV.
    expect(node.payload).toEqual([...secureDataB, ...icvB]);
    expect(node.payload.slice(-16)).toEqual(icvB);
    expect(node.child).toBeNull();
  });

  it('dissects the full chain Ethernet(0x88E5) -> MACsec with SecTAG correct', () => {
    // Ethernet II header: dst MAC, src MAC, EtherType 0x88E5 (MACsec).
    const eth = [
      0xff, 0xff, 0xff, 0xff, 0xff, 0xff,       // dst MAC (broadcast)
      0x52, 0x54, 0x00, 0x12, 0x34, 0x56,       // src MAC
      0x88, 0xe5,                               // EtherType = MACsec
    ];
    const frame = [...eth, ...sectagA, ...secureDataA, ...icvA];
    const node = dissect(frame, 'ethernet', reg);

    // Ethernet recognises MACsec and dispatches to it.
    expect(node.header.spec.id).toBe('ethernet');
    expect(node.header.get('etherType')).toBe(0x88e5);
    expect(node.child).not.toBeNull();

    const ms = node.child!;
    expect(ms.header.spec.id).toBe('macsec');
    expect(ms.header.byteLength).toBe(14);
    expect(ms.header.get('pn')).toBe(123);
    expect(ms.header.get('an')).toBe(1);
    expect(ms.header.fields.find((f) => f.field.name === 'tci')!.display).toBe('SC, E, C');
    // MACsec stops the dissection (encrypted payload is opaque).
    expect(ms.child).toBeNull();
  });
});
