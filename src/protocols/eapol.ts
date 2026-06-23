// EAPOL — EAP over LANs (IEEE Std 802.1X, "Port-Based Network Access Control").
// Frame format: IEEE 802.1X-2004 §7.2 (and unchanged in 802.1X-2010/2020 §11.3).
// EAPOL is carried directly in a MAC frame with EtherType 0x888E (the "PAE
// EtherType"); the destination is usually the PAE group address
// 01:80:C2:00:00:03. The EAP method itself (carried inside an EAP-Packet) is
// defined by RFC 3748 (Extensible Authentication Protocol).
//
// The EAPOL header is a fixed 4 octets:
//   +0  Protocol Version (1 byte)   1 = 802.1X-2001, 2 = 802.1X-2004, 3 = 802.1X-2010
//   +1  Packet Type      (1 byte)   what kind of EAPOL frame this is (see enumMap)
//   +2  Packet Body Length (2 bytes, big-endian)  octets in the body that FOLLOW
//        the 4-byte header (0 for EAPOL-Start / EAPOL-Logoff, which have no body)
//   +4  Packet Body (variable)      e.g. an EAP packet (RFC 3748) or an EAPOL-Key.
//
// We model only the fixed 4-byte header. The body (EAP / EAPOL-Key) falls through
// as node.payload, bounded by Packet Body Length. next() returns null because the
// child structure depends on the packet type and is not dissected here.
import type { ProtocolSpec } from '../core/types';

const PACKET_TYPE: Record<number, string> = {
  0: 'EAP-Packet',
  1: 'EAPOL-Start',
  2: 'EAPOL-Logoff',
  3: 'EAPOL-Key',
  4: 'EAPOL-Encapsulated-ASF-Alert',
};

const VERSION: Record<number, string> = {
  1: '802.1X-2001',
  2: '802.1X-2004',
  3: '802.1X-2010',
};

export const eapol: ProtocolSpec = {
  id: 'eapol',
  name: 'EAPOL (802.1X)',
  layer: 2,
  summary:
    'Extensible Authentication Protocol over LANs: the IEEE 802.1X frame (EtherType 0x888E) a supplicant and authenticator exchange to gate a switch port or Wi-Fi association until the user/device authenticates. A 4-byte header — version, packet type, body length — wraps an EAP packet or an EAPOL-Key.',
  fields: [
    {
      name: 'version',
      label: 'Protocol Version',
      bits: 8,
      type: 'enum',
      enumMap: VERSION,
      note: '1 = 802.1X-2001, 2 = 802.1X-2004, 3 = 802.1X-2010.',
      desc: 'The version of the 802.1X EAPOL encapsulation. A receiver must accept any version it understands and ignore frames whose version it cannot process; the value does not change the layout of this 4-byte header.',
      detail: `PROTOCOL VERSION (1 byte, IEEE 802.1X-2004 §7.2):
- 1 = 802.1X-2001 (the original standard)
- 2 = 802.1X-2004 (added EAPOL-Key rework, MKA groundwork)
- 3 = 802.1X-2010 (MACsec Key Agreement, EAPOL-Announcement, EAPOL-MKA types)

The version applies to the EAPOL framing, NOT to the EAP method inside an
EAP-Packet. A PAE that receives a higher version than it implements processes
the frame as if it were its own highest supported version where possible.`,
    },
    {
      name: 'type',
      label: 'Packet Type',
      bits: 8,
      type: 'enum',
      enumMap: PACKET_TYPE,
      note: '0 EAP-Packet, 1 EAPOL-Start, 2 EAPOL-Logoff, 3 EAPOL-Key, 4 EAPOL-Encapsulated-ASF-Alert.',
      desc: 'Identifies what this EAPOL frame is. EAP-Packet carries an actual EAP request/response/success/failure; EAPOL-Start and EAPOL-Logoff are bodyless control frames a supplicant uses to begin or end authentication; EAPOL-Key carries key material.',
      detail: `PACKET TYPE (1 byte, IEEE 802.1X-2004 §7.5.4):
- 0  EAP-Packet                  — body is one EAP packet (RFC 3748): the actual
                                    Identity/MD5/TLS/PEAP exchange.
- 1  EAPOL-Start                 — supplicant asks the authenticator to begin
                                    authentication. No body (length = 0).
- 2  EAPOL-Logoff                — supplicant signals it is leaving; the port
                                    returns to the unauthorized state. No body.
- 3  EAPOL-Key                   — carries key descriptors (e.g. the WPA/WPA2
                                    4-way handshake EAPOL-Key frames).
- 4  EAPOL-Encapsulated-ASF-Alert — carries an ASF alert before authentication.

802.1X-2010 adds further types (EAPOL-MKA = 5, EAPOL-Announcement = 6/7,
EAPOL-Announcement-Req = 8) for MACsec; those are out of scope here.`,
    },
    {
      name: 'length',
      label: 'Packet Body Length',
      bits: 16,
      decode: (v) => `${v} bytes` + (v === 0 ? ' (no body — bodyless control frame)' : ''),
      note: 'Octets in the body AFTER this 4-byte header. 0 for EAPOL-Start / EAPOL-Logoff.',
      desc: 'The length in octets of the Packet Body that follows this header — it does NOT include the 4-byte EAPOL header itself. For bodyless frames (EAPOL-Start, EAPOL-Logoff) it is 0, and the dissector stops the payload here so Ethernet padding cannot leak in.',
      detail: `PACKET BODY LENGTH (2 bytes, big-endian, IEEE 802.1X-2004 §7.2):
"the length in octets of the Packet Body field." It counts ONLY the body, not
the 4 header octets.

WHY IT MATTERS HERE: EAPOL frames are tiny and often sit inside a minimum-size
Ethernet frame, so the wire carries trailing zero padding after the body. The
PDU length is therefore 4 + Packet Body Length, and the dissector uses pduBytes
to stop exactly there — the padding becomes the frame's trailer, never payload.

For EAPOL-Start and EAPOL-Logoff the body length is 0; the entire 60-byte
minimum frame is the 4-byte header plus padding.`,
    },
  ],
  // Fixed 4-byte header; the Packet Body Length bounds the rest of the PDU.
  headerBytes: () => 4,
  pduBytes: (h) => 4 + h.get('length'),
  // The body's structure depends on the packet type (EAP packet vs EAPOL-Key) and
  // is not dissected generically here, so we stop and expose it as node.payload.
  next: () => null,
};
