import { describe, it, expect } from 'vitest';
import { ProtocolRegistry } from '../src/core/registry';
import { dissect } from '../src/core/engine';
import { wireguard } from '../src/protocols/wireguard';

// A real WireGuard Handshake Initiation (message type 1). Such a message is 148
// bytes: a 4-byte header (01 00 00 00 — type=1, reserved=0) followed by the
// cryptographic body defined in the WireGuard whitepaper §5.4:
//   sender_index(4) ephemeral(32) encrypted_static(48) encrypted_timestamp(28)
//   mac1(16) mac2(16)  =  4 + 32 + 48 + 28 + 16 + 16 = 144  (+4 header = 148)
//
// The first four bytes 01 00 00 00 are the universally-observed signature of a
// WireGuard initiation (type 1, three reserved zero bytes). The sender_index is
// a random 32-bit value carried LITTLE-ENDIAN; here the 4 bytes 78 56 34 12
// therefore decode to 0x12345678. The remaining 140 bytes are opaque ephemeral
// key material, AEAD ciphertexts and MACs — Apex does not interpret them, so we
// only assert that they fall through as the payload, never as invented plaintext.
const header = [0x01, 0x00, 0x00, 0x00]; // message_type=1, reserved=0,0,0
const senderIndex = [0x78, 0x56, 0x34, 0x12]; // little-endian -> 0x12345678
const cryptoBody = [
  ...new Array(32).fill(0xaa), // unencrypted_ephemeral (Curve25519 public key)
  ...new Array(48).fill(0xbb), // encrypted_static (ChaCha20-Poly1305)
  ...new Array(28).fill(0xcc), // encrypted_timestamp (TAI64N, AEAD)
  ...new Array(16).fill(0xdd), // mac1 (keyed BLAKE2s)
  ...new Array(16).fill(0xee), // mac2 (keyed BLAKE2s, may be zero if no cookie)
];
const initiation = [...header, ...senderIndex, ...cryptoBody];

describe('WireGuard dissection', () => {
  const reg = new ProtocolRegistry();
  reg.register(wireguard);

  it('parses the 4-byte cleartext header of a Handshake Initiation', () => {
    const node = dissect(initiation, 'wireguard', reg);
    const h = node.header;
    expect(h.byteLength).toBe(4);
    expect(h.get('messageType')).toBe(1);
    expect(
      h.fields.find((f) => f.field.name === 'messageType')!.meaning,
    ).toBe('Handshake Initiation');
    // The three reserved bytes are zero.
    expect(h.get('reserved')).toBe(0);
  });

  it('treats the entire cryptographic body as opaque payload', () => {
    const node = dissect(initiation, 'wireguard', reg);
    // 148-byte message minus the 4-byte header = 144 opaque body bytes.
    expect(node.payload.length).toBe(144);
    // The body begins with the (little-endian) sender_index bytes, untouched.
    expect(node.payload.slice(0, 4)).toEqual([0x78, 0x56, 0x34, 0x12]);
    // There is no nested protocol to dissect: the tunnelled packet is encrypted.
    expect(node.child).toBeNull();
    expect(wireguard.next!(node.header, reg)).toBeNull();
  });
});
