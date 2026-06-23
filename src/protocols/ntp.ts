// NTP — Network Time Protocol, version 4. RFC 5905 (NTPv4, June 2010;
// obsoletes RFC 1305/4330). NTP runs over UDP, by convention on port 123, and
// keeps the clocks of internet hosts synchronised to within milliseconds of UTC.
//
// THE 48-BYTE HEADER (RFC 5905 §7.3)
// ----------------------------------
// Every NTP packet (client request, server reply, symmetric, broadcast) shares
// the same fixed 48-byte header, laid out as twelve 32-bit words:
//
//    0                   1                   2                   3
//    0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
//   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//   |LI | VN  |Mode |    Stratum    |     Poll      |   Precision   |
//   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//   |                         Root  Delay                           |
//   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//   |                       Root  Dispersion                        |
//   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//   |                          Reference ID                         |
//   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//   |                     Reference Timestamp (64)                  |
//   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//   |                      Origin Timestamp (64)                    |
//   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//   |                      Receive Timestamp (64)                   |
//   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//   |                      Transmit Timestamp (64)                  |
//   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//
// Optional extension fields and a MAC (key id + message digest) may follow the
// 48-byte header for authenticated NTP (RFC 5905 §7.5) — those are NOT modelled
// here. They are variable length and key-dependent; we transcribe only the
// fixed 48-byte header and let any trailing extension/MAC bytes fall through as
// node.payload. headerBytes is fixed at 48; there is no `next` because NTP is a
// leaf application protocol (its content is timekeeping data, not an inner PDU).
//
// THE FOUR TIMESTAMPS AND HOW NTP COMPUTES OFFSET (RFC 5905 §8)
// ------------------------------------------------------------
// A client/server exchange carries four 64-bit timestamps that let the client
// solve for clock offset and round-trip delay:
//   t1 = Origin    (client's transmit time, echoed back by the server)
//   t2 = Receive   (server's time when the request arrived)
//   t3 = Transmit  (server's time when the reply left)
//   t4 = (client's local time when the reply arrived — not in the packet)
//   offset = ((t2 - t1) + (t3 - t4)) / 2
//   delay  = (t4 - t1) - (t3 - t2)
// In a *client request* the Origin/Receive timestamps are usually zero and only
// the Transmit Timestamp is filled in with the client's send time.
import type { ProtocolSpec } from '../core/types';

// LI — Leap Indicator (RFC 5905 §7.3, "Leap Indicator").
const LI: Record<number, string> = {
  0: 'no warning',
  1: 'last minute has 61 seconds (+leap)',
  2: 'last minute has 59 seconds (-leap)',
  3: 'unsynchronized',
};

// Mode (RFC 5905 §7.3, "Mode").
const MODE: Record<number, string> = {
  0: 'reserved',
  1: 'symmetric active',
  2: 'symmetric passive',
  3: 'client',
  4: 'server',
  5: 'broadcast',
  6: 'NTP control message',
  7: 'reserved (private use)',
};

// An NTP timestamp is "32-bit seconds since 1900-01-01" + "32-bit fraction".
// The NTP epoch (1900) precedes the Unix epoch (1970) by 2,208,988,800 seconds.
// (Timestamps are >48-bit byte fields; the engine surfaces their raw bytes, so
// the seconds/fraction split is explained in each field's detail text rather
// than computed in a decode() — decode only receives the numeric value, which
// is 0 for byte-oriented fields.)

export const ntp: ProtocolSpec = {
  id: 'ntp',
  name: 'NTP',
  layer: 7,
  summary:
    'The Network Time Protocol (v4, RFC 5905) over UDP/123. A fixed 48-byte header carries a stratum, root delay/dispersion, a reference id, and four 64-bit timestamps; from the round-trip the client solves for its clock offset against UTC, usually to within milliseconds.',
  fields: [
    {
      name: 'li',
      label: 'Leap Indicator',
      bits: 2,
      type: 'enum',
      enumMap: LI,
      note: '0 no-warning, 1 +leap, 2 -leap, 3 unsynchronized.',
      desc: 'A 2-bit warning of an impending leap second to be inserted into or deleted from the last minute of the current day. The value 3 means the sender\'s own clock is not synchronized.',
      detail: `LEAP INDICATOR (LI, 2 bits, RFC 5905 §7.3) — the top 2 bits of the first byte:
- 0 = no warning
- 1 = last minute of the day has 61 seconds (a positive leap second will be inserted)
- 2 = last minute of the day has 59 seconds (a negative leap second will be deleted)
- 3 = unknown / clock unsynchronized

A server announces a pending leap second by setting LI for the ~24 hours before it occurs; clients propagate the warning so the whole subnet steps together. LI=3 is how a server says "do not trust my time" — e.g. just after boot, before it has locked to an upstream source.`,
    },
    {
      name: 'vn',
      label: 'Version',
      bits: 3,
      note: '4 for NTPv4.',
      desc: 'The 3-bit NTP version number. 4 is NTPv4 (RFC 5905); 3 was NTPv3 (RFC 1305). The field is 3 bits, so versions 0-7 are representable.',
      detail: `VERSION NUMBER (VN, 3 bits) — bits 5-3 of the first byte.
- 4 = NTPv4 (RFC 5905, current)
- 3 = NTPv3 (RFC 1305)
SNTP (Simple NTP, RFC 4330/5905 §14) uses the identical packet format and the same version number — it is a client/server subset, not a different version on the wire.

BIT LAYOUT of the first byte 0x23 (a typical NTPv4 client request):
0 0 1 0 0 0 1 1
- bits 7-6: 00 = LI (no warning)
- bits 5-3: 100 = VN 4
- bits 2-0: 011 = Mode 3 (client)`,
    },
    {
      name: 'mode',
      label: 'Mode',
      bits: 3,
      type: 'enum',
      enumMap: MODE,
      note: '3 client, 4 server, 5 broadcast.',
      desc: 'A 3-bit field giving the role of this packet in the association: 3 = client (a request), 4 = server (a reply), 5 = broadcast, 1/2 = symmetric peering. It is the low 3 bits of the first byte.',
      detail: `MODE (3 bits) — the low 3 bits of the first byte (RFC 5905 §7.3):
- 0 = reserved
- 1 = symmetric active   } two peers that synchronise each other
- 2 = symmetric passive  }
- 3 = client   — a host asking a server for the time
- 4 = server   — a server answering a client
- 5 = broadcast — a server periodically broadcasting time to a LAN
- 6 = NTP control message (mode 6, the monitoring/management protocol)
- 7 = reserved for private use

REQUEST/REPLY: a client sends Mode 3; the server replies Mode 4, copying the client's Transmit Timestamp into the reply's Origin Timestamp so the client can match request to response and compute round-trip delay.`,
    },
    {
      name: 'stratum',
      label: 'Stratum',
      bits: 8,
      decode: (v) =>
        v === 0 ? '0 (unspecified / kiss-o\'-death)'
        : v === 1 ? '1 (primary reference, e.g. GPS/atomic clock)'
        : v <= 15 ? `${v} (secondary, ${v - 1} hops from a primary)`
        : v === 16 ? '16 (unsynchronized)'
        : `${v} (reserved)`,
      desc: 'Distance, in hops, from a reference clock. 1 = a primary server attached directly to a reference clock (GPS, atomic); 2-15 = secondary servers that many hops away; 0 = unspecified (or a kiss-o\'-death packet); 16 = unsynchronized.',
      detail: `STRATUM (8 bits, RFC 5905 §7.3):
- 0   = unspecified or invalid. In a server reply it signals a "kiss-o'-death" (KoD) packet, where the Reference ID holds a 4-character ASCII kiss code (e.g. "RATE", "DENY").
- 1   = primary server, synchronised to a reference clock (GPS, a cesium/rubidium atomic clock, a radio time signal such as WWVB/DCF77).
- 2-15= secondary server, that many strata below a primary. Each hop adds a stratum.
- 16  = unsynchronized (the server has no usable time source).
- 17-255 = reserved.

A client request commonly carries Stratum 0 because the client has nothing authoritative to advertise yet; the value that matters is in the server's reply.`,
    },
    {
      name: 'poll',
      label: 'Poll',
      bits: 8,
      decode: (v) => {
        const s = v > 127 ? v - 256 : v; // 8-bit signed (two's complement)
        return `${s} (log2 s -> ${2 ** s} s between messages)`;
      },
      note: 'Signed log2 seconds: the max interval between successive messages.',
      desc: 'The maximum interval between successive NTP messages, as a signed power-of-two number of seconds (log2). A poll of 6 means 2^6 = 64 seconds; 10 means ~1024 seconds (~17 min).',
      detail: `POLL (8-bit signed integer, RFC 5905 §7.3): the base-2 logarithm of the polling interval in seconds.
- 6  = 64 s
- 10 = 1024 s (~17 min)
Typical clamps are between 2^4 (16 s) and 2^17 (~36 h). NTP adapts the poll interval dynamically: when a server's time looks stable the client backs off (raises the poll exponent) to reduce traffic; when the offset is jittery it polls more often.

It is a *signed* 8-bit value (two's complement), though in practice it is positive — sub-second polling is unusual for ordinary NTP.`,
    },
    {
      name: 'precision',
      label: 'Precision',
      bits: 8,
      decode: (v) => {
        const s = v > 127 ? v - 256 : v; // 8-bit signed (two's complement)
        return `${s} (log2 s -> ~${(2 ** s).toExponential(2)} s clock resolution)`;
      },
      note: 'Signed log2 seconds: the resolution of the system clock.',
      desc: 'The precision of the sending host\'s system clock, as a signed power-of-two number of seconds (log2). A typical value like -20 means about 2^-20 s ≈ 1 microsecond of resolution; more negative = finer.',
      detail: `PRECISION (8-bit signed integer, RFC 5905 §7.3): the base-2 logarithm of the system clock's resolution in seconds, determined by the host at startup (e.g. by measuring how fast successive clock reads change).
- -6  ≈ 0.0156 s  (a coarse ~64 Hz tick)
- -18 ≈ 3.8 µs
- -20 ≈ 0.95 µs
- -24 ≈ 60 ns
It is stored as a two's-complement signed byte, so e.g. 0xEC = -20. Precision feeds into the dispersion/error budget NTP uses to weight and select time sources.`,
    },
    {
      name: 'rootDelay',
      label: 'Root Delay',
      bits: 32,
      type: 'hex',
      decode: (v) => `${(v / 2 ** 16).toFixed(6)} s (16.16 fixed-point)`,
      note: 'Total round-trip delay to the reference clock; NTP short 16.16 fixed-point.',
      desc: 'The total round-trip delay from this server up to the primary reference clock, in NTP short format — a 32-bit fixed-point number with 16 bits of seconds and 16 bits of fraction. Accumulates across every stratum hop.',
      detail: `ROOT DELAY (32 bits, NTP "short" format, RFC 5905 §6): a signed 16.16 fixed-point number of seconds.
- High 16 bits = whole seconds; low 16 bits = fraction (each unit = 1/65536 s ≈ 15.3 µs).
- 0x00000000 = 0 s; 0x00010000 = 1.0 s; 0x00008000 = 0.5 s.

It is the *total* round-trip delay to the root (the stratum-1 reference), summed over every hop the time has traversed. Together with Root Dispersion it bounds how much the server's time could be in error, which clients use when deciding whether and how far to trust it. A client request usually sends 0.`,
    },
    {
      name: 'rootDispersion',
      label: 'Root Dispersion',
      bits: 32,
      type: 'hex',
      decode: (v) => `${(v / 2 ** 16).toFixed(6)} s (16.16 fixed-point)`,
      note: 'Total dispersion (max error) to the reference clock; NTP short 16.16 fixed-point.',
      desc: 'The total dispersion — the maximum error — accumulated up to the primary reference clock, in NTP short format (16.16 fixed-point seconds). It grows with clock drift between updates and is a key input to NTP\'s source-selection error budget.',
      detail: `ROOT DISPERSION (32 bits, NTP "short" 16.16 fixed-point, RFC 5905 §6): the maximum error of the server's time relative to the root reference clock, in seconds.
- Same encoding as Root Delay: 16 bits seconds + 16 bits fraction (1/65536 s per unit).

Dispersion accumulates from each source's measured jitter and from the drift that builds up between polls (the longer since the last sync, the larger it grows). NTP's intersection/clustering algorithms use root delay + root dispersion + the local offset to compute a "synchronization distance" and reject sources whose error is too large (a falseticker). A client request usually sends 0.`,
    },
    {
      name: 'referenceId',
      label: 'Reference ID',
      bits: 32,
      type: 'hex',
      note: 'Identifies the time source; meaning depends on Stratum.',
      desc: 'A 32-bit code identifying the server\'s upstream time source. Its meaning depends on stratum: at stratum 1 it is a 4-character ASCII source code (e.g. "GPS", "PPS"); above stratum 1 it is the IPv4 address (or a hash) of the upstream server; at stratum 0 it carries a kiss-o\'-death code.',
      detail: `REFERENCE ID (32 bits, RFC 5905 §7.3) — interpretation depends on Stratum:
- Stratum 0: a 4-character ASCII "kiss code" (KoD) such as "DENY", "RATE", "RSTR" telling the client to stop or slow down.
- Stratum 1: a 4-character ASCII identifier of the reference clock, left-justified and zero-padded. Common codes: "GPS\\0" (GPS), "PPS\\0" (pulse-per-second), "DCF\\0" (DCF77), "WWVB", "ATOM" (atomic), "GOES", "ACTS".
- Stratum >= 2: the IPv4 address of the upstream server (NTPv4 over IPv4), or, for IPv6, the low-order 32 bits of an MD5 hash of the source address (RFC 5905 §7.3, to fit a v6 address into 32 bits).

In a client request this field is typically 0. As a 32-bit code its bytes are best read as hex (or ASCII for stratum 0/1).`,
    },
    {
      name: 'referenceTimestamp',
      label: 'Reference Timestamp',
      bits: 64,
      type: 'bytes',
      note: 'When the clock was last set/corrected. NTP 64-bit: 32 s since 1900 + 32 fraction.',
      desc: 'The time at which the server\'s system clock was last set or corrected, as a 64-bit NTP timestamp (32 bits of seconds since 1900-01-01 plus a 32-bit fraction). Lets a client see how stale the server\'s synchronization is.',
      detail: `REFERENCE TIMESTAMP (64 bits, RFC 5905 §6): an NTP timestamp = 32-bit unsigned seconds since the NTP epoch (1900-01-01 00:00:00 UTC) + 32-bit fraction (each unit ≈ 232 ps).

It records when the server last successfully updated its clock from upstream. A long gap between Reference Timestamp and "now" means the server's time has been free-running and its dispersion has grown.

THE NTP EPOCH & ERA: the 32-bit seconds field wraps every 2^32 s ≈ 136 years. Era 0 runs 1900-2036; the rollover on 2036-02-07 is handled by NTP "eras". This field is wider than 48 bits, so Apex reads it as 8 raw bytes (type 'bytes'): first 4 = seconds, last 4 = fraction. In a client request it is usually all zeros.`,
    },
    {
      name: 'originTimestamp',
      label: 'Origin Timestamp',
      bits: 64,
      type: 'bytes',
      note: 'Client\'s send time (t1), echoed by the server. NTP 64-bit timestamp.',
      desc: 'The time the request left the client (t1). The server copies the client\'s Transmit Timestamp into this field on the reply, so the client can match the response and compute round-trip delay. Zero in a fresh client request.',
      detail: `ORIGIN TIMESTAMP (64-bit NTP timestamp, RFC 5905 §8): in the round-trip math this is t1, the client's transmit time.

THE HANDSHAKE TRICK: the client puts its send time in its own *Transmit* Timestamp; the server, when it replies, copies that value verbatim into the reply's *Origin* Timestamp. The client then knows exactly which request the reply answers (a primitive nonce) and has t1 to compute:
  offset = ((t2 - t1) + (t3 - t4)) / 2
  delay  = (t4 - t1) - (t3 - t2)
where t2 = Receive, t3 = Transmit (both from the server), t4 = the client's receive time (measured locally, not carried in the packet).

In an initial client request this field is all zeros (the client has not yet been told an origin).`,
    },
    {
      name: 'receiveTimestamp',
      label: 'Receive Timestamp',
      bits: 64,
      type: 'bytes',
      note: 'Server\'s time when the request arrived (t2). NTP 64-bit timestamp.',
      desc: 'The time the request arrived at the server (t2), filled in by the server on its reply. Combined with Origin (t1) and Transmit (t3) it lets the client subtract out the server\'s internal processing time. Zero in a client request.',
      detail: `RECEIVE TIMESTAMP (64-bit NTP timestamp, RFC 5905 §8): t2 — the server's clock reading at the instant the client's request arrived.

WHY BOTH RECEIVE AND TRANSMIT: the server may sit on the request for some time before answering. Carrying both t2 (arrival) and t3 (departure) lets the client subtract the server's own processing delay (t3 - t2) out of the measured round trip, so the delay estimate reflects only network time:
  delay = (t4 - t1) - (t3 - t2)

A client populates this field only when acting as a server; in a plain client request it is all zeros.`,
    },
    {
      name: 'transmitTimestamp',
      label: 'Transmit Timestamp',
      bits: 64,
      type: 'bytes',
      note: 'Sender\'s time when the packet left (t3 for a server; t1-equivalent for a client). NTP 64-bit timestamp.',
      desc: 'The time the packet left the sender. In a client request it is the only filled-in timestamp: the client\'s send time, which the server will echo back as the reply\'s Origin Timestamp. In a server reply it is t3, the time the reply departed.',
      detail: `TRANSMIT TIMESTAMP (64-bit NTP timestamp, RFC 5905 §8): the sender's clock reading as the packet leaves.

- In a CLIENT REQUEST: this is the one timestamp that is set. The client stamps its send time here; the server copies it into the reply's Origin Timestamp, giving the client both a request/response match and t1 for the offset/delay calculation.
- In a SERVER REPLY: this is t3, the time the reply departed the server.

ENCODING: 64 bits = 32-bit seconds since 1900-01-01 (NTP epoch) + 32-bit fraction. Apex reads it as 8 raw bytes (type 'bytes'): bytes 0-3 = seconds, bytes 4-7 = fraction. Example: seconds 0xE93C7F00 = 3,913,056,000 s after 1900 = 2024-01-01T00:00:00Z.`,
    },
  ],
  // The fixed NTP header is exactly 48 bytes (twelve 32-bit words). Any
  // authentication extension fields / MAC after it fall through as the payload.
  headerBytes: () => 48,
  // NTP is a leaf application protocol: its content is timekeeping data, not an
  // encapsulated inner PDU, so there is no `next`.
};
