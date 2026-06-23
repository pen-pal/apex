import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dissect } from '../src/core/engine';
import { eapol } from '../src/protocols/eapol';

// Hand-verified EAPOL frames (IEEE 802.1X-2004 §7.2). The 4-byte EAPOL header is
// asserted; any body lands in node.payload, bounded by Packet Body Length.

// (1) EAPOL-Start — a bodyless control frame a supplicant sends to begin
//     authentication. It sits inside a minimum 60-byte Ethernet frame, so it is
//     padded with zeros on the wire after the header.
//   Version 0x01 = 802.1X-2001
//   Type    0x01 = EAPOL-Start
//   Length  0x0000 = no body
const eapolStart = [0x01, 0x01, 0x00, 0x00];

// (2) EAP-Packet carrying an EAP-Request/Identity (RFC 3748 §4 / §5.1):
//   EAPOL header:  Version 0x02 (802.1X-2004), Type 0x00 (EAP-Packet),
//                  Length 0x0005 (5-byte EAP packet follows)
//   EAP body (5 bytes): Code 0x01 (Request), Identifier 0x01,
//                       Length 0x0005, Type 0x01 (Identity)
const eapolEap = [0x02, 0x00, 0x00, 0x05];
const eapBody = [0x01, 0x01, 0x00, 0x05, 0x01];

describe('EAPOL dissection', () => {
  const reg = new ProtocolRegistry();
  reg.register(eapol);

  it('parses the fixed 4-byte header of an EAPOL-Start', () => {
    const node = dissect(eapolStart, 'eapol', reg);
    const h = node.header;
    expect(h.byteLength).toBe(4);
    expect(h.get('version')).toBe(1);
    expect(h.get('type')).toBe(1);
    expect(h.get('length')).toBe(0);
    expect(h.fields.find((f) => f.field.name === 'type')!.meaning).toBe('EAPOL-Start');
    expect(h.fields.find((f) => f.field.name === 'version')!.meaning).toBe('802.1X-2001');
  });

  it('strips Ethernet padding from a bodyless frame (length 0 bounds the PDU)', () => {
    // EAPOL-Start in a min-size Ethernet frame: header + 56 bytes of zero padding.
    const node = dissect([...eapolStart, ...new Array(56).fill(0x00)], 'eapol', reg);
    expect(node.payload.length).toBe(0); // 4 + 0 -> no payload
    expect(node.trailer.length).toBe(56); // padding is trailer, never payload
  });

  it('parses an EAP-Packet header and bounds the EAP body by Packet Body Length', () => {
    const node = dissect([...eapolEap, ...eapBody, 0xff, 0xff], 'eapol', reg);
    const h = node.header;
    expect(h.get('version')).toBe(2);
    expect(h.get('type')).toBe(0);
    expect(h.get('length')).toBe(5);
    expect(h.fields.find((f) => f.field.name === 'type')!.meaning).toBe('EAP-Packet');
    // Length=5 -> exactly the 5-byte EAP packet is the payload; trailing 0xff is trailer.
    expect(node.payload).toEqual(eapBody);
    expect(node.trailer).toEqual([0xff, 0xff]);
  });

  it('stops dissecting (the body is EAP / EAPOL-Key, not modelled here)', () => {
    const node = dissect([...eapolEap, ...eapBody], 'eapol', reg);
    expect(eapol.next!(node.header, reg)).toBeNull();
  });
});
