// IKE / ISAKMP header. RFC 7296 (Internet Key Exchange Protocol Version 2,
// IKEv2), Section 3.1 "The IKE Header". The on-wire header shape is inherited
// from ISAKMP (RFC 2408 §3.1), which is why dissectors still label it "ISAKMP";
// RFC 7296 obsoletes the IKEv1/ISAKMP semantics but keeps the same 28-byte
// fixed header layout.
//
// TRANSPORT
// ---------
// IKE runs over UDP. The IKE_SA_INIT exchange uses UDP port 500. When a NAT is
// detected, both peers float to UDP port 4500, where every IKE (and ESP)
// packet is prefixed with a 4-byte "Non-ESP marker" (0x00000000) so the
// receiver can tell IKE control traffic from UDP-encapsulated ESP (RFC 3948).
// This spec models the 28-byte IKE header itself, beginning at the Initiator's
// SPI; the optional non-ESP marker on port 4500 is a transport framing word
// handled before this header, not part of it.
//
// WHY ONLY THE HEADER
// -------------------
// After the fixed 28-byte header comes a chain of IKE payloads (each itself a
// generic 4-byte payload header — Next Payload, Critical+Reserved, Payload
// Length — followed by a type-specific body, RFC 7296 §3.2). In the
// IKE_SA_INIT exchange those payloads (SA, KE, Nonce) are in the clear; from
// IKE_AUTH onward they are wrapped in an Encrypted payload (type 46) whose
// contents are AEAD ciphertext and therefore OPAQUE without the negotiated
// keys. Either way the payload chain is variable and not a fixed bit grid, so
// it is left as node.payload and dissection stops at the header (next: null).
import type { ProtocolSpec, ParsedHeader } from '../core/types';

// RFC 7296 §3.2, Table "Payload Type Values". 0 = "No Next Payload" terminates
// the chain. The values below are the IKEv2 set (the registry continues with
// later RFCs, e.g. 53 EAP-extended, but these are the ones in RFC 7296).
const PAYLOAD_TYPE: Record<number, string> = {
  0: 'No Next Payload',
  33: 'SA (Security Association)',
  34: 'KE (Key Exchange)',
  35: 'IDi (Identification - Initiator)',
  36: 'IDr (Identification - Responder)',
  37: 'CERT (Certificate)',
  38: 'CERTREQ (Certificate Request)',
  39: 'AUTH (Authentication)',
  40: 'Ni, Nr (Nonce)',
  41: 'N (Notify)',
  42: 'D (Delete)',
  43: 'V (Vendor ID)',
  44: 'TSi (Traffic Selector - Initiator)',
  45: 'TSr (Traffic Selector - Responder)',
  46: 'SK (Encrypted and Authenticated)',
  47: 'CP (Configuration)',
  48: 'EAP (Extensible Authentication)',
};

// RFC 7296 §3.1, "Exchange Type" (IKEv2 range begins at 34; values 0-33 are the
// reserved/legacy ISAKMP/IKEv1 exchange types).
const EXCHANGE_TYPE: Record<number, string> = {
  34: 'IKE_SA_INIT',
  35: 'IKE_AUTH',
  36: 'CREATE_CHILD_SA',
  37: 'INFORMATIONAL',
};

export const isakmp: ProtocolSpec = {
  id: 'isakmp',
  name: 'IKE / ISAKMP',
  layer: 7,
  summary:
    'The IKEv2 / ISAKMP header (RFC 7296 §3.1): the fixed 28-byte frame over UDP 500 (or 4500 behind NAT) that fronts an IPsec key-exchange message — the two SPIs that name the IKE SA, the next-payload pointer, version, exchange type, flags (Initiator/Version/Response), Message ID, and total length.',
  fields: [
    {
      name: 'initiatorSPI',
      label: "Initiator's SPI",
      bits: 64,
      type: 'bytes',
      note: '8-byte SPI chosen by the initiator; names this IKE SA. Never all-zero.',
      desc: "An 8-octet Security Parameter Index chosen by the initiator when it starts the exchange. Together with the Responder's SPI it uniquely names the IKE Security Association on both peers, so each side can find the right keys and state for a received message.",
      detail: `INITIATOR'S SPI (8 octets, RFC 7296 §3.1): a value the initiator picks to identify a unique IKE SA. It "MUST NOT be zero" — an all-zero Initiator SPI is illegal because it would not name an SA.

ROLE: the (Initiator SPI, Responder SPI) pair is the IKE SA's name. A receiver demultiplexes an incoming IKE message to a half-open or established SA by this pair, then uses that SA's keys to authenticate/decrypt the payloads.

WIDTH: 64 bits exceeds the engine's exact numeric range (<= 48 bits), so per the Apex contract this field is modeled as 'bytes' and shown as its 8 raw octets. The SPI is an opaque identifier, so a byte array is also the most honest representation.`,
    },
    {
      name: 'responderSPI',
      label: "Responder's SPI",
      bits: 64,
      type: 'bytes',
      note: '8-byte SPI chosen by the responder; all-zero in the very first message.',
      desc: "An 8-octet Security Parameter Index chosen by the responder. It is all-zero in the initiator's very first message (the responder has not been chosen yet) and is filled in once the responder answers, completing the name of the IKE SA.",
      detail: `RESPONDER'S SPI (8 octets, RFC 7296 §3.1): the responder's half of the SA name. In the FIRST message of an exchange (the initiator's IKE_SA_INIT request) it MUST be zero, because no responder SA exists yet; the responder chooses a non-zero value and returns it in its IKE_SA_INIT response, after which both peers carry the full (Initiator, Responder) SPI pair on every message.

A non-zero Responder SPI in an inbound first message would be a protocol error. WIDTH: 64 bits, so per the Apex contract it is modeled as 'bytes' (8 raw octets) rather than a decimal.`,
    },
    {
      name: 'nextPayload',
      label: 'Next payload',
      bits: 8,
      type: 'enum',
      enumMap: PAYLOAD_TYPE,
      note: 'Type of the FIRST payload after this header. 0 = none.',
      desc: 'The type of the first payload that follows the header. IKE payloads form a singly linked chain: each one names the type of the next, and this header field is the head of that chain. 33 = SA, 34 = KE, 40 = Nonce, 46 = Encrypted; 0 terminates the chain.',
      detail: `NEXT PAYLOAD (1 octet, RFC 7296 §3.1 / §3.2): the payload type of the first payload in the message. Every IKE payload begins with its own generic header that again carries a Next Payload field, so the parser walks the chain payload by payload until a Next Payload of 0 ("No Next Payload").

KEY VALUES (RFC 7296 §3.2):
33 SA | 34 KE | 35 IDi | 36 IDr | 37 CERT | 38 CERTREQ | 39 AUTH
40 Nonce (Ni/Nr) | 41 Notify | 42 Delete | 43 Vendor ID
44 TSi | 45 TSr | 46 Encrypted (SK) | 47 Configuration | 48 EAP

TYPICAL HEADS: an IKE_SA_INIT message usually starts with SA (33) — the proposed cryptographic suites — followed by KE (34, the Diffie-Hellman public value) and Nonce (40). From IKE_AUTH onward the message body is a single Encrypted payload (46), so Next Payload here is 46 and everything real is inside the AEAD ciphertext.`,
    },
    {
      name: 'version',
      label: 'Version',
      bits: 8,
      type: 'hex',
      decode: (v) => `IKEv${(v >> 4) & 0xf}.${v & 0xf} (major ${(v >> 4) & 0xf}, minor ${v & 0xf})`,
      note: 'Major(4) / minor(4) nibbles. 0x20 = IKEv2.0.',
      desc: 'The IKE major and minor version, packed as two 4-bit nibbles: high nibble = major, low nibble = minor. 0x20 means IKEv2.0 (major 2, minor 0). The major version governs wire compatibility; a peer rejects a major version it does not implement.',
      detail: `VERSION (1 octet, RFC 7296 §3.1):
- High nibble (bits 0-3, MSB) = Major Version. MUST be 2 for IKEv2; an implementation receiving a higher major it does not support replies with an INVALID_MAJOR_VERSION notification.
- Low nibble (bits 4-7) = Minor Version. MUST be 0 for RFC 7296; it is ignored by the receiver (a minor-version bump must stay backward compatible).

So the on-wire byte for IKEv2.0 is 0x20 (0010 0000). IKEv1/ISAKMP used 0x10 (major 1). RFC 7296 also notes the Version flag (V) in the Flags byte below indicates a transmitter capable of a higher major version; in practice it is set to 0.`,
    },
    {
      name: 'exchangeType',
      label: 'Exchange type',
      bits: 8,
      type: 'enum',
      enumMap: EXCHANGE_TYPE,
      note: '34 IKE_SA_INIT, 35 IKE_AUTH, 36 CREATE_CHILD_SA, 37 INFORMATIONAL.',
      desc: 'Which IKEv2 exchange this message belongs to. IKEv2 has just four: IKE_SA_INIT (34) negotiates crypto and does Diffie-Hellman; IKE_AUTH (35) authenticates the peers and sets up the first Child SA; CREATE_CHILD_SA (36) makes more Child SAs or rekeys; INFORMATIONAL (37) carries notifications, deletes, and keepalives.',
      detail: `EXCHANGE TYPE (1 octet, RFC 7296 §3.1). The IKEv2 exchanges (values 34-37; 0-33 are reserved for the legacy ISAKMP/IKEv1 exchange types):
- 34 IKE_SA_INIT: the first exchange — negotiates cryptographic algorithms, exchanges nonces, and performs a Diffie-Hellman key exchange. Its payloads are in the clear.
- 35 IKE_AUTH: authenticates the previous messages, exchanges identities and certificates, and establishes the first Child SA (the actual IPsec/ESP keys). Its payloads are encrypted under keys derived from IKE_SA_INIT.
- 36 CREATE_CHILD_SA: creates additional Child SAs and rekeys both Child SAs and the IKE SA itself.
- 37 INFORMATIONAL: carries Notify, Delete, and Configuration payloads, and is also used for liveness checks (a request with no payloads acts as a keepalive / dead-peer detection probe).

An IKEv2 connection's normal opening is IKE_SA_INIT then IKE_AUTH — two round trips to a fully authenticated SA with an IPsec Child SA ready.`,
    },
    {
      name: 'flags',
      label: 'Flags',
      bits: 8,
      type: 'flags',
      // RFC 7296 §3.1 draws the flags octet MSB-first as: X X R V I X X X.
      // flagBits[0] is the MSB, so this array is that diagram verbatim:
      //   index 2 = R (Response) = 0x20, index 3 = V (Version) = 0x10,
      //   index 4 = I (Initiator) = 0x08; all X bits are reserved (must be 0).
      flagBits: ['', '', 'R', 'V', 'I', '', '', ''],
      decode: (v) => {
        const set: string[] = [];
        if (v & 0x20) set.push('R (Response)');
        if (v & 0x10) set.push('V (Version)');
        if (v & 0x08) set.push('I (Initiator)');
        return (set.length ? set.join(', ') : 'none') + ` (0x${v.toString(16).toUpperCase().padStart(2, '0')})`;
      },
      note: 'I=Initiator (0x08), V=Version (0x10), R=Response (0x20).',
      desc: 'Three meaningful bits in this octet (the rest reserved, must be 0): I (Initiator, 0x08) = this message is from the original initiator; V (Version, 0x10) = the sender can speak a higher major version; R (Response, 0x20) = this is a response to a message with the same Message ID. The I and R bits together tell you direction and role.',
      detail: `FLAGS (1 octet, RFC 7296 §3.1). The octet, drawn MSB-first, is:

  +-+-+-+-+-+-+-+-+
  |X|X|R|V|I|X|X|X|
  +-+-+-+-+-+-+-+-+

- X bits (numeric weights 0x80, 0x40, 0x04, 0x02, 0x01): Reserved — MUST be cleared on send and ignored on receipt.
- R (Response), 0x20: clear on a request, set on the response to that request. A request/response pair shares one Message ID, and the R bit disambiguates the two. An endpoint MUST NOT respond to a message already marked as a response.
- V (Version), 0x10: set if the transmitter can speak a higher major version than the one in the Version field. IKEv2 implementations MUST clear it on send and ignore it on receipt; in practice it is 0.
- I (Initiator), 0x08: MUST be set in messages from the original initiator of the IKE SA and cleared in messages from the original responder. The recipient uses it (with the SPIs) to tell which eight octets of the SPI it generated; it flips to reflect whoever initiated the last IKE-SA rekey.

EXAMPLE: an initiator's IKE_SA_INIT *request* sets only I -> 0x08. The responder's IKE_SA_INIT *response* sets I=0 (it is the responder) and R -> 0x20. A request the responder later initiates (e.g. an INFORMATIONAL delete) would have I=0, R=0 -> 0x00.`,
    },
    {
      name: 'messageId',
      label: 'Message ID',
      bits: 32,
      type: 'hex',
      decode: (v) => `${v} (0x${(v >>> 0).toString(16).toUpperCase().padStart(8, '0')})`,
      note: 'Per-SA message counter; matches a request to its response.',
      desc: 'A 32-bit counter that orders messages within an IKE SA and pairs each request with its response (the response echoes the request\'s Message ID). It also protects against replay: each side tracks the expected window and rejects out-of-window IDs.',
      detail: `MESSAGE ID (4 octets, RFC 7296 §3.1): a monotonically increasing counter, separate per direction, used for matching requests to responses and for replay protection.
- The first message of the IKE_SA_INIT exchange uses Message ID 0; its response also uses 0.
- IKE_AUTH uses Message ID 1, and so on; each new request increments the sender's counter.
- A response MUST carry the same Message ID as the request it answers (paired with the R flag, this matches them unambiguously).

REPLAY PROTECTION: because the Message ID is inside the authenticated/encrypted message from IKE_AUTH onward, an attacker cannot replay an old message under a new ID, and a receiver drops messages whose ID falls outside the expected window. The 32-bit space is large enough that an SA is rekeyed long before it wraps.`,
    },
    {
      name: 'length',
      label: 'Length',
      bits: 32,
      decode: (v) => `${v} bytes (28-byte header + ${v - 28} bytes of payloads)`,
      note: 'Total length of the IKE message: header + all payloads, in octets.',
      desc: 'The total length of the whole IKE message in octets, including this 28-byte header and every payload that follows. It bounds the message so the receiver knows exactly where it ends, independent of the UDP length.',
      detail: `LENGTH (4 octets, RFC 7296 §3.1): the length of the total message (header + all payloads) in octets. The minimum legal value is 28 (a header with no payloads, e.g. an INFORMATIONAL keepalive).

BOUNDS THE PDU: subtracting 28 gives the combined size of the payload chain. The dissector uses this field as pduBytes so any trailing bytes (UDP padding, or a following datagram) cannot leak into the payload.

RELATIONSHIP TO UDP: like UDP's own Length, this is somewhat redundant with the IP/UDP lengths, but it makes the IKE message self-describing and lets an implementation that reassembles or fragments at the IKE layer (RFC 7383 IKE fragmentation) frame messages without consulting the transport.`,
    },
  ],
  // The IKE header is a fixed 28 bytes (RFC 7296 §3.1): 8 + 8 + 1 + 1 + 1 + 1 + 4 + 4.
  headerBytes: (): number => 28,
  // The Length field counts the whole message (header + payloads), so it bounds
  // the PDU and keeps trailing/UDP-padding bytes out of the payload.
  pduBytes: (h: ParsedHeader): number => h.get('length'),
  // After the header comes a variable chain of IKE payloads (each a generic
  // payload header + type-specific body), and from IKE_AUTH onward the body is
  // an opaque Encrypted (SK) payload. There is no fixed child bit grid to
  // dissect, so we stop here and leave the payload chain as node.payload.
  next: (): string | null => null,
};
