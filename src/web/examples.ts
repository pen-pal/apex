// Real example frames, built end-to-end through the same data-driven specs the
// engine reads (with real IPv4/UDP checksums and a real CRC-32 FCS), so the
// byte, journey, lifecycle and checksum views all show the WHOLE stack —
// Ethernet → IPv4 → transport → app — and the router re-wrap where it applies.
// The application payloads are the same hand-verified captures the protocol
// tests assert against. IPv6/ICMPv6 start at L3 (the Connection has no IPv6
// address yet), so they're shown from their own layer.
import { ProtocolRegistry } from '../core/registry';
import { registerCoreProtocols } from '../protocols';
import { buildStack, DEFAULT_CONNECTION } from '../core/builder';
import type { Connection } from '../core/types';

export interface Example {
  id: string;
  label: string;
  startId: string; // protocol id to start dissection at
  bytes: number[];
  note: string;
}

const reg = new ProtocolRegistry();
registerCoreProtocols(reg);

const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));
const BROADCAST_MAC = [0xff, 0xff, 0xff, 0xff, 0xff, 0xff];

/** Wrap an application payload in a full Ethernet/IPv4/transport frame. */
const frame = (stack: string[], payload: number[], leafId: string, conn: Partial<Connection> = {}): number[] =>
  buildStack(stack, payload, reg, { ...DEFAULT_CONNECTION, ...conn }, leafId).bytes;

// ---- application-layer payloads (hand-verified, same as the protocol tests) ----

const DNS_QUERY = [
  0xdb, 0x42, 0x01, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x03, ...ascii('www'), 0x07, ...ascii('example'), 0x03, ...ascii('com'), 0x00,
  0x00, 0x01, 0x00, 0x01,
];

const ICMP_ECHO = [0x08, 0x00, 0x4d, 0x52, 0x00, 0x01, 0x00, 0x09, ...ascii('abcdefghijklmnopqrstuvwabcdefghi')];

const DHCP_DISCOVER = [
  0x01, 0x01, 0x06, 0x00, 0x00, 0x00, 0x3d, 0x1d, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x0b, 0x82, 0x01, 0xfc, 0x42, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  ...new Array(64).fill(0), ...new Array(128).fill(0),
  0x63, 0x82, 0x53, 0x63,
  0x35, 0x01, 0x01, 0x3d, 0x07, 0x01, 0x00, 0x0b, 0x82, 0x01, 0xfc, 0x42,
  0x37, 0x03, 0x01, 0x03, 0x06, 0xff,
];

const HTTP_REQ = ascii('GET / HTTP/1.1\r\nHost: example.com\r\n\r\n');

const TLS_CLIENTHELLO = [
  0x16, 0x03, 0x01, 0x00, 0xa5, 0x01, 0x00, 0x00, 0xa1, 0x03, 0x03,
  0x17, 0x03, 0x03, 0x00, 0x02, 0xde, 0xad,
];

const QUIC_INITIAL = [
  0xc0, 0x00, 0x00, 0x00, 0x01, 0x08, 0x83, 0x94,
  0xc8, 0xf0, 0x3e, 0x51, 0x57, 0x08, 0x00, 0x00, 0x44, 0x9e, 0x7b, 0x9a, 0xec, 0x34, 0xd1, 0xb1,
];

const ARP_REQUEST = [
  0x00, 0x01, 0x08, 0x00, 0x06, 0x04, 0x00, 0x01,
  0x00, 0x1c, 0x42, 0x9a, 0xbc, 0xde, 0xc0, 0xa8, 0x01, 0x0a,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xc0, 0xa8, 0x01, 0x01,
];

// ICMPv6 Echo Request — its checksum (0xd1df) is computed over the fe80::1 → fe80::2
// pseudo-header, so the example frame uses those link-local addresses.
const ICMPV6_ECHO = [0x80, 0x00, 0xd1, 0xdf, 0x1f, 0x3a, 0x00, 0x01, ...ascii('abcdefgh')];
const FE80_1 = [0xfe, 0x80, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0x01];
const FE80_2 = [0xfe, 0x80, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0x02];

// ---- second-fleet application/other payloads (hand-verified, from the tests) ----
const NTP_REQUEST = [0x23, 0x00, 0x06, 0xec, ...new Array(44).fill(0)]; // NTPv4 client request
const SMB2_NEGOTIATE = [
  0xfe, 0x53, 0x4d, 0x42, 0x40, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0xff, 0xfe, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  ...new Array(16).fill(0), 0x24, 0x00, 0x08, 0x00, // body start (NEGOTIATE req StructureSize 36)
];
const OSPF_HELLO = [
  0x02, 0x01, 0x00, 0x2c, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0xfa, 0x9c, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // 24-byte common header
  0xff, 0xff, 0xff, 0x00, 0x00, 0x0a, 0x02, 0x01, 0x00, 0x00, 0x00, 0x28, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, // Hello body
];
const IGMP_REPORT = [0x16, 0x00, 0x09, 0x03, 0xe0, 0x00, 0x00, 0xfc];
const RTP_PACKET = [0x80, 0x00, 0x1a, 0x2b, 0x00, 0x01, 0x5f, 0x90, 0xde, 0xad, 0xbe, 0xef, ...new Array(160).fill(0xff)];
const SSH_KEXINIT = [0x00, 0x00, 0x00, 0x0c, 0x06, 0x14, 0x00, 0x11, 0x22, 0x33, 0xde, 0xad, 0xbe, 0xef, 0xca, 0xfe];
const SIP_INVITE = ascii(
  'INVITE sip:bob@biloxi.com SIP/2.0\r\n' +
    'Via: SIP/2.0/UDP pc33.atlanta.com;branch=z9hG4bK776asdhds\r\n' +
    'To: Bob <sip:bob@biloxi.com>\r\nFrom: Alice <sip:alice@atlanta.com>;tag=1928301774\r\n' +
    'CSeq: 314159 INVITE\r\n\r\n',
);
const FTP_GREETING = ascii('220 Service ready for new user.\r\n');

// VLAN-tagged frame carrying a full IPv4/UDP/DNS stack, and a GRE tunnel carrying IPv4/TCP/HTTP.
const VLAN_TAG = [0xa0, 0x64, 0x08, 0x00]; // PCP 5, VID 100, inner EtherType IPv4
const GRE_HDR = [0x00, 0x00, 0x08, 0x00]; // no checksum/key/seq, ProtocolType IPv4

const TFTP_RRQ = [0x00, 0x01, ...ascii('rfc1350.txt'), 0x00, ...ascii('octet'), 0x00];
const SNMP_GET = [
  0x30, 0x28, 0x02, 0x01, 0x01, 0x04, 0x06, ...ascii('public'),
  0xa0, 0x1b, 0x02, 0x04, 0x12, 0x34, 0x56, 0x78, 0x02, 0x01, 0x00, 0x02, 0x01, 0x00,
  0x30, 0x0d, 0x30, 0x0b, 0x06, 0x07, 0x2b, 0x06, 0x01, 0x02, 0x01, 0x01, 0x01, 0x00, 0x05, 0x00,
];
const TELNET_NEG = [0xff, 0xfd, 0x18, 0xff, 0xfb, 0x01, ...ascii('login: ')];
const SMTP_GREETING = ascii('220 mx.example.net ESMTP ready\r\n');
const POP3_GREETING = ascii('+OK POP3 server ready\r\n');
const IMAP_LOGIN = ascii('a001 LOGIN bob secret\r\n');

// ---- third-fleet payloads (hand-verified, from the tests) ----
const SCTP_INIT = [
  0x0b, 0x80, 0x0b, 0x59, 0x00, 0x00, 0x00, 0x00, 0x74, 0x8a, 0x9a, 0x0c, // common header (real CRC32c)
  0x01, 0x00, 0x00, 0x14, 0x12, 0x34, 0x56, 0x78, 0x00, 0x00, 0xff, 0xff,
  0x00, 0x0a, 0x00, 0x05, 0xab, 0xcd, 0xef, 0x01, // INIT chunk
];
const ESP_PKT = [0x00, 0x00, 0x02, 0x01, 0x00, 0x00, 0x00, 0x01, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88];
const VRRP_ADV = [0x21, 0x01, 0x64, 0x01, 0x00, 0x01, 0xba, 0x52, 0xc0, 0xa8, 0x00, 0x01];
const BGP_KEEPALIVE = [...new Array(16).fill(0xff), 0x00, 0x13, 0x04];
const LLDP_TLVS = [
  0x02, 0x07, 0x04, 0x00, 0x12, 0x34, 0x56, 0x78, 0x9a, // Chassis ID TLV
  0x04, 0x07, 0x03, 0x00, 0x12, 0x34, 0x56, 0x78, 0x9b, // Port ID TLV
];
const EAPOL_EAP = [0x02, 0x00, 0x00, 0x05, 0x01, 0x01, 0x00, 0x05, 0x01];
const PPPOE_SESSION = [
  0x11, 0x00, 0x00, 0x11, 0x00, 0x14, // PPPoE session header (len 20)
  0xc0, 0x21, 0x01, 0x01, 0x00, 0x12, 0x01, 0x04, 0x05, 0xd4, 0x05, 0x06, 0x1a, 0x2b, 0x3c, 0x4d, 0x07, 0x02, 0x08, 0x02,
];
const VXLAN_HDR = [0x08, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x00]; // I-bit set, VNI 66051
const WG_INIT = [0x01, 0x00, 0x00, 0x00, 0x78, 0x56, 0x34, 0x12, 0xde, 0xad, 0xbe, 0xef, 0xca, 0xfe, 0xba, 0xbe];
const MQTT_CONNECT = [0x10, 0x0c, 0x00, 0x04, 0x4d, 0x51, 0x54, 0x54, 0x04, 0x02, 0x00, 0x3c, 0x00, 0x00];
const MODBUS_READ = [0x00, 0x01, 0x00, 0x00, 0x00, 0x06, 0x11, 0x03, 0x00, 0x6b, 0x00, 0x03];
const RADIUS_REQ = [
  0x01, 0x00, 0x00, 0x20, 0x0f, 0x40, 0x3f, 0x94, 0x73, 0x97, 0x80, 0x57, 0xbd, 0x83, 0xd5, 0xcb, 0x98, 0xf4, 0x22, 0x7a,
  0x01, 0x06, 0x6e, 0x65, 0x6d, 0x6f, 0x04, 0x06, 0x0a, 0x00, 0x00, 0x01, // AVPs
];
const SYSLOG_MSG = [
  ...new TextEncoder().encode("<34>1 2003-10-11T22:14:15.003Z mymachine.example.com su - ID47 - ﻿'su root' failed for lonvick"),
];

// ---- fourth-fleet payloads ----
const DHCPV6_SOLICIT = [
  0x01, 0x10, 0x08, 0x74, 0x00, 0x08, 0x00, 0x02, 0x00, 0x00,
  0x00, 0x01, 0x00, 0x0e, 0x00, 0x01, 0x00, 0x01, 0x1d, 0x1e, 0x0b, 0x36, 0x00, 0x0c, 0x29, 0xe5, 0x41, 0x33,
];
const LLMNR_QUERY = [
  0xa1, 0xb2, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x04, 0x77, 0x70, 0x61, 0x64, 0x00, 0x00, 0x01, 0x00, 0x01, // "wpad" A IN
];
const NBNS_QUERY = [
  0x83, 0x0a, 0x01, 0x10, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x20, 0x43, 0x4b, ...new Array(30).fill(0x41), 0x00, 0x00, 0x20, 0x00, 0x01, // encoded name + NB/IN
];
const KERBEROS_ASREQ = [
  0x6a, 0x1b, 0x30, 0x19, 0xa1, 0x03, 0x02, 0x01, 0x05, 0xa2, 0x03, 0x02, 0x01, 0x0a,
  0xa3, 0x0d, 0x30, 0x0b, 0xa1, 0x04, 0x02, 0x02, 0x00, 0x02, 0xa2, 0x03, 0x04, 0x01, 0x00,
];
const LDAP_BIND = [0x30, 0x0c, 0x02, 0x01, 0x01, 0x60, 0x07, 0x02, 0x01, 0x03, 0x04, 0x00, 0x80, 0x00];
const TACACS_START = [0xc0, 0x01, 0x01, 0x00, 0x6a, 0x73, 0x57, 0xfa, 0x00, 0x00, 0x00, 0x14, ...new Array(20).fill(0xab)];
const DTLS_RECORD = [
  0x16, 0xfe, 0xfd, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x0c, // 13-byte record header (len 12)
  0x01, 0x00, 0x00, 0x49, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x49,
];
const ISAKMP_INIT = [
  0x90, 0x9d, 0x3a, 0x2f, 0x1c, 0x77, 0xb4, 0x05, 0, 0, 0, 0, 0, 0, 0, 0,
  0x21, 0x20, 0x22, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x1c, // length 28 (header only)
];
const COAP_GET = [0x40, 0x01, 0x12, 0x34, 0xbb, 0x2e, 0x77, 0x65, 0x6c, 0x6c, 0x2d, 0x6b, 0x6e, 0x6f, 0x77, 0x6e];
const SSDP_MSEARCH = ascii(
  'M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nMAN: "ssdp:discover"\r\nMX: 1\r\nST: ssdp:all\r\n\r\n',
);

// ---- fifth-fleet payloads (routing & L2 control) ----
const RIP_RESP = [
  0x02, 0x02, 0x00, 0x00,
  0x00, 0x02, 0x00, 0x00, 0xc0, 0xa8, 0x01, 0x00, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01,
];
const EIGRP_HELLO = [
  0x02, 0x05, 0xee, 0x68, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x64,
];
const PIM_HELLO = [
  0x20, 0x00, 0x79, 0xf4, 0x00, 0x01, 0x00, 0x02, 0x00, 0x69, 0x00, 0x14, 0x00, 0x04, 0xa1, 0xb2, 0xc3, 0xd4,
];
const ISIS_HELLO = [0x83, 0x1b, 0x01, 0x00, 0x0f, 0x01, 0x00, 0x01, 0x01, 0x19, 0x21, 0x68, 0x00, 0x10, 0x01];
const HSRP_HELLO = [
  0x00, 0x00, 0x10, 0x03, 0x0a, 0x64, 0x01, 0x00, 0x63, 0x69, 0x73, 0x63, 0x6f, 0x00, 0x00, 0x00, 0xc0, 0xa8, 0x00, 0x0a,
];
const STP_BPDU = [
  0x00, 0x00, 0x00, 0x00, 0x00, 0x80, 0x00, 0x00, 0x1c, 0x0e, 0x87, 0x78, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x80, 0x00, 0x00, 0x1c, 0x0e, 0x87, 0x78, 0x00, 0x80, 0x01, 0x00, 0x00, 0x14, 0x00, 0x02, 0x00, 0x0f, 0x00,
];
const CDP_PKT = [
  0x02, 0xb4, 0x16, 0xca, 0x00, 0x01, 0x00, 0x1a, 0x46, 0x4f, 0x58, 0x30, 0x34, 0x31, 0x37, 0x31, 0x34, 0x31, 0x36,
  0x28, 0x63, 0x65, 0x70, 0x73, 0x72, 0x2d, 0x37, 0x2d, 0x31, 0x29,
];
const MPLS_STACK = [0x00, 0x06, 0x4a, 0xff, 0x00, 0x01, 0x21, 0x41, 0x45, 0x00, 0x00, 0x54, 0x12, 0x34, 0x40, 0x00, 0x40, 0x01];
const L2TP_CTRL = [0xc8, 0x02, 0x00, 0x0c, 0x00, 0x01, 0x00, 0x00];
// ---- sixth-fleet payloads ----
const RTCP_SR = [
  0x80, 0xc8, 0x00, 0x06, 0xde, 0xad, 0xbe, 0xef, 0x83, 0xaa, 0x7e, 0x80, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x01, 0x5f, 0x90, 0x00, 0x00, 0x00, 0x64, 0x00, 0x00, 0x4e, 0x20,
];
const DIAMETER_DWR = [
  0x01, 0x00, 0x00, 0x14, 0x80, 0x00, 0x01, 0x18, 0x00, 0x00, 0x00, 0x00,
  0x53, 0xca, 0xff, 0x21, 0x7d, 0xdf, 0x9e, 0x6a,
];
const AMQP_METHOD = [0x01, 0x00, 0x01, 0x00, 0x00, 0x00, 0x05, 0x00, 0x14, 0x00, 0x0a, 0x00, 0xce];
const SUNRPC_CALL = [
  0x12, 0x34, 0x56, 0x78, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01, 0x86, 0xa0,
  0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x03, ...new Array(16).fill(0),
];
const ISCSI_LOGIN = [
  0x43, 0x9c, 0x00, 0x00, 0x00, 0x00, 0x00, 0xe7,
  0x40, 0x00, 0x01, 0x37, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x49, 0x6e,
];
const PTP_SYNC = [
  0x00, 0x02, 0x00, 0x2c, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x1b, 0x19, 0xff, 0xfe, 0xee, 0xef, 0xc0, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00,
];
const GTP_GPDU = [
  0x30, 0xff, 0x00, 0x54, 0x12, 0x34, 0x56, 0x78,
  0x45, 0x00, 0x00, 0x54, 0x00, 0x00, 0x40, 0x00, 0x40, 0x01, 0x00, 0x00, 0x0a, 0x00, 0x00, 0x01, 0x0a, 0x00, 0x00, 0x02,
];
const BACNET_NPDU = [0x81, 0x0b, 0x00, 0x0c, 0x01, 0x20, 0xff, 0xff, 0x00, 0xff, 0x10, 0x08];
const DNP3_LINK = [0x05, 0x64, 0x05, 0xc0, 0x01, 0x00, 0x04, 0x00, 0x5b, 0xcf];
const STUN_BIND = [
  0x00, 0x01, 0x00, 0x00, 0x21, 0x12, 0xa4, 0x42,
  0xb7, 0xe7, 0xa7, 0x01, 0xbc, 0x34, 0xd6, 0x86, 0xfa, 0x87, 0xdf, 0xae,
];

// ---- seventh-fleet payloads ----
const SMB1_NEG = [
  0xff, 0x53, 0x4d, 0x42, 0x72, 0x00, 0x00, 0x00, 0x00, 0x18, 0x53, 0xc8, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff, 0xfe, 0x00, 0x00, 0x40, 0x00,
];
const RDP_CR = [
  0x03, 0x00, 0x00, 0x2c, 0x27, 0xe0, 0x00, 0x00, 0x00, 0x00, 0x00,
  ...ascii('Cookie: mstshash=eltons\r\n'), 0x01, 0x00, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00,
];
const RFB_REQ = [0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x04, 0x00, 0x03, 0x00];
const SOCKS_CONNECT = [0x05, 0x01, 0x00, 0x01, 0xc0, 0xa8, 0x01, 0x01, 0x01, 0xbb];
const WS_FRAME = [0x81, 0x85, 0x37, 0xfa, 0x21, 0x3d, 0x7f, 0x9f, 0x4d, 0x51, 0x58];
const RARP_REQ = [
  0x00, 0x01, 0x08, 0x00, 0x06, 0x04, 0x00, 0x03,
  0x00, 0x1c, 0x42, 0x9a, 0xbc, 0xde, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
];
const DCCP_REQ = [0xc0, 0x00, 0x15, 0xb3, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00];
const IRC_LINE = ascii(':irc.example.com 001 alice :Welcome to the Internet Relay Network alice\r\n');
const XMPP_STREAM = ascii(
  "<stream:stream from='juliet@im.example.com' to='im.example.com' version='1.0' xmlns='jabber:client' xmlns:stream='http://etherx.jabber.org/streams'>",
);
const WHOIS_QUERY = ascii('example.com\r\n');

// A DSL-style chain: PPPoE session → PPP → IPv4 → UDP → DNS.
const PPP_IPV4 = (() => {
  const inner = frame(['ipv4', 'udp'], DNS_QUERY, 'dns', { dstPort: 53 });
  const pppPayload = [0x00, 0x21, ...inner]; // PPP protocol 0x0021 = IPv4
  const len = pppPayload.length;
  return [0x11, 0x00, 0x00, 0x11, (len >> 8) & 255, len & 255, ...pppPayload]; // PPPoE session header + payload
})();

export const EXAMPLES: Example[] = [
  { id: 'arp', label: 'ARP request', startId: 'ethernet',
    bytes: frame(['ethernet'], ARP_REQUEST, 'arp', { dstMac: BROADCAST_MAC }),
    note: 'A broadcast ARP request asking who owns 192.168.1.1 — Ethernet carries ARP directly (no IP layer).' },
  { id: 'icmp', label: 'ICMP echo (ping)', startId: 'ethernet',
    bytes: frame(['ethernet', 'ipv4'], ICMP_ECHO, 'icmp'),
    note: 'A ping inside a real IPv4 packet: Ethernet → IPv4 (protocol 1) → ICMP Echo Request. The IPv4 header checksum is real — try the Checksum tab.' },
  { id: 'dns', label: 'DNS query (over UDP)', startId: 'ethernet',
    bytes: frame(['ethernet', 'ipv4', 'udp'], DNS_QUERY, 'dns', { srcPort: 51000, dstPort: 53 }),
    note: 'Ethernet → IPv4 → UDP (port 53) → DNS query for www.example.com. Full encapsulation with real IPv4 + UDP checksums.' },
  { id: 'dhcp', label: 'DHCP Discover', startId: 'ethernet',
    bytes: frame(['ethernet', 'ipv4', 'udp'], DHCP_DISCOVER, 'dhcp',
      { dstMac: BROADCAST_MAC, srcIp: [0, 0, 0, 0], dstIp: [255, 255, 255, 255], srcPort: 68, dstPort: 67 }),
    note: 'A broadcast DHCP DISCOVER: 0.0.0.0 → 255.255.255.255, UDP 68 → 67. The client has no IP yet, so everything is broadcast.' },
  { id: 'http', label: 'HTTP/1.1 request', startId: 'ethernet',
    bytes: frame(['ethernet', 'ipv4', 'tcp'], HTTP_REQ, 'http', { dstPort: 80 }),
    note: 'Ethernet → IPv4 → TCP (port 80) → an HTTP request. Because TCP is present, the Connection lifecycle tab shows the real TCP state machine.' },
  { id: 'tls', label: 'TLS ClientHello', startId: 'ethernet',
    bytes: frame(['ethernet', 'ipv4', 'tcp'], TLS_CLIENTHELLO, 'tls', { dstPort: 443 }),
    note: 'Ethernet → IPv4 → TCP (port 443) → a TLS record. After the handshake, records become opaque ciphertext — shown honestly, never faked.' },
  { id: 'quic', label: 'QUIC Initial (over UDP)', startId: 'ethernet',
    bytes: frame(['ethernet', 'ipv4', 'udp'], QUIC_INITIAL, 'quic', { dstPort: 443 }),
    note: 'Ethernet → IPv4 → UDP (port 443) → a QUIC v1 long header. Only the public prefix is modeled; connection IDs are length-prefixed and the rest is encrypted.' },
  { id: 'ipv6', label: 'DNS over IPv6', startId: 'ethernet',
    bytes: frame(['ethernet', 'ipv6', 'udp'], DNS_QUERY, 'dns', { srcPort: 51000, dstPort: 53 }),
    note: 'Ethernet → IPv6 → UDP (port 53) → DNS. The two 128-bit addresses read as bytes; the UDP checksum is real over the IPv6 pseudo-header.' },
  { id: 'icmpv6', label: 'ICMPv6 echo (over IPv6)', startId: 'ethernet',
    bytes: frame(['ethernet', 'ipv6'], ICMPV6_ECHO, 'icmpv6', { srcIp6: FE80_1, dstIp6: FE80_2 }),
    note: 'Ethernet → IPv6 (Next Header 58) → ICMPv6 Echo Request — the IPv6 counterpart of ping.' },

  { id: 'ntp', label: 'NTP request', startId: 'ethernet',
    bytes: frame(['ethernet', 'ipv4', 'udp'], NTP_REQUEST, 'ntp', { dstPort: 123 }),
    note: 'Ethernet → IPv4 → UDP (port 123) → an NTPv4 client request. The four 64-bit timestamps read as bytes.' },
  { id: 'smb2', label: 'SMB2 Negotiate', startId: 'ethernet',
    bytes: frame(['ethernet', 'ipv4', 'tcp'], SMB2_NEGOTIATE, 'smb2', { dstPort: 445 }),
    note: 'Ethernet → IPv4 → TCP (445) → SMB2. Note SMB2 is little-endian — StructureSize reads 64 thanks to the engine’s endian hook.' },
  { id: 'vlan', label: '802.1Q VLAN → DNS', startId: 'ethernet',
    bytes: frame(['ethernet'], [...VLAN_TAG, ...frame(['ipv4', 'udp'], DNS_QUERY, 'dns', { dstPort: 53 })], 'vlan'),
    note: 'A VLAN-tagged frame: Ethernet (0x8100) → 802.1Q tag → IPv4 → UDP → DNS. The tag carries VLAN id 100.' },
  { id: 'gre', label: 'GRE tunnel (IP-in-IP)', startId: 'ethernet',
    bytes: frame(['ethernet', 'ipv4'], [...GRE_HDR, ...frame(['ipv4', 'tcp'], HTTP_REQ, 'http', { dstPort: 80 })], 'gre'),
    note: 'A GRE tunnel: Ethernet → IPv4 → GRE → inner IPv4 → TCP → HTTP. Two IPv4 headers — the tunnel wraps the original packet.' },
  { id: 'ospf', label: 'OSPF Hello', startId: 'ethernet',
    bytes: frame(['ethernet', 'ipv4'], OSPF_HELLO, 'ospf', { srcIp: [10, 0, 0, 1], dstIp: [224, 0, 0, 5] }),
    note: 'Ethernet → IPv4 (protocol 89) → OSPFv2 Hello, sent to the AllSPFRouters multicast 224.0.0.5.' },
  { id: 'igmp', label: 'IGMP report', startId: 'ethernet',
    bytes: frame(['ethernet', 'ipv4'], IGMP_REPORT, 'igmp', { dstIp: [224, 0, 0, 252] }),
    note: 'Ethernet → IPv4 (protocol 2) → IGMPv2 Membership Report for group 224.0.0.252.' },
  { id: 'rtp', label: 'RTP audio', startId: 'rtp', bytes: RTP_PACKET,
    note: 'An RTP G.711 µ-law voice packet (12-byte header + 160 samples). Shown from its own layer — RTP uses dynamic UDP ports.' },
  { id: 'ssh', label: 'SSH packet', startId: 'ethernet',
    bytes: frame(['ethernet', 'ipv4', 'tcp'], SSH_KEXINIT, 'ssh', { dstPort: 22 }),
    note: 'Ethernet → IPv4 → TCP (22) → an SSH binary packet (KEXINIT). After key exchange the payload is encrypted.' },
  { id: 'sip', label: 'SIP INVITE', startId: 'ethernet',
    bytes: frame(['ethernet', 'ipv4', 'udp'], SIP_INVITE, 'sip', { dstPort: 5060 }),
    note: 'Ethernet → IPv4 → UDP (5060) → a SIP INVITE — VoIP call setup, an HTTP-like text protocol.' },
  { id: 'ftp', label: 'FTP greeting', startId: 'ethernet',
    bytes: frame(['ethernet', 'ipv4', 'tcp'], FTP_GREETING, 'ftp', { dstPort: 21 }),
    note: 'Ethernet → IPv4 → TCP (21) → an FTP control-channel reply — line-based ASCII.' },
  { id: 'tftp', label: 'TFTP read request', startId: 'ethernet',
    bytes: frame(['ethernet', 'ipv4', 'udp'], TFTP_RRQ, 'tftp', { dstPort: 69 }),
    note: 'Ethernet → IPv4 → UDP (69) → a TFTP RRQ. Opcode 1, then the NUL-terminated filename and "octet" mode.' },
  { id: 'snmp', label: 'SNMP GetRequest', startId: 'ethernet',
    bytes: frame(['ethernet', 'ipv4', 'udp'], SNMP_GET, 'snmp', { dstPort: 161 }),
    note: 'Ethernet → IPv4 → UDP (161) → SNMP v2c GetRequest for sysDescr.0. Only the BER wrapper is modeled; the rest is opaque TLV.' },
  { id: 'telnet', label: 'Telnet negotiation', startId: 'ethernet',
    bytes: frame(['ethernet', 'ipv4', 'tcp'], TELNET_NEG, 'telnet', { dstPort: 23 }),
    note: 'Ethernet → IPv4 → TCP (23) → Telnet. Starts with IAC (0xFF) option negotiation (DO TERMINAL-TYPE, WILL ECHO) then ASCII.' },
  { id: 'smtp', label: 'SMTP greeting', startId: 'ethernet',
    bytes: frame(['ethernet', 'ipv4', 'tcp'], SMTP_GREETING, 'smtp', { dstPort: 25 }),
    note: 'Ethernet → IPv4 → TCP (25) → an SMTP 220 server greeting — line-based ASCII.' },
  { id: 'pop3', label: 'POP3 greeting', startId: 'ethernet',
    bytes: frame(['ethernet', 'ipv4', 'tcp'], POP3_GREETING, 'pop3', { dstPort: 110 }),
    note: 'Ethernet → IPv4 → TCP (110) → a POP3 +OK greeting — line-based ASCII.' },
  { id: 'imap', label: 'IMAP login', startId: 'ethernet',
    bytes: frame(['ethernet', 'ipv4', 'tcp'], IMAP_LOGIN, 'imap', { dstPort: 143 }),
    note: 'Ethernet → IPv4 → TCP (143) → an IMAP tagged LOGIN command — line-based ASCII.' },

  { id: 'vxlan', label: 'VXLAN overlay (MAC-in-UDP)', startId: 'ethernet',
    bytes: frame(['ethernet', 'ipv4', 'udp'],
      [...VXLAN_HDR, ...frame(['ethernet', 'ipv4', 'udp'], DNS_QUERY, 'dns', { dstPort: 53 })], 'vxlan', { dstPort: 4789 }),
    note: 'Ethernet → IPv4 → UDP (4789) → VXLAN → an ENTIRE inner Ethernet frame (→ IPv4 → UDP → DNS). VNI 66051 — a network inside a network.' },
  { id: 'sctp', label: 'SCTP INIT', startId: 'ethernet',
    bytes: frame(['ethernet', 'ipv4'], SCTP_INIT, 'sctp'),
    note: 'Ethernet → IPv4 (protocol 132) → SCTP. The common header (ports, verification tag, CRC32c) then an INIT chunk.' },
  { id: 'esp', label: 'IPsec ESP', startId: 'ethernet',
    bytes: frame(['ethernet', 'ipv4'], ESP_PKT, 'esp'),
    note: 'Ethernet → IPv4 (protocol 50) → ESP. Only the SPI + sequence number are cleartext; the rest is encrypted (opaque).' },
  { id: 'vrrp', label: 'VRRP advertisement', startId: 'ethernet',
    bytes: frame(['ethernet', 'ipv4'], VRRP_ADV, 'vrrp', { dstIp: [224, 0, 0, 18] }),
    note: 'Ethernet → IPv4 (protocol 112) → VRRPv2, to the VRRP multicast 224.0.0.18 — routers sharing a virtual gateway IP.' },
  { id: 'bgp', label: 'BGP KEEPALIVE', startId: 'ethernet',
    bytes: frame(['ethernet', 'ipv4', 'tcp'], BGP_KEEPALIVE, 'bgp', { dstPort: 179 }),
    note: 'Ethernet → IPv4 → TCP (179) → BGP. The 16-byte all-ones marker, length 19, type 4 (KEEPALIVE).' },
  { id: 'lldp', label: 'LLDP', startId: 'ethernet',
    bytes: frame(['ethernet'], LLDP_TLVS, 'lldp'),
    note: 'Ethernet (0x88CC) → LLDP. A TLV chain — Chassis ID then Port ID — how switches advertise their identity to neighbours.' },
  { id: 'eapol', label: 'EAPOL (802.1X)', startId: 'ethernet',
    bytes: frame(['ethernet'], EAPOL_EAP, 'eapol'),
    note: 'Ethernet (0x888E) → EAPOL → an EAP-Request/Identity — the start of 802.1X port authentication.' },
  { id: 'pppoe', label: 'PPPoE session', startId: 'ethernet',
    bytes: frame(['ethernet'], PPPOE_SESSION, 'pppoe'),
    note: 'Ethernet (0x8864) → PPPoE Session → a PPP/LCP frame. How DSL carries PPP over Ethernet.' },
  { id: 'wireguard', label: 'WireGuard handshake', startId: 'ethernet',
    bytes: frame(['ethernet', 'ipv4', 'udp'], WG_INIT, 'wireguard', { dstPort: 51820 }),
    note: 'Ethernet → IPv4 → UDP (51820) → WireGuard Handshake Initiation. Only the message type is cleartext; the rest is cryptographic.' },
  { id: 'mqtt', label: 'MQTT CONNECT', startId: 'ethernet',
    bytes: frame(['ethernet', 'ipv4', 'tcp'], MQTT_CONNECT, 'mqtt', { dstPort: 1883 }),
    note: 'Ethernet → IPv4 → TCP (1883) → MQTT CONNECT — the IoT pub/sub handshake. Packet type 1, then a varint length.' },
  { id: 'modbus', label: 'Modbus/TCP', startId: 'ethernet',
    bytes: frame(['ethernet', 'ipv4', 'tcp'], MODBUS_READ, 'modbus', { dstPort: 502 }),
    note: 'Ethernet → IPv4 → TCP (502) → Modbus Read Holding Registers — industrial/SCADA control.' },
  { id: 'radius', label: 'RADIUS Access-Request', startId: 'ethernet',
    bytes: frame(['ethernet', 'ipv4', 'udp'], RADIUS_REQ, 'radius', { dstPort: 1812 }),
    note: 'Ethernet → IPv4 → UDP (1812) → RADIUS Access-Request — AAA, with a 16-byte authenticator and User-Name/NAS-IP AVPs.' },
  { id: 'syslog', label: 'Syslog message', startId: 'ethernet',
    bytes: frame(['ethernet', 'ipv4', 'udp'], SYSLOG_MSG, 'syslog', { dstPort: 514 }),
    note: 'Ethernet → IPv4 → UDP (514) → Syslog (RFC 5424). Text: the <34> priority (facility 4, severity 2) then the structured message.' },

  { id: 'dhcpv6', label: 'DHCPv6 Solicit', startId: 'ethernet',
    bytes: frame(['ethernet', 'ipv6', 'udp'], DHCPV6_SOLICIT, 'dhcpv6', { dstPort: 547 }),
    note: 'Ethernet → IPv6 → UDP (547) → DHCPv6 SOLICIT. msg-type + 24-bit transaction id, then TLV options.' },
  { id: 'llmnr', label: 'LLMNR query', startId: 'ethernet',
    bytes: frame(['ethernet', 'ipv4', 'udp'], LLMNR_QUERY, 'llmnr', { dstPort: 5355 }),
    note: 'Ethernet → IPv4 → UDP (5355) → LLMNR query for "wpad" — link-local name resolution (DNS message format).' },
  { id: 'nbns', label: 'NetBIOS name query', startId: 'ethernet',
    bytes: frame(['ethernet', 'ipv4', 'udp'], NBNS_QUERY, 'nbns', { dstPort: 137 }),
    note: 'Ethernet → IPv4 → UDP (137) → NetBIOS Name Service query — the legacy Windows name lookup.' },
  { id: 'kerberos', label: 'Kerberos AS-REQ', startId: 'ethernet',
    bytes: frame(['ethernet', 'ipv4', 'udp'], KERBEROS_ASREQ, 'kerberos', { dstPort: 88 }),
    note: 'Ethernet → IPv4 → UDP (88) → Kerberos AS-REQ. Only the ASN.1 application tag + length are modeled; the DER body is opaque.' },
  { id: 'ldap', label: 'LDAP BindRequest', startId: 'ethernet',
    bytes: frame(['ethernet', 'ipv4', 'tcp'], LDAP_BIND, 'ldap', { dstPort: 389 }),
    note: 'Ethernet → IPv4 → TCP (389) → an LDAP anonymous BindRequest. ASN.1 BER: the SEQUENCE + messageID prefix.' },
  { id: 'tacacs', label: 'TACACS+ start', startId: 'ethernet',
    bytes: frame(['ethernet', 'ipv4', 'tcp'], TACACS_START, 'tacacs', { dstPort: 49 }),
    note: 'Ethernet → IPv4 → TCP (49) → TACACS+ Authentication START. The 12-byte header; the body is encrypted.' },
  { id: 'dtls', label: 'DTLS record', startId: 'dtls', bytes: DTLS_RECORD,
    note: 'A DTLS 1.2 record (TLS for datagrams): content type, version 0xFEFD, epoch, 48-bit sequence number, length.' },
  { id: 'isakmp', label: 'IKE_SA_INIT', startId: 'ethernet',
    bytes: frame(['ethernet', 'ipv4', 'udp'], ISAKMP_INIT, 'isakmp', { dstPort: 500 }),
    note: 'Ethernet → IPv4 → UDP (500) → ISAKMP/IKEv2 IKE_SA_INIT — the two 64-bit SPIs, exchange type, and flags.' },
  { id: 'coap', label: 'CoAP GET', startId: 'ethernet',
    bytes: frame(['ethernet', 'ipv4', 'udp'], COAP_GET, 'coap', { dstPort: 5683 }),
    note: 'Ethernet → IPv4 → UDP (5683) → a CoAP CON GET for /.well-known — REST for constrained IoT devices.' },
  { id: 'ssdp', label: 'SSDP M-SEARCH', startId: 'ethernet',
    bytes: frame(['ethernet', 'ipv4', 'udp'], SSDP_MSEARCH, 'ssdp', { dstPort: 1900 }),
    note: 'Ethernet → IPv4 → UDP (1900) → an SSDP M-SEARCH — UPnP device discovery (HTTP-over-UDP text).' },

  { id: 'rip', label: 'RIPv2 response', startId: 'ethernet',
    bytes: frame(['ethernet', 'ipv4', 'udp'], RIP_RESP, 'rip', { dstPort: 520 }),
    note: 'Ethernet → IPv4 → UDP (520) → a RIPv2 Response advertising 192.168.1.0/24, metric 1.' },
  { id: 'eigrp', label: 'EIGRP Hello', startId: 'ethernet',
    bytes: frame(['ethernet', 'ipv4'], EIGRP_HELLO, 'eigrp', { dstIp: [224, 0, 0, 10] }),
    note: 'Ethernet → IPv4 (protocol 88) → EIGRP Hello, to the EIGRP multicast 224.0.0.10.' },
  { id: 'pim', label: 'PIM Hello', startId: 'ethernet',
    bytes: frame(['ethernet', 'ipv4'], PIM_HELLO, 'pim', { dstIp: [224, 0, 0, 13] }),
    note: 'Ethernet → IPv4 (protocol 103) → PIM-SM Hello, to the All-PIM-Routers multicast 224.0.0.13.' },
  { id: 'isis', label: 'IS-IS Hello', startId: 'isis', bytes: ISIS_HELLO,
    note: 'An IS-IS L1 LAN Hello common header — interior routing that runs directly over the data link (OSI, not IP). Starts 0x83.' },
  { id: 'hsrp', label: 'HSRP Hello', startId: 'ethernet',
    bytes: frame(['ethernet', 'ipv4', 'udp'], HSRP_HELLO, 'hsrp', { dstPort: 1985, dstIp: [224, 0, 0, 2] }),
    note: 'Ethernet → IPv4 → UDP (1985) → an HSRP Hello (state Active) — routers sharing a virtual gateway. Auth "cisco".' },
  { id: 'stp', label: 'STP BPDU', startId: 'stp', bytes: STP_BPDU,
    note: 'A Spanning Tree Configuration BPDU — root bridge, path cost, and the timers that prevent L2 loops. Carried in an 802.3/LLC frame.' },
  { id: 'cdp', label: 'CDP', startId: 'cdp', bytes: CDP_PKT,
    note: 'Cisco Discovery Protocol — version, TTL, checksum, then TLVs (here the Device-ID). Carried in an 802.3 SNAP frame.' },
  { id: 'mpls', label: 'MPLS label stack', startId: 'ethernet',
    bytes: frame(['ethernet'], MPLS_STACK, 'mpls'),
    note: 'Ethernet (0x8847) → MPLS → MPLS → inner IPv4. Two stacked labels (S=0 then S=1) — how providers tunnel traffic by label, not IP.' },
  { id: 'l2tp', label: 'L2TP control', startId: 'ethernet',
    bytes: frame(['ethernet', 'ipv4', 'udp'], L2TP_CTRL, 'l2tp', { dstPort: 1701 }),
    note: 'Ethernet → IPv4 → UDP (1701) → an L2TP control message. The flags byte (T/L/S/O/P) governs which optional fields follow.' },
  { id: 'ppp', label: 'PPPoE → PPP → IP', startId: 'ethernet',
    bytes: frame(['ethernet'], PPP_IPV4, 'pppoe'),
    note: 'The full DSL chain: Ethernet (0x8864) → PPPoE Session → PPP → IPv4 → UDP → DNS. PPP’s protocol field (0x0021) selects IPv4.' },

  { id: 'rtcp', label: 'RTCP Sender Report', startId: 'rtcp', bytes: RTCP_SR,
    note: 'An RTCP Sender Report — the control channel that rides alongside RTP carrying timing and packet/byte counts for sync and quality.' },
  { id: 'diameter', label: 'Diameter DWR', startId: 'ethernet',
    bytes: frame(['ethernet', 'ipv4', 'tcp'], DIAMETER_DWR, 'diameter', { dstPort: 3868 }),
    note: 'Ethernet → IPv4 → TCP (3868) → a Diameter Device-Watchdog-Request — the AAA protocol that succeeded RADIUS.' },
  { id: 'amqp', label: 'AMQP method frame', startId: 'ethernet',
    bytes: frame(['ethernet', 'ipv4', 'tcp'], AMQP_METHOD, 'amqp', { dstPort: 5672 }),
    note: 'Ethernet → IPv4 → TCP (5672) → an AMQP Channel.Open method frame — the message-queue protocol behind RabbitMQ.' },
  { id: 'sunrpc', label: 'SunRPC GETPORT', startId: 'ethernet',
    bytes: frame(['ethernet', 'ipv4', 'udp'], SUNRPC_CALL, 'sunrpc', { dstPort: 111 }),
    note: 'Ethernet → IPv4 → UDP (111) → an ONC/Sun RPC call to the portmapper (GETPORT) — the foundation NFS is built on.' },
  { id: 'iscsi', label: 'iSCSI Login', startId: 'ethernet',
    bytes: frame(['ethernet', 'ipv4', 'tcp'], ISCSI_LOGIN, 'iscsi', { dstPort: 3260 }),
    note: 'Ethernet → IPv4 → TCP (3260) → an iSCSI Login Request — SCSI storage commands tunnelled over TCP/IP.' },
  { id: 'ptp', label: 'PTP Sync', startId: 'ethernet',
    bytes: frame(['ethernet', 'ipv4', 'udp'], PTP_SYNC, 'ptp', { dstPort: 319 }),
    note: 'Ethernet → IPv4 → UDP (319) → a PTP (IEEE 1588) Sync message — sub-microsecond clock synchronization for telecom and finance.' },
  { id: 'gtp', label: 'GTP-U (mobile)', startId: 'ethernet',
    bytes: frame(['ethernet', 'ipv4', 'udp'], GTP_GPDU, 'gtp', { dstPort: 2152 }),
    note: 'Ethernet → IPv4 → UDP (2152) → GTP-U → a tunnelled user IP packet. How a phone’s traffic crosses the LTE/5G core.' },
  { id: 'bacnet', label: 'BACnet/IP', startId: 'ethernet',
    bytes: frame(['ethernet', 'ipv4', 'udp'], BACNET_NPDU, 'bacnet', { dstPort: 47808, dstIp: [255, 255, 255, 255] }),
    note: 'Ethernet → IPv4 → UDP (47808) → a BACnet/IP broadcast NPDU — building automation (HVAC, lighting, access control).' },
  { id: 'dnp3', label: 'DNP3 (SCADA)', startId: 'ethernet',
    bytes: frame(['ethernet', 'ipv4', 'tcp'], DNP3_LINK, 'dnp3', { dstPort: 20000 }),
    note: 'Ethernet → IPv4 → TCP (20000) → a DNP3 data-link frame (0x0564) — SCADA control for power and water utilities. Note its little-endian addresses.' },
  { id: 'stun', label: 'STUN Binding', startId: 'ethernet',
    bytes: frame(['ethernet', 'ipv4', 'udp'], STUN_BIND, 'stun', { dstPort: 3478 }),
    note: 'Ethernet → IPv4 → UDP (3478) → a STUN Binding Request — how WebRTC discovers your public address behind NAT (note the magic cookie 0x2112A442).' },

  { id: 'smb1', label: 'SMB1 Negotiate', startId: 'ethernet',
    bytes: frame(['ethernet', 'ipv4', 'tcp'], SMB1_NEG, 'smb1', { dstPort: 139 }),
    note: 'Ethernet → IPv4 → TCP (139) → an SMB1/CIFS Negotiate — the legacy file-sharing protocol (0xFF "SMB", little-endian).' },
  { id: 'rdp', label: 'RDP connection', startId: 'ethernet',
    bytes: frame(['ethernet', 'ipv4', 'tcp'], RDP_CR, 'rdp', { dstPort: 3389 }),
    note: 'Ethernet → IPv4 → TCP (3389) → RDP: a TPKT frame wrapping an X.224 Connection Request, with the "mstshash" cookie.' },
  { id: 'rfb', label: 'VNC (RFB)', startId: 'ethernet',
    bytes: frame(['ethernet', 'ipv4', 'tcp'], RFB_REQ, 'rfb', { dstPort: 5900 }),
    note: 'Ethernet → IPv4 → TCP (5900) → an RFB FramebufferUpdateRequest — the VNC remote-desktop protocol asking for a screen region.' },
  { id: 'socks', label: 'SOCKS5 CONNECT', startId: 'ethernet',
    bytes: frame(['ethernet', 'ipv4', 'tcp'], SOCKS_CONNECT, 'socks', { dstPort: 1080 }),
    note: 'Ethernet → IPv4 → TCP (1080) → a SOCKS5 CONNECT request — the proxy protocol that tunnels arbitrary TCP (and what Tor uses).' },
  { id: 'websocket', label: 'WebSocket frame', startId: 'websocket', bytes: WS_FRAME,
    note: 'A masked WebSocket Text frame ("Hello") — full-duplex messaging over a single HTTP-upgraded TCP connection. FIN+opcode, then the mask.' },
  { id: 'irc', label: 'IRC welcome', startId: 'ethernet',
    bytes: frame(['ethernet', 'ipv4', 'tcp'], IRC_LINE, 'irc', { dstPort: 6667 }),
    note: 'Ethernet → IPv4 → TCP (6667) → an IRC numeric reply (001 Welcome) — line-based chat, the original real-time messaging protocol.' },
  { id: 'xmpp', label: 'XMPP stream', startId: 'ethernet',
    bytes: frame(['ethernet', 'ipv4', 'tcp'], XMPP_STREAM, 'xmpp', { dstPort: 5222 }),
    note: 'Ethernet → IPv4 → TCP (5222) → an XMPP (Jabber) stream header — streamed XML stanzas for chat and presence.' },
  { id: 'whois', label: 'WHOIS query', startId: 'ethernet',
    bytes: frame(['ethernet', 'ipv4', 'tcp'], WHOIS_QUERY, 'whois', { dstPort: 43 }),
    note: 'Ethernet → IPv4 → TCP (43) → a WHOIS query — the simplest text protocol: send a name, get a record back.' },
  { id: 'rarp', label: 'RARP request', startId: 'ethernet',
    bytes: frame(['ethernet'], RARP_REQ, 'rarp', { dstMac: BROADCAST_MAC }),
    note: 'Ethernet (0x8035) → RARP — the reverse of ARP: a diskless host asking "what is MY IP?" by its MAC. Superseded by BOOTP/DHCP.' },
  { id: 'dccp', label: 'DCCP request', startId: 'ethernet',
    bytes: frame(['ethernet', 'ipv4'], DCCP_REQ, 'dccp'),
    note: 'Ethernet → IPv4 (protocol 33) → a DCCP-Request — congestion-controlled datagrams (the middle ground between TCP and UDP).' },
];
