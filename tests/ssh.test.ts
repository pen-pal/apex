import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dissect } from '../src/core/engine';
import { ssh } from '../src/protocols/ssh';

// A hand-verified, pre-key-exchange (cleartext) SSH Binary Packet whose payload
// is an SSH_MSG_KEXINIT (message number 20). Built strictly to RFC 4253 §6.
//
// Fields (RFC 4253 §6):
//   packet_length  = 0x0000000C = 12   -- counts padding_length(1) + payload(5) + padding(6),
//                                          NOT these 4 bytes and NOT any MAC.
//   padding_length = 0x06       = 6
//   payload (5 bytes)           = [0x14, 0x00, 0x11, 0x22, 0x33]
//                                   ^^^^ first byte 0x14 = 20 = SSH_MSG_KEXINIT
//   random padding (6 bytes)    = [0xde, 0xad, 0xbe, 0xef, 0xca, 0xfe]
//   mac (0 bytes)               = none (no MAC negotiated yet — this is pre-NEWKEYS)
//
// Whole-packet alignment check (RFC 4253 §6): the total length of
// (packet_length || padding_length || payload || padding) = 4 + 12 = 16, which
// is a multiple of max(cipher block size, 8) = 8. Padding (6) is >= 4. Valid.
//
// We register ONLY the SSH spec and dissect starting at the 'ssh' layer. Apex
// models the 5-byte cleartext frame head; the payload + padding fall through as
// node.payload (and would be encrypted/opaque on an established session).
const packetLength = [0x00, 0x00, 0x00, 0x0c]; // 12
const paddingLength = [0x06]; // 6
const payload = [0x14, 0x00, 0x11, 0x22, 0x33]; // 5 bytes; 0x14 = SSH_MSG_KEXINIT (20)
const padding = [0xde, 0xad, 0xbe, 0xef, 0xca, 0xfe]; // 6 bytes
const frame = [...packetLength, ...paddingLength, ...payload, ...padding];

describe('SSH dissection (RFC 4253 §6 binary packet)', () => {
  const reg = new ProtocolRegistry();
  reg.register(ssh);

  it('parses the fixed 5-byte cleartext frame head', () => {
    const node = dissect(frame, 'ssh', reg);
    const h = node.header;
    expect(h.byteLength).toBe(5);
    expect(h.get('packetLength')).toBe(12);
    expect(h.get('paddingLength')).toBe(6);
  });

  it('passes the payload + random padding through as the payload (no MAC negotiated)', () => {
    const node = dissect(frame, 'ssh', reg);
    // After the 5-byte head, the remaining 11 bytes (5 payload + 6 padding) fall through.
    expect(node.payload.length).toBe(payload.length + padding.length); // 11
    // The SSH message body begins with the message number; 0x14 = 20 = SSH_MSG_KEXINIT.
    expect(node.payload[0]).toBe(0x14);
    expect(node.payload.slice(0, payload.length)).toEqual(payload);
  });

  it('matches packet_length accounting: payload = packet_length - padding_length - 1', () => {
    const node = dissect(frame, 'ssh', reg);
    const h = node.header;
    const payloadBytes = h.get('packetLength') - h.get('paddingLength') - 1;
    expect(payloadBytes).toBe(payload.length); // 12 - 6 - 1 = 5
  });

  it('stops dissecting (encrypted/opaque body, no generic child protocol)', () => {
    const node = dissect(frame, 'ssh', reg);
    expect(ssh.next!(node.header, reg)).toBeNull();
    expect(node.child).toBeNull();
  });
});
