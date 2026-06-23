// IPsec ESP — Encapsulating Security Payload. RFC 4303 (Dec 2005).
// Carried directly in IP as protocol number 50. ESP provides confidentiality,
// data-origin authentication, connectionless integrity, an anti-replay service,
// and (limited) traffic-flow confidentiality.
//
// WHAT IS CLEARTEXT vs WHAT IS OPAQUE:
// Only the first 8 bytes — the SPI and the Sequence Number — are sent in the
// clear. Everything after them (any IV, the encrypted Payload Data, the ESP
// trailer = Padding + Pad Length + Next Header, and the trailing Integrity Check
// Value) is ciphertext to anyone without the Security Association's keys. This
// dissector models ONLY the 8-byte cleartext header and lets the rest fall
// through as node.payload — it never invents plaintext for the encrypted region,
// because decrypting a real ESP stream requires the negotiated session keys and
// is out of scope (see the project's correctness creed).
//
// ESP packet format (RFC 4303 §2):
//   Security Parameters Index (SPI) ........ 32 bits   <- cleartext
//   Sequence Number ........................ 32 bits   <- cleartext
//   --- everything below is encrypted/opaque ---
//   [ Initialization Vector ] .............. variable (cipher-dependent)
//   Payload Data ........................... variable
//   [ TFC Padding ] ........................ variable
//   Padding (0-255) ........................ 0-255 bytes
//   Pad Length ............................. 8 bits
//   Next Header ............................ 8 bits
//   [ Integrity Check Value (ICV) ] ........ variable (cipher-dependent)
import type { ProtocolSpec } from '../core/types';

export const esp: ProtocolSpec = {
  id: 'esp',
  name: 'ESP (IPsec)',
  layer: 3,
  summary:
    'IPsec Encapsulating Security Payload (IP protocol 50): a tiny cleartext header (SPI + Sequence Number) in front of an encrypted-and-authenticated payload. The cipher keys live in the Security Association, so everything past byte 8 is opaque.',
  fields: [
    {
      name: 'spi',
      label: 'Security Parameters Index',
      bits: 32,
      type: 'hex',
      note: 'Identifies the Security Association (the keys, cipher, and mode) that protects this packet. Values 1-255 are reserved by IANA.',
      desc: 'A 32-bit arbitrary value carried in the clear that, together with the destination IP address and the security protocol (ESP), names the Security Association (SA) the receiver must use to process this packet.',
      detail: `SECURITY PARAMETERS INDEX (32 bits, mandatory, sent in the clear):
RFC 4303 §2.1: "an arbitrary 32-bit value that is used by a receiver to identify the SA to which an incoming packet is bound."

THE SA LOOKUP: the receiver locates the SA from the triple (SPI, destination IP address, security protocol = ESP). The SA holds the encryption algorithm + key, the integrity algorithm + key, the mode (tunnel/transport), and anti-replay state — none of which travel on the wire.

WHY IT MUST BE CLEARTEXT: the receiver needs the SPI to find the keys before it can decrypt anything, so the SPI cannot itself be encrypted.

RESERVED VALUES: SPI values 1 through 255 are reserved by IANA for future use; 0 is reserved for local, implementation-specific use (and MUST NOT be sent on the wire). A sender chooses the SPI for inbound SAs, typically as a random or pseudo-random number, during IKE negotiation.

ENDIANNESS: 32-bit big-endian (network order).`,
    },
    {
      name: 'sequenceNumber',
      label: 'Sequence Number',
      bits: 32,
      note: 'A monotonically increasing per-SA counter starting at 1, used for the anti-replay service. With Extended Sequence Numbers the counter is 64 bits but only these low 32 are transmitted.',
      desc: 'An unsigned 32-bit counter that increments by one for every packet sent on this SA. The receiver uses it, with a sliding window, to detect and reject replayed packets.',
      detail: `SEQUENCE NUMBER (32 bits, mandatory, sent in the clear):
RFC 4303 §2.2: "an unsigned 32-bit field containing a counter value that increases by one for each packet sent." Both sender and receiver initialise it to 0; the first packet sent on the SA therefore carries 1.

ANTI-REPLAY: when anti-replay is enabled the sender's counter MUST NOT cycle. If it would wrap past 2^32 - 1 (or 2^64 - 1 with ESN) a new SA — and a fresh key — must be established. The receiver keeps a sliding window (default 64) and discards duplicates and packets that fall below the window.

EXTENDED SEQUENCE NUMBERS (ESN): RFC 4303 §2.2.1 allows a 64-bit counter. Only the low-order 32 bits are transmitted in this field; the high-order 32 bits are maintained by both peers and folded into the Integrity Check Value computation, so a tampered/rolled-over high half fails the integrity check.

NOTE ON THE WINDOW: anti-replay only works if integrity is also enabled (otherwise an attacker could forge sequence numbers); the sequence number is authenticated by the ICV but is itself not encrypted.

ENDIANNESS: 32-bit big-endian (network order).`,
    },
  ],
  // The cleartext ESP header is a fixed 8 bytes (SPI + Sequence Number). Any IV,
  // the encrypted Payload Data, the ESP trailer (Padding + Pad Length + Next
  // Header), and the trailing ICV all follow — but they are ciphertext without
  // the SA keys, so they fall through as node.payload and are NOT dissected here.
  headerBytes: () => 8,
  // The encrypted payload's true Next Header (the protocol inside the tunnel) is
  // in the encrypted trailer, which we cannot read. Stop dissecting.
  next: () => null,
};
