// PTP — Precision Time Protocol, version 2 (PTPv2). IEEE Std 1588-2008,
// "IEEE Standard for a Precision Clock Synchronization Protocol for Networked
// Measurement and Control Systems." The common message header transcribed here
// is defined in IEEE 1588-2008 §13.3 (Table 18 — the header layout, Table 19 —
// messageType values, Table 20 — the flagField bits, Table 23 — controlField).
//
// TRANSPORT
// ---------
// PTPv2 is carried either directly over Ethernet (EtherType 0x88F7) or over
// UDP/IPv4 / UDP/IPv6 (the "Annex D/E" mappings): EVENT messages (Sync,
// Delay_Req, Pdelay_Req, Pdelay_Resp — the ones that get hardware-timestamped on
// the wire) use UDP port 319; GENERAL messages (Follow_Up, Delay_Resp, Announce,
// Management, Signaling) use UDP port 320. The split exists so a NIC can apply a
// precise egress/ingress timestamp to event messages only.
//
// THE COMMON HEADER (34 bytes, IEEE 1588-2008 §13.3.1, big-endian / network order):
//
//    0                   1                   2                   3
//    0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
//   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//   |transpSpec |messageType|  rsv  | versPTP |       messageLength         |
//   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//   | domainNumber  |  reserved     |            flagField           |
//   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//   |                       correctionField (8 octets)              |
//   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//   |                       reserved (4 octets)                     |
//   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//   |                  sourcePortIdentity (10 octets)               |
//   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//   |          sequenceId           | controlField  |logMsgInterval |
//   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//
// NOTE on byte 0: per §13.3.2.1 the HIGH nibble (bits 7..4) is transportSpecific
// and the LOW nibble (bits 3..0) is messageType — so transportSpecific is
// transcribed first. Likewise byte 1's high nibble is reserved and the low
// nibble is versionPTP (= 2). Getting these the right way round matters: a Sync
// message's first byte is 0x00, NOT a swapped 0x00, and a message with
// transportSpecific=1 (the 802.1AS profile) reads 0x10 here, not 0x01.
//
// WHAT THIS SPEC MODELS, AND WHAT IT DOES NOT
// -------------------------------------------
// We transcribe the fixed 34-byte common header exactly. The message-specific
// BODY that follows it is different for each messageType (e.g. a Sync body is a
// 10-octet originTimestamp; an Announce body adds the grandmaster clock-quality
// fields and a steps-removed count) and is bounded by `messageLength`. Modelling
// every body as fixed fields here would not be a single grid, so the body falls
// through as node.payload, trimmed to messageLength by pduBytes (so Ethernet
// padding — a 64-byte minimum frame easily pads a 44-byte Sync — never leaks in).
// There is no further encapsulated protocol, so `next` returns null.
import type { ProtocolSpec, ParsedHeader } from '../core/types';

// IEEE 1588-2008 Table 19 — messageType values (the low nibble of byte 0).
// 0x0..0x3 are EVENT messages (UDP port 319); 0x8..0xD are GENERAL (port 320).
const MESSAGE_TYPE: Record<number, string> = {
  0x0: 'Sync',
  0x1: 'Delay_Req',
  0x2: 'Pdelay_Req',
  0x3: 'Pdelay_Resp',
  0x8: 'Follow_Up',
  0x9: 'Delay_Resp',
  0xa: 'Pdelay_Resp_Follow_Up',
  0xb: 'Announce',
  0xc: 'Signaling',
  0xd: 'Management',
};

// IEEE 1588-2008 Table 23 — controlField (retained from PTPv1 for backward
// compatibility; in PTPv2 messageType is authoritative, this is informational).
const CONTROL_FIELD: Record<number, string> = {
  0x00: 'Sync',
  0x01: 'Delay_Req',
  0x02: 'Follow_Up',
  0x03: 'Delay_Resp',
  0x04: 'Management',
  0x05: 'All others',
};

export const ptp: ProtocolSpec = {
  id: 'ptp',
  name: 'PTP (1588)',
  layer: 7,
  summary:
    'The Precision Time Protocol v2 (IEEE 1588-2008): how networks synchronize clocks to sub-microsecond accuracy. A master multicasts Sync messages (timestamped in NIC hardware) and slaves measure the path delay with Delay_Req/Delay_Resp to correct their offset. This 34-byte common header fronts every PTP message; event messages ride UDP/319, general messages UDP/320.',
  fields: [
    {
      name: 'transportSpecific',
      label: 'Transport specific',
      bits: 4,
      decode: (v) => (v === 0 ? '0 (default)' : v === 1 ? '1 (802.1AS / gPTP)' : String(v)),
      note: 'High nibble of byte 0. Profile-defined; 1 marks the IEEE 802.1AS (gPTP) profile.',
      desc: 'The high 4 bits of the first octet. Its meaning is left to the transport mapping / profile in use; the default PTP profiles set it to 0, while IEEE 802.1AS (gPTP, used in Audio/Video Bridging and automotive/TSN) sets it to 1 so its frames are distinguishable from ordinary PTP.',
      detail: `TRANSPORT SPECIFIC (4 bits, IEEE 1588-2008 §13.3.2.1, bits 7..4 of byte 0):
"The transportSpecific field may be used by a lower-layer transport protocol and is otherwise reserved." Its interpretation is defined by the transport mapping or PTP profile.

PROFILE USE: the IEEE 802.1AS (generalized PTP / gPTP) profile sets transportSpecific = 1 (the "majorSdoId"), which lets bridges separate gPTP traffic from generic 1588. Default 1588 profiles leave it 0.

WHY IT IS THE HIGH NIBBLE: byte 0 packs [transportSpecific(4) | messageType(4)]. So a Sync (messageType 0) on a default profile gives byte 0 = 0x00; the same Sync under 802.1AS gives 0x10.`,
    },
    {
      name: 'messageType',
      label: 'Message type',
      bits: 4,
      type: 'enum',
      enumMap: MESSAGE_TYPE,
      decode: (v) => {
        const name = MESSAGE_TYPE[v] ?? `0x${v.toString(16)}`;
        const kind = v <= 0x3 ? 'event, UDP/319' : 'general, UDP/320';
        return `${v} (${name}, ${kind})`;
      },
      note: 'Low nibble of byte 0. 0=Sync, 1=Delay_Req, 8=Follow_Up, 9=Delay_Resp, 0xB=Announce.',
      desc: 'The low 4 bits of the first octet: which kind of PTP message this is. Values 0x0-0x3 are EVENT messages (Sync, Delay_Req, Pdelay_Req/Resp) that are hardware-timestamped and sent to UDP port 319; values 0x8-0xD are GENERAL messages (Follow_Up, Delay_Resp, Announce, Signaling, Management) sent to UDP port 320.',
      detail: `MESSAGE TYPE (4 bits, IEEE 1588-2008 Table 19, bits 3..0 of byte 0):
EVENT (timestamped, UDP/319):
  0x0 Sync        0x1 Delay_Req
  0x2 Pdelay_Req  0x3 Pdelay_Resp
GENERAL (UDP/320):
  0x8 Follow_Up               0x9 Delay_Resp
  0xA Pdelay_Resp_Follow_Up   0xB Announce
  0xC Signaling              0xD Management

THE CORE EXCHANGE (delay-request mechanism):
1. Master -> Sync (event): slave records arrival time t2.
2. (two-step master) Master -> Follow_Up (general): carries the precise egress time t1 of the Sync, which a software stack could not stamp in time.
3. Slave -> Delay_Req (event): slave records send time t3.
4. Master -> Delay_Resp (general): carries the arrival time t4 of the Delay_Req.
From t1..t4 the slave computes offset = ((t2-t1)-(t4-t3))/2 and meanPathDelay = ((t2-t1)+(t4-t3))/2.

ANNOUNCE (0xB) runs the Best Master Clock Algorithm: clocks advertise their quality and the network elects a grandmaster.`,
    },
    {
      name: 'reserved0',
      label: 'Reserved',
      bits: 4,
      note: 'High nibble of byte 1; reserved, transmitted as 0.',
      desc: 'The high 4 bits of byte 1. Reserved in IEEE 1588-2008 and transmitted as 0. (In the later 1588-2019 revision these bits became the minorVersionPTP field, but for the 2008 standard modelled here they are reserved.)',
      detail: `RESERVED (4 bits, bits 7..4 of byte 1, IEEE 1588-2008 §13.3.2.2):
Reserved; senders set it to 0 and receivers ignore it. IEEE 1588-2019 repurposed this nibble as minorVersionPTP (so a 2019 device may put 0x1 here, reading byte 1 as 0x12). Modelling the 2008 standard, it is reserved/0.`,
    },
    {
      name: 'versionPTP',
      label: 'Version PTP',
      bits: 4,
      decode: (v) => `${v}${v === 2 ? ' (PTPv2 / IEEE 1588-2008)' : ''}`,
      note: 'Low nibble of byte 1. 2 for IEEE 1588-2008.',
      desc: 'The low 4 bits of byte 1: the PTP version. The value 2 identifies IEEE 1588-2008 (PTPv2). A node discards messages whose versionPTP it does not support; PTPv1 (1588-2002) used a completely different message format and is not interoperable.',
      detail: `VERSION PTP (4 bits, bits 3..0 of byte 1, IEEE 1588-2008 §13.3.2.3):
"versionPTP ... shall be set to 2." It distinguishes PTPv2 from the incompatible PTPv1 wire format. Because byte 1's high nibble is reserved-0 in 1588-2008, byte 1 reads 0x02 for a conformant PTPv2 message.`,
    },
    {
      name: 'messageLength',
      label: 'Message length',
      bits: 16,
      decode: (v) => `${v} bytes (34-byte header + ${v - 34} bytes body)`,
      note: 'Total PTP message length in octets, from the start of this header. Bounds the PDU.',
      desc: 'The total number of octets in the PTP message, counting this 34-byte common header plus the message-specific body. The dissector uses it to bound the PDU so lower-layer padding (e.g. Ethernet padding to the 64-byte minimum frame) cannot leak into the body.',
      detail: `MESSAGE LENGTH (16 bits, IEEE 1588-2008 §13.3.2.4): the total length of the PTP message in octets, measured "from the first octet of the header" through the last octet of the message body.

TYPICAL VALUES (header 34 + body):
  Sync / Delay_Req / Follow_Up / Delay_Resp body = 10-octet timestamp+portIdentity area -> 44 (Sync/Delay_Req: 44; Delay_Resp adds requestingPortIdentity -> 54)
  Announce -> 64
These are why a Sync frame, padded out to Ethernet's 64-byte minimum, still reports messageLength = 44: the padding is below PTP and must be trimmed using this field.

ENDIANNESS: 16-bit big-endian (network order).`,
    },
    {
      name: 'domainNumber',
      label: 'Domain number',
      bits: 8,
      decode: (v) => `${v}${v === 0 ? ' (default domain)' : ''}`,
      note: 'Which PTP domain (independent synchronization scope) this message belongs to.',
      desc: 'Identifies the PTP domain: an independent timing scope on the same network. Clocks only synchronize with, and run a Best Master Clock election against, messages in their own domain. The default domain is 0; multiple domains let several unrelated time distributions coexist on one wire.',
      detail: `DOMAIN NUMBER (8 bits, IEEE 1588-2008 §13.3.2.5 / §7.1):
A domain is "a logical grouping of clocks that synchronize to each other ... but are not necessarily synchronized to clocks in another domain." A clock processes only messages whose domainNumber matches its own.

DEFINED RANGES (1588-2008): 0 = default domain; 1-3 = alternate domains; 4-127 = user-defined. (1588-2019 widened the field's interpretation via sdoId.) Profiles like ITU-T G.8275.1 use specific non-zero domains (e.g. 24) so telecom timing does not collide with default-domain equipment.`,
    },
    {
      name: 'reserved1',
      label: 'Reserved',
      bits: 8,
      note: 'Reserved (the minorSdoId field in 1588-2019); 0 in 1588-2008.',
      desc: 'A reserved octet, transmitted as 0 in IEEE 1588-2008. (The 1588-2019 revision reuses this octet as minorSdoId, part of the extended SdoId; for the 2008 standard modelled here it is reserved.)',
      detail: `RESERVED (8 bits, IEEE 1588-2008 §13.3.2.6): reserved; set to 0 by the sender, ignored by the receiver. In IEEE 1588-2019 this byte became minorSdoId, which together with the byte-0 transportSpecific nibble (majorSdoId) forms a 12-bit SdoId used to isolate profiles. Under the 2008 standard it is simply reserved-0.`,
    },
    {
      name: 'flagField',
      label: 'Flags',
      bits: 16,
      type: 'flags',
      // IEEE 1588-2008 Table 20. flagField is two octets; bit assignments per
      // octet below. As a 16-bit big-endian value, octet 0 is the high byte.
      // flagBits is MSB-first: index i tests bit (15 - i).
      //   octet 0: bit0=alternateMaster(0x0100) bit1=twoStep(0x0200)
      //            bit2=unicast(0x0400) bit5=profileSpecific1(0x2000)
      //            bit6=profileSpecific2(0x4000) bit7=security(0x8000)
      //   octet 1: bit0=leap61(0x0001) bit1=leap59(0x0002)
      //            bit2=currentUtcOffsetValid(0x0004) bit3=ptpTimescale(0x0008)
      //            bit4=timeTraceable(0x0010) bit5=frequencyTraceable(0x0020)
      flagBits: [
        'SECURITY',          // idx 0  = bit15 = 0x8000
        'PROFILE_SPECIFIC_2',// idx 1  = bit14 = 0x4000
        'PROFILE_SPECIFIC_1',// idx 2  = bit13 = 0x2000
        '',                  // idx 3  = bit12
        '',                  // idx 4  = bit11
        'UNICAST',           // idx 5  = bit10 = 0x0400
        'TWO_STEP',          // idx 6  = bit9  = 0x0200
        'ALTERNATE_MASTER',  // idx 7  = bit8  = 0x0100
        '',                  // idx 8  = bit7
        '',                  // idx 9  = bit6
        'FREQUENCY_TRACEABLE',// idx 10 = bit5 = 0x0020
        'TIME_TRACEABLE',    // idx 11 = bit4  = 0x0010
        'PTP_TIMESCALE',     // idx 12 = bit3  = 0x0008
        'UTC_OFFSET_VALID',  // idx 13 = bit2  = 0x0004
        'LEAP59',            // idx 14 = bit1  = 0x0002
        'LEAP61',            // idx 15 = bit0  = 0x0001
      ],
      decode: (v) => {
        const set: string[] = [];
        if (v & 0x0200) set.push('twoStep');
        if (v & 0x0400) set.push('unicast');
        if (v & 0x0100) set.push('alternateMaster');
        if (v & 0x8000) set.push('security');
        if (v & 0x2000) set.push('profileSpecific1');
        if (v & 0x4000) set.push('profileSpecific2');
        if (v & 0x0008) set.push('ptpTimescale');
        if (v & 0x0004) set.push('utcOffsetValid');
        if (v & 0x0010) set.push('timeTraceable');
        if (v & 0x0020) set.push('frequencyTraceable');
        if (v & 0x0002) set.push('leap59');
        if (v & 0x0001) set.push('leap61');
        return (set.length ? set.join(', ') : 'none') + ` (0x${(v & 0xffff).toString(16).toUpperCase().padStart(4, '0')})`;
      },
      note: 'twoStep (a Follow_Up carries the precise time), unicast, leap-second and timescale flags.',
      desc: 'A 16-bit field of independent flags (IEEE 1588-2008 Table 20). The most important is twoStepFlag (0x0200): when set, the precise originTimestamp of this event message is delivered separately in a Follow_Up, because the sender could not stamp the time into the message itself before transmitting. Other bits convey unicast mode, leap-second warnings, and whether the timescale is PTP/traceable.',
      detail: `FLAG FIELD (16 bits, two octets, IEEE 1588-2008 Table 20):
OCTET 0 (high byte):
  0x0100 alternateMasterFlag — sent by a clock in PASSIVE/alternate-master state.
  0x0200 twoStepFlag — TWO-STEP clock: the actual transmit timestamp follows in a Follow_Up (Sync) or Pdelay_Resp_Follow_Up. A one-step clock instead writes the timestamp into the event message on the fly and leaves this 0.
  0x0400 unicastFlag — this message was sent unicast (negotiated), not multicast.
  0x2000 PTP profile Specific 1   0x4000 PTP profile Specific 2
  0x8000 securityFlag — the (optional, Annex K) authentication TLV is present.
OCTET 1 (low byte) — only meaningful in Announce / timeProperties:
  0x0001 leap61 — the current UTC day's last minute has 61 s (leap second inserted).
  0x0002 leap59 — the current UTC day's last minute has 59 s (leap second deleted).
  0x0004 currentUtcOffsetValid — the currentUtcOffset (TAI-UTC) is known/valid.
  0x0008 ptpTimescale — the grandmaster's timescale is PTP (TAI) rather than ARB.
  0x0010 timeTraceable — time is traceable to a primary reference (e.g. GPS).
  0x0020 frequencyTraceable — frequency is traceable to a primary reference.

ONE-STEP vs TWO-STEP is the flag a learner meets first: it decides whether you will also see Follow_Up messages on the wire.

LAYOUT: read as a 16-bit big-endian value, octet 0 is the high byte; the flag grid above is MSB-first over that value.`,
    },
    {
      name: 'correctionField',
      label: 'Correction field',
      bits: 64,
      type: 'bytes',
      note: '8 octets: nanoseconds × 2^16 (a fixed-point fractional-ns) accumulated by transparent clocks.',
      desc: 'A signed 64-bit fixed-point correction in nanoseconds, scaled by 2^16 (so the low 16 bits are fractional nanoseconds). Transparent clocks add the time a message spent passing through them (their residence time) into this field, so the slave can subtract switch/bridge delay and recover the true master-to-slave time. Shown as 8 raw octets.',
      detail: `CORRECTION FIELD (64 bits, IEEE 1588-2008 §13.3.2.7): a signed integer of nanoseconds multiplied by 2^16. The high 48 bits are whole nanoseconds; the low 16 bits are fractional nanoseconds (so 1 ns = 0x0000000000010000).

TRANSPARENT CLOCKS: an end-to-end transparent clock (a PTP-aware switch) measures the residence time of an event message — how long it sat in the switch — and ADDS it here. A peer-to-peer transparent clock also folds in the link delay. The slave then subtracts correctionField, cancelling the variable queuing delay that would otherwise wreck sub-microsecond accuracy. For a directly-connected master/slave with no transparent clocks, it is 0.

WIDTH: 64 bits exceeds the engine's exact numeric range (<= 48 bits), so per the Apex contract it is modelled as 'bytes' — 8 octets, big-endian, most-significant first. A typical Sync with no transparent clock shows all-zero.`,
    },
    {
      name: 'reserved2',
      label: 'Reserved',
      bits: 32,
      type: 'hex',
      note: '4 reserved octets, transmitted as 0.',
      desc: 'Four reserved octets (IEEE 1588-2008 §13.3.2.8), transmitted as 0 and ignored on receipt. They sit between the correctionField and the sourcePortIdentity.',
      detail: `RESERVED (32 bits, IEEE 1588-2008 §13.3.2.8): reserved; the sender sets these four octets to 0 and the receiver ignores them. (In IEEE 1588-2019 this area became the messageTypeSpecific field, used by some message types; under the 2008 standard it is reserved-0.)`,
    },
    {
      name: 'sourcePortIdentity',
      label: 'Source port identity',
      bits: 80,
      type: 'bytes',
      note: '10 octets: an 8-octet clockIdentity (often an EUI-64 from the MAC) + a 2-octet portNumber.',
      desc: 'A 10-octet identifier of the PTP port that sent this message: an 8-octet clockIdentity (a globally unique clock id, typically the EUI-64 derived from the device MAC by inserting 0xFFFE) followed by a 2-octet portNumber (1 for the first port). It names the sender uniquely across the whole PTP system. Shown as 10 raw octets.',
      detail: `SOURCE PORT IDENTITY (80 bits, IEEE 1588-2008 §13.3.2.9 / §7.5.2):
PortIdentity ::= { clockIdentity[8], portNumber[2] }.
- clockIdentity (8 octets): a universally unique id for the clock. Commonly the device's EUI-64: take the 48-bit MAC AA:BB:CC:DD:EE:FF and insert 0xFF 0xFE in the middle -> AA BB CC FF FE DD EE FF. The grandmaster's clockIdentity becomes the network's grandmasterIdentity.
- portNumber (2 octets): which port of that clock, numbered from 1. A boundary clock (a switch with several PTP ports) distinguishes its ports here.

USE: the slave keys its master state on the sourcePortIdentity of the Announce/Sync it is locked to; an unexpected identity can signal a grandmaster change. The Delay_Resp echoes the slave's identity in requestingPortIdentity so the right slave consumes the t4 timestamp.

WIDTH: 80 bits > 48, so per the Apex contract it is modelled as 'bytes' (10 octets, big-endian: the 8-octet clockIdentity first, then the 2-octet portNumber).`,
    },
    {
      name: 'sequenceId',
      label: 'Sequence ID',
      bits: 16,
      note: 'Per-message-type counter; pairs a Sync with its Follow_Up, a Delay_Req with its Delay_Resp.',
      desc: 'A 16-bit sequence number assigned by the sender, incrementing per message type (and per destination for unicast). It ties related messages together: a Follow_Up carries the same sequenceId as the Sync it completes, and a Delay_Resp echoes the sequenceId of the Delay_Req it answers.',
      detail: `SEQUENCE ID (16 bits, IEEE 1588-2008 §13.3.2.10): a counter the sender increments for each successive message of a given type to a given destination, wrapping modulo 2^16.

PAIRING: the two-step exchange relies on it — the Follow_Up for Sync #N has sequenceId N, and the Delay_Resp for Delay_Req #M has sequenceId M (plus a matching requestingPortIdentity). This is how a slave matches the precise timestamp in a general message back to the event message it stamped on arrival.

ENDIANNESS: 16-bit big-endian (network order).`,
    },
    {
      name: 'controlField',
      label: 'Control field',
      bits: 8,
      type: 'enum',
      enumMap: CONTROL_FIELD,
      note: 'Legacy v1 field: 0=Sync,1=Delay_Req,2=Follow_Up,3=Delay_Resp,4=Management,5=other. messageType is authoritative.',
      desc: 'An 8-bit field carried over from PTPv1 for backward compatibility (IEEE 1588-2008 Table 23). For the messages that existed in v1 it duplicates the messageType (0=Sync, 1=Delay_Req, 2=Follow_Up, 3=Delay_Resp, 4=Management), and is 5 ("all others") for newer message types. In PTPv2 the messageType field is authoritative; this is informational.',
      detail: `CONTROL FIELD (8 bits, IEEE 1588-2008 §13.3.2.11, Table 23):
  0 Sync   1 Delay_Req   2 Follow_Up   3 Delay_Resp   4 Management   5 All others
It exists only so PTPv1 hardware/parsers see a familiar value; PTPv2 receivers MUST use messageType (byte 0) instead. So a v2 Announce, which has no v1 equivalent, sets controlField = 5 while messageType = 0xB. Deprecated in IEEE 1588-2019.`,
    },
    {
      name: 'logMessageInterval',
      label: 'Log message interval',
      bits: 8,
      decode: (v) => {
        // Signed 8-bit; the message interval is 2^value seconds.
        const s = v > 127 ? v - 256 : v;
        const secs = Math.pow(2, s);
        return `${s} (interval 2^${s} = ${secs >= 1 ? secs + ' s' : '1/' + (1 / secs) + ' s'})`;
      },
      note: 'Signed log2 of the mean interval between these messages in seconds (e.g. 0 = 1 s, -3 = 1/8 s = 125 ms).',
      desc: 'A signed 8-bit value: the base-2 logarithm of the mean interval, in seconds, between successive messages of this type. For Sync, 0 means one per second, -3 means every 1/8 s (125 ms), -4 every 1/16 s. Its meaning depends on the message type, and it is unused (0x7F) for one-shot messages like Delay_Req.',
      detail: `LOG MESSAGE INTERVAL (8 bits, signed, IEEE 1588-2008 §13.3.2.12): the value is log2(interval/1 s), so the interval = 2^value seconds.
  value  0  -> 1 s        value -3 -> 0.125 s (8/s)
  value -4 -> 0.0625 s    value -6 -> ~15.6 ms (64/s, common in telecom profiles)
  value  1 -> 2 s

PER MESSAGE TYPE:
- Sync / Follow_Up: logSyncInterval — the announced Sync rate.
- Announce: logAnnounceInterval (often 1 -> every 2 s).
- Delay_Resp: logMinDelayReqInterval — the minimum spacing the master permits between a slave's Delay_Req messages.
- Delay_Req / signaling / management one-shots: this field is not used and is set to 0x7F (127).

It is the field a profile tunes to trade synchronization tightness against network load.`,
    },
  ],
  // The common header is a fixed 34 bytes (IEEE 1588-2008 §13.3.1).
  headerBytes: (): number => 34,
  // messageLength bounds the whole PTP message (header + body), so trim to it and
  // keep lower-layer padding (e.g. Ethernet's 64-byte minimum) out of the body.
  pduBytes: (h: ParsedHeader): number => h.get('messageLength'),
  // The message body is type-specific (a Sync body is an originTimestamp, an
  // Announce body adds clockQuality, …) and there is no further encapsulated
  // protocol — dissection stops here and the body falls through as node.payload.
  next: (): string | null => null,
};
