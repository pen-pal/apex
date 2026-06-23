// VRRP version 2 advertisement. RFC 3768 (Virtual Router Redundancy Protocol,
// 2004), which obsoletes RFC 2338. Carried directly in IP as protocol number 112,
// sent to the IPv4 multicast group 224.0.0.18 with TTL 255.
//
// VRRP lets a set of routers share one "virtual" IP (and a virtual MAC,
// 00-00-5E-00-01-{VRID}) so hosts can use a single default gateway that survives
// a router failure. One router is elected Master and answers for the virtual IP;
// the others are Backups. The Master multicasts ADVERTISEMENT messages at the
// Advertisement Interval; if Backups stop hearing them (Master_Down_Interval),
// the highest-priority Backup takes over.
//
// Packet format (RFC 3768 section 5.1), all big-endian / network order:
//   0                   1                   2                   3
//   0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
//  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//  |Version| Type  | Virtual Rtr ID|   Priority    | Count IP Addrs|
//  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//  |   Auth Type   |   Adver Int   |          Checksum             |
//  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//  |                     IP Address (1..Count)                     |
//  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//  |                  Authentication Data (1..2)                   |
//  +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//
// This spec models the fixed 8-byte header. The Count-IP-Addrs virtual IPv4
// addresses (4 bytes each) and any Authentication Data fall through as the node
// payload — see the note on countIpAddrs.
import type { ProtocolSpec } from '../core/types';

const TYPE: Record<number, string> = { 1: 'ADVERTISEMENT' };

// RFC 3768 reserves Auth Type 1 and 2 (kept for backward compatibility with the
// RFC 2338 mechanisms that originally defined them).
const AUTH_TYPE: Record<number, string> = {
  0: 'No Authentication',
  1: 'Simple Text Password (reserved, RFC 2338)',
  2: 'IP Authentication Header (reserved, RFC 2338)',
};

export const vrrp: ProtocolSpec = {
  id: 'vrrp',
  name: 'VRRPv2',
  layer: 3,
  summary: 'First-hop router redundancy: the elected Master multicasts advertisements for a shared virtual IP so a backup can transparently take over if it fails.',
  fields: [
    {
      name: 'version', label: 'Version', bits: 4,
      note: '2 for VRRPv2.',
      desc: 'The VRRP protocol version. This spec covers version 2 (RFC 3768); version 3 (RFC 5798) adds IPv6 support and a different, sub-second timer encoding.',
      detail: `VERSION (4 bits): the high nibble of the first byte. 2 = VRRPv2 (RFC 3768, IPv4 only).

Version 3 (RFC 5798) changed the timer: VRRPv2's Advertisement Interval is 8 bits in whole SECONDS, while VRRPv3 uses a 12-bit "Max Adver Int" in CENTISECONDS, allowing sub-second failover. A v2 and a v3 router cannot interoperate on the same virtual router.`,
    },
    {
      name: 'type', label: 'Type', bits: 4, type: 'enum', enumMap: TYPE,
      note: '1 = ADVERTISEMENT (the only type).',
      desc: 'The VRRP message type. RFC 3768 defines exactly one type, 1 = ADVERTISEMENT; a packet with any other type value must be discarded.',
      detail: `TYPE (4 bits): the low nibble of the first byte. The only defined value is 1 (ADVERTISEMENT), the periodic heartbeat the Master multicasts to assert it still owns the virtual router. There is no separate "election" or "resign" message: a Master that is shutting down simply sends an ADVERTISEMENT with Priority 0 so a Backup takes over immediately rather than waiting out the Master_Down_Interval.`,
    },
    {
      name: 'virtualRouterId', label: 'Virtual Router ID', bits: 8,
      note: 'VRID, 1-255; identifies the virtual router.',
      desc: 'The Virtual Router IDentifier (VRID), 1-255. All routers backing the same virtual IP share one VRID, which also forms the virtual MAC address 00-00-5E-00-01-{VRID}.',
      detail: `VIRTUAL ROUTER ID (8 bits, range 1-255): the configured identity of the virtual router. Every physical router participating in a given virtual router is configured with the same VRID.

VIRTUAL MAC: the VRID becomes the last byte of the IANA-assigned virtual MAC address 00-00-5E-00-01-XX (where XX = VRID). The Master replies to ARP for the virtual IP with this MAC, so when failover happens the new Master inherits the same MAC and hosts need not re-ARP.`,
    },
    {
      name: 'priority', label: 'Priority', bits: 8,
      note: '255 = address owner, 100 = default, 0 = Master is resigning.',
      desc: 'Election priority for this router. Higher wins the Master role. 255 means this router owns the virtual IP as a real interface address; 100 is the default for a Backup; 0 is a special "I am resigning" signal.',
      detail: `PRIORITY (8 bits, RFC 3768 section 5.3.4):
- 255: this router is the IP ADDRESS OWNER — the virtual IP is configured as a real address on its interface. The owner, when up, is always Master.
- 1-254: a Backup's configured priority. 100 is the recommended default.
- 0: a special value meaning the CURRENT MASTER HAS STOPPED participating in VRRP. The Master sends this in a final advertisement when shutting down so a Backup can take over at once instead of waiting Master_Down_Interval.

Higher priority wins; ties are broken by the higher primary IP address of the sending interface.`,
    },
    {
      name: 'countIpAddrs', label: 'Count IP Addrs', bits: 8,
      note: 'Number of virtual IPv4 addresses that follow the header.',
      desc: 'How many virtual IPv4 addresses this virtual router holds. That many 4-byte addresses immediately follow the 8-byte header; they are part of the payload in this model.',
      detail: `COUNT IP ADDRS (8 bits): the number of IPv4 addresses associated with this virtual router. Each is a 32-bit (4-byte) address carried right after the fixed header.

PAYLOAD LAYOUT after this 8-byte header:
  Count x 4 bytes : the virtual IPv4 address(es)
  + Authentication Data : in VRRPv2 the auth fields are 8 bytes total (two 32-bit words); with Auth Type 0 they are sent as zero. RFC 3768 deprecates authentication, so these are typically all zeros.

This spec models only the fixed header; the addresses and auth data fall through as node.payload. The VRRP checksum covers the ENTIRE message (header + addresses + auth data), so it cannot be verified from the 8-byte header alone.`,
    },
    {
      name: 'authType', label: 'Auth Type', bits: 8, type: 'enum', enumMap: AUTH_TYPE,
      note: '0 = none. 1/2 reserved (RFC 2338 simple-text / IP-AH).',
      desc: 'The authentication method. RFC 3768 only uses 0 (no authentication) and reserves 1 and 2, which RFC 2338 had defined as Simple Text Password and IP Authentication Header.',
      detail: `AUTH TYPE (8 bits):
- 0: No Authentication — the only mechanism in RFC 3768. All receivers accept the packet without an auth check.
- 1: Simple Text Password (RFC 2338) — an 8-byte cleartext password in the Authentication Data. Removed in RFC 3768 because cleartext on a multicast LAN gives no real security; the value is now RESERVED.
- 2: IP Authentication Header (RFC 2338) — used IPsec AH. Also removed and RESERVED in RFC 3768.

RFC 3768 dropped authentication entirely on the reasoning that it does not protect against a malicious host on the LAN and adds complexity; on a trusted segment VRRP integrity rests on the link itself.`,
    },
    {
      name: 'advertisementInterval', label: 'Adver Int', bits: 8,
      note: 'Seconds between advertisements (default 1).',
      desc: 'How often, in whole seconds, the Master sends advertisements. Default is 1. Backups use it to compute when to declare the Master down.',
      detail: `ADVERTISEMENT INTERVAL (8 bits, in SECONDS, default 1): the Master multicasts an ADVERTISEMENT every Adver Int seconds.

DERIVED TIMERS:
  Master_Down_Interval = 3 * Adver_Int + Skew_Time
  Skew_Time = (256 - Priority) / 256   (seconds)
A Backup that hears no advertisement for Master_Down_Interval declares the Master down and begins its own election. Skew_Time makes a higher-priority Backup time out slightly sooner, so it tends to win.

VRRPv3 (RFC 5798) replaced this 1-second-granularity field with centiseconds for sub-second failover.`,
    },
    {
      name: 'checksum', label: 'Checksum', bits: 16, type: 'hex',
      note: 'Internet checksum over the whole VRRP message.',
      desc: 'A 16-bit ones-complement Internet checksum (RFC 1071) computed over the ENTIRE VRRP message, starting at the Version field — the header plus the virtual IP addresses and authentication data.',
      detail: `CHECKSUM (16 bits, RFC 3768 section 5.3.8): "the 16-bit one's complement of the one's complement sum of the entire VRRP message starting with the version field." Unlike TCP/UDP, NO IP pseudo-header is included — VRRP is its own IP payload and the checksum covers only the VRRP message.

VERIFICATION: because the checksum covers the addresses and auth data that follow the fixed header, it cannot be recomputed from the 8-byte header alone — the full message bytes are needed.

The field is set to 0 while computing, then filled in. As with RFC 1071, summing every 16-bit word of an intact message (including the checksum) yields 0xFFFF.`,
    },
  ],
  // Fixed 8-byte header. The Count x 4 virtual IPv4 addresses and the
  // authentication data follow as payload; VRRP is the top of this stack.
  headerBytes: () => 8,
  next: () => null,
};
