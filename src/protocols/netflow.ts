// Cisco NetFlow Export Version 5 — the export datagram HEADER (24 bytes).
//
// NetFlow v5 has no IETF RFC; its authoritative reference is Cisco's published
// "NetFlow Export Datagram Format" (Cisco NetFlow Collection Engine User Guide,
// Cisco doc, format.html). The field names, byte offsets and widths below are
// transcribed from that document. NetFlow v5 is exported over UDP, commonly to
// collector ports 2055 or 9996. All fields are BIG-ENDIAN (network byte order),
// like the rest of the IP stack (unlike SMB2, NetFlow is network-ordered).
//
// DATAGRAM SHAPE
// --------------
//   [ 24-byte v5 header ] [ count x 48-byte flow records ]
// The header's `count` field (1..30) says how many fixed 48-byte flow records
// follow. This spec models the 24-byte HEADER as a fixed bit grid. The flow
// records themselves are a repeated 48-byte structure, not a single fixed header
// for ONE child protocol, so they cannot be honestly expressed as this spec's
// Field[]; they fall through as node.payload and next() returns null. The record
// layout (per the same Cisco doc) is documented at the bottom of this file so the
// teaching is complete.
//
// WHY next() IS null
// ------------------
// The payload is `count` flow records — application data describing OTHER flows,
// not an encapsulated lower protocol to dissect. There is no single child
// ProtocolSpec to dispatch to (a record is not a protocol header), so dissection
// stops at the header and the records remain in node.payload.
import type { ProtocolSpec, ParsedHeader } from '../core/types';

export const netflow: ProtocolSpec = {
  id: 'netflow',
  name: 'NetFlow v5',
  layer: 7,
  summary:
    'The 24-byte Cisco NetFlow Export v5 header that fronts a flow-export datagram over UDP (commonly port 2055/9996): a version (=5), a count of how many 48-byte flow records follow, the device uptime and a UNIX timestamp pair, a flow sequence counter, the engine type/id, and a packed sampling-mode+interval. The records themselves are the payload.',
  fields: [
    {
      name: 'version',
      label: 'Version',
      bits: 16,
      decode: (v) => (v === 5 ? '5 (NetFlow v5)' : String(v)),
      note: 'Always 5 for this format. Wire bytes 0x00 0x05.',
      desc: 'The NetFlow export format version number. For this datagram it is always 5. A collector reads these first two bytes to decide which parser to use — v1, v5, v7, v9 (template-based) and IPFIX all begin with a 16-bit version.',
      detail: `VERSION (2 bytes, offset 0, big-endian): identifies the export format. 5 selects the classic fixed NetFlow v5 layout this spec models (24-byte header + 48-byte records).

WHY IT MATTERS: NetFlow v5 is a FIXED format — every field is at a known offset, so the collector needs no template. Later v9 (Cisco) and IPFIX (RFC 7011) are TEMPLATE-based: the exporter first sends a template describing the record fields, then data records that match it. The version field is how a multi-version collector dispatches between these very different parsing strategies. v5 remains common because it is simple and self-describing.`,
    },
    {
      name: 'count',
      label: 'Count',
      bits: 16,
      decode: (v) => `${v} flow record${v === 1 ? '' : 's'} follow (${v} x 48 = ${v * 48} bytes)`,
      note: 'Number of 48-byte flow records that follow (1..30).',
      desc: 'The number of flow records in this datagram. Each record is a fixed 48 bytes, so the total datagram size is 24 + count x 48 bytes. A v5 datagram carries between 1 and 30 records (30 records x 48 = 1440 bytes + 24 header = 1464, kept under a typical 1500-byte MTU to avoid IP fragmentation).',
      detail: `COUNT (2 bytes, offset 2, big-endian): how many 48-byte flow records follow this header. Range 1..30 for v5.

THE 30-RECORD CAP: 24 + (30 x 48) = 1464 bytes, which fits inside a 1500-byte Ethernet MTU with room for the IP+UDP headers — so a full v5 datagram does not fragment. An exporter flushes a partial datagram (fewer than 30 records) when its flow cache ages out entries or a timer fires, so smaller counts are common.

USING IT: a collector loops "count" times reading 48 bytes each from the payload. If the UDP payload length disagrees with 24 + count x 48, the datagram is malformed (often truncation) and is usually dropped.`,
    },
    {
      name: 'sysUptime',
      label: 'System uptime',
      bits: 32,
      decode: (v) => `${v} ms (~${(v / 1000).toFixed(3)} s since boot)`,
      note: 'Milliseconds since the exporting device booted.',
      desc: 'The current time, in milliseconds, since the exporting device (router/switch) booted. It is the time base for the per-flow First/Last timestamps inside each record, which are themselves expressed as device-uptime milliseconds.',
      detail: `SYSUPTIME (4 bytes, offset 4, big-endian): the device's uptime clock in milliseconds at the moment this datagram was created.

THE TIME-BASE TRICK: each flow record stores First and Last as sysUptime-relative milliseconds (uptime at flow start / last packet). To get a real wall-clock time for a flow you combine THREE header fields: take (unix_secs, unix_nsecs) as the absolute time corresponding to THIS header's sysUptime, then offset by (record.First - header.sysUptime). This lets the device avoid putting a full absolute timestamp on every record.

WRAP: a 32-bit millisecond counter wraps after ~49.7 days of uptime; collectors must tolerate the rollover.`,
    },
    {
      name: 'unixSecs',
      label: 'UNIX seconds',
      bits: 32,
      decode: (v) => `${v} (${new Date(v * 1000).toISOString()})`,
      note: 'Seconds since the UNIX epoch (1970-01-01 UTC) at export time.',
      desc: 'The whole-seconds part of the current wall-clock time at the exporter, counted since 0000 UTC on 1 January 1970 (the UNIX epoch). Paired with unix_nsecs it anchors the device-uptime timestamps to absolute time.',
      detail: `UNIX_SECS (4 bytes, offset 8, big-endian): seconds since the UNIX epoch (1970-01-01T00:00:00Z) at the instant the header was built.

PAIRED WITH SYSUPTIME: this is the absolute time that corresponds to the header's sysUptime value. A collector uses the pair (unix_secs/unix_nsecs, sysUptime) as the reference point to convert each record's uptime-relative First/Last into UTC.

YEAR 2038: as a signed 32-bit seconds count this overflows in January 2038; v5 being a legacy format, treat the value as unsigned (good past 2106) when decoding old captures.`,
    },
    {
      name: 'unixNsecs',
      label: 'UNIX nanoseconds',
      bits: 32,
      decode: (v) => `${v} ns (+${(v / 1e6).toFixed(3)} ms)`,
      note: 'Residual nanoseconds (the sub-second part of the export time).',
      desc: 'The residual nanoseconds — the sub-second fraction of the current time at the exporter, to be added to unix_secs. Together they give a nanosecond-resolution absolute timestamp for the datagram.',
      detail: `UNIX_NSECS (4 bytes, offset 12, big-endian): the nanoseconds-since-the-last-whole-second component of the export time. Valid range is 0..999,999,999.

RESOLUTION vs ACCURACY: the field offers nanosecond resolution, but the device clock's real accuracy is far coarser; the value mainly disambiguates ordering and refines the conversion of uptime-relative record timestamps to UTC.`,
    },
    {
      name: 'flowSequence',
      label: 'Flow sequence',
      bits: 32,
      note: 'Running counter of total flows exported by this device.',
      desc: 'A running counter of the total number of flow records the device has exported so far (it equals the previous datagram\'s flow_sequence plus that datagram\'s count). A collector watches this for gaps to detect lost export datagrams.',
      detail: `FLOW_SEQUENCE (4 bytes, offset 16, big-endian): cumulative count of flows exported by this engine. Each datagram's value = previous datagram's flow_sequence + previous datagram's count.

DETECTING LOSS: NetFlow rides UDP, which can drop datagrams silently. The collector checks that this datagram's flow_sequence equals (last seen flow_sequence + last seen count); any jump means export datagrams — and the flow data in them — were lost in transit. This is the only loss signal v5 provides, so monitoring it is essential for accurate accounting.

PER-ENGINE: the counter is per (engine_type, engine_id); a device with multiple flow engines maintains independent sequences.`,
    },
    {
      name: 'engineType',
      label: 'Engine type',
      bits: 8,
      note: 'Type of flow-switching engine that produced these flows.',
      desc: 'An identifier for the type of flow-switching engine that generated the records — i.e. which switching path on the device produced the flow cache (for example route-processor vs line-card based switching).',
      detail: `ENGINE_TYPE (1 byte, offset 20): identifies the kind of flow-switching engine (the part of the device that builds the flow cache). On classic Cisco platforms values distinguish, e.g., RP (route processor) from VIP/line-card switching engines.

WHY IT IS EXPORTED: a single chassis can have several flow engines; tagging each datagram with (engine_type, engine_id) lets the collector attribute flows to the correct source and keep per-engine flow_sequence counters straight.`,
    },
    {
      name: 'engineId',
      label: 'Engine ID',
      bits: 8,
      note: 'Slot/id of the specific flow-switching engine.',
      desc: 'The slot number (or configured id) of the specific flow-switching engine within the device that produced these flows. Combined with engine_type it uniquely identifies the source engine on a multi-engine chassis.',
      detail: `ENGINE_ID (1 byte, offset 21): the slot number / identifier of the particular flow-switching engine that exported this datagram.

PAIRING: (engine_type, engine_id) together uniquely name the source engine. The flow_sequence counter is maintained per engine, so a collector keys its loss-detection state on this pair — otherwise interleaved datagrams from two engines on one device would look like sequence gaps.`,
    },
    {
      name: 'samplingInterval',
      label: 'Sampling mode + interval',
      bits: 16,
      type: 'hex',
      decode: (v) => {
        const mode = (v >> 14) & 0x3; // top 2 bits
        const interval = v & 0x3fff; // low 14 bits
        const modeName = mode === 0 ? 'no sampling' : mode === 1 ? 'deterministic (1 in N)' : mode === 2 ? 'random (1 in N)' : 'reserved';
        return interval
          ? `mode ${mode} (${modeName}), 1 in ${interval}`
          : `mode ${mode} (${modeName}), interval 0`;
      },
      note: 'Top 2 bits = sampling mode, low 14 bits = the 1-in-N interval.',
      desc: 'A packed 16-bit field: the top 2 bits hold the sampling MODE and the low 14 bits hold the sampling INTERVAL N. If the device samples 1 packet in N, the byte and packet counts in each record must be multiplied by N to estimate the true totals — so a collector cannot scale flows correctly without this field.',
      detail: `SAMPLING_INTERVAL (2 bytes, offset 22, big-endian) — a PACKED field:
- Bits 15..14 (top 2 bits): SAMPLING MODE.
    0 = no sampling (every packet counted)
    1 = deterministic / packet-interval sampling (every Nth packet)
    2 = random 1-in-N sampling
    3 = reserved
- Bits 13..0 (low 14 bits): the sampling INTERVAL N (max 16383).

WHY IT IS CRITICAL: with 1-in-N sampling the device only sees a fraction of traffic, so each record's dPkts and dOctets are scaled-down. To recover an estimate of true volume the collector multiplies the counts by N. Ignoring this field silently under-reports traffic by a factor of N — which is why the doc stresses you "cannot calculate the amount of bytes or packets in a flow without it."

SUB-FIELD ORDER: this is a single big-endian 16-bit value; the mode occupies the two most-significant bits. Modeled as one field (type hex) with the decode() splitting mode/interval, because the 2/14 split is not byte-aligned.`,
    },
  ],
  // The v5 header is a fixed 24 bytes (its field widths sum to 24 x 8 = 192 bits).
  headerBytes: (): number => 24,
  // The payload is `count` repeated 48-byte flow records (application data about
  // OTHER flows), not a single encapsulated child protocol, so dissection stops
  // here and the records remain in node.payload.
  //
  // FLOW RECORD LAYOUT (48 bytes each, Cisco NetFlow v5 format, for reference):
  //   0  srcaddr   (4)  source IP            24 First    (4) flow start (sysUptime ms)
  //   4  dstaddr   (4)  destination IP       28 Last     (4) flow end   (sysUptime ms)
  //   8  nexthop   (4)  next-hop router IP   32 srcport  (2) TCP/UDP source port
  //  12  input     (2)  input ifIndex        34 dstport  (2) TCP/UDP dest port
  //  14  output    (2)  output ifIndex       36 pad1     (1) unused
  //  16  dPkts     (4)  packets in flow      37 tcp_flags(1) cumulative OR of TCP flags
  //  20  dOctets   (4)  L3 bytes in flow     38 prot     (1) IP protocol (6=TCP,17=UDP)
  //                                          39 tos      (1) IP type of service
  //                                          40 src_as   (2) source AS number
  //                                          42 dst_as   (2) destination AS number
  //                                          44 src_mask (1) source prefix mask bits
  //                                          45 dst_mask (1) destination prefix mask bits
  //                                          46 pad2     (2) unused
  next: (_h: ParsedHeader): string | null => null,
};
