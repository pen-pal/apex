// RTP — Real-time Transport Protocol fixed header. RFC 3550 §5.1 (the
// protocol) and RFC 3551 (the A/V profile that fixes the static payload-type
// numbers). RTP rides on UDP (almost always) on a dynamically negotiated,
// usually even, port (the odd port+1 carries RTCP). It carries real-time media
// — audio/video — and supplies the sequencing, timing, and source identity that
// UDP itself lacks.
//
// THE FIXED HEADER (12 bytes, RFC 3550 §5.1), big-endian:
//
//    0                   1                   2                   3
//    0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
//   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//   |V=2|P|X|  CC   |M|     PT      |       sequence number         |
//   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//   |                           timestamp                           |
//   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//   |           synchronization source (SSRC) identifier            |
//   +=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+
//   |            contributing source (CSRC) identifiers             |
//   |                             ....                              |
//   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
//
// WHAT THIS SPEC MODELS, AND WHAT IT DOES NOT
// -------------------------------------------
// We transcribe the 12-byte FIXED header exactly. After it RTP may carry two
// variable parts that we deliberately do NOT model as fixed fields (doing so
// would lie about the wire, since their presence/length depends on header bits):
//   * CSRC list: CC (0-15) 32-bit contributing-source ids, present only when a
//     mixer combined streams. We surface CC, advance headerBytes by CC*4 so the
//     list is consumed and never leaks into the payload, but we do not name each
//     id as a field.
//   * Header extension: present only when X=1 — one extension header (16-bit
//     profile id + 16-bit length-in-32-bit-words + that many words), RFC 3550
//     §5.3.1. We note it but do not parse it; with X=1 those bytes currently fall
//     into the payload. (The most common real case is X=0.)
// Trailing PADDING (when P=1, RFC 3550 §5.1): the last octet of the packet gives
// the padding length including itself. RTP padding is bounded by the UDP Length
// below, not by any RTP length field, so we cannot trim it from the RTP layer
// alone; it is noted on the Padding flag.
//
// The media payload after the header is OPAQUE here — it is codec frames (e.g.
// G.711 µ-law samples, an H.264 NAL unit), not a further dissectable protocol —
// so there is no `next`; dissection stops and the codec bytes are node.payload.
import type { ProtocolSpec } from '../core/types';

// RFC 3551 audio/video profile — static payload types. Ranges 96-127 are
// dynamic (bound to a codec out-of-band via SDP), so they are decoded as such.
const PT: Record<number, string> = {
  0: 'PCMU (G.711 µ-law)',
  3: 'GSM',
  4: 'G723',
  8: 'PCMA (G.711 A-law)',
  9: 'G722',
  10: 'L16 stereo',
  11: 'L16 mono',
  18: 'G729',
  26: 'JPEG video',
  31: 'H261 video',
  33: 'MP2T (MPEG-2 TS)',
  34: 'H263 video',
};

export const rtp: ProtocolSpec = {
  id: 'rtp',
  name: 'RTP',
  layer: 7,
  summary:
    'The Real-time Transport Protocol (RFC 3550): a 12-byte header over UDP that adds the three things media needs and UDP lacks — a sequence number (detect loss/reorder), a timestamp (reconstruct playout timing), and an SSRC (identify the source). The payload is opaque codec data (e.g. G.711 voice).',
  fields: [
    {
      name: 'version',
      label: 'Version',
      bits: 2,
      note: 'Always 2 for RFC 3550 RTP.',
      desc: 'The 2-bit RTP version. The value 2 identifies RFC 3550 RTP; values 0 and 1 were used only by draft/early versions and STUN reuses 0 in the same two bits to disambiguate itself from RTP on a shared port.',
      detail: `VERSION (2 bits, RFC 3550 §5.1): the current and only standard value is 2 (binary 10).

It occupies the top two bits of the first byte. Together with the next two bits (P and X) and the 4-bit CSRC count, the first octet of a typical voice packet is 0x80 (V=2, P=0, X=0, CC=0).

WHY IT MATTERS ON A SHARED PORT: WebRTC multiplexes RTP, RTCP, STUN, DTLS and TURN over one UDP 5-tuple. Demultiplexers use these leading bits to tell them apart — RTP/RTCP start with V=2 (first byte 0x80-0xBF), so a first byte outside that range is not RTP.`,
    },
    {
      name: 'padding',
      label: 'Padding (P)',
      bits: 1,
      type: 'flags',
      flagBits: ['P'],
      note: 'If set, the last octet of the packet says how many trailing padding bytes to ignore.',
      desc: 'The padding bit. When set, the packet ends with one or more padding octets that are NOT part of the media; the very last octet gives the padding length, including itself, so the receiver can strip them.',
      detail: `PADDING (1 bit, RFC 3550 §5.1): "If the padding bit is set, the packet contains one or more additional padding octets at the end which are not part of the payload. The last octet of the padding contains a count of how many padding octets should be ignored, including itself."

WHY PAD: block ciphers that encrypt the payload in fixed-size blocks need the data padded to a block boundary; padding is also used to carry several RTP packets of equal size in one lower-layer unit.

BOUNDING IT HERE: RTP carries no length field of its own — the packet size comes from the UDP Length below. So this dissector cannot trim padding at the RTP layer; with P=1 the padding bytes (including the trailing count) sit at the tail of node.payload. The most common voice case is P=0 (no padding).`,
    },
    {
      name: 'extension',
      label: 'Extension (X)',
      bits: 1,
      type: 'flags',
      flagBits: ['X'],
      note: 'If set, exactly one header extension follows the CSRC list.',
      desc: 'The extension bit. When set, the fixed header (and any CSRC list) is followed by exactly one header-extension block, used to carry profile-specific metadata. When clear (the usual case), the payload begins immediately after the fixed header and CSRC list.',
      detail: `EXTENSION (1 bit, RFC 3550 §5.1 / §5.3.1): "If the extension bit is set, the fixed header MUST be followed by exactly one header extension."

EXTENSION FORMAT (§5.3.1): 16-bit profile-defined identifier, then a 16-bit length giving the number of 32-bit words in the extension (not counting these first four bytes), then that many words.

REAL USE: the one-byte and two-byte header-extension forms of RFC 8285 carry per-packet metadata such as audio level (RFC 6464), absolute send time, and the MID/RID stream identifiers used by WebRTC.

NOT PARSED HERE: this spec models only the fixed header. With X=1 the extension bytes are not split out — they currently fall at the start of node.payload. With X=0 (modelled and common for plain voice) the payload is pure codec data.`,
    },
    {
      name: 'csrcCount',
      label: 'CSRC count (CC)',
      bits: 4,
      decode: (v) => (v === 0 ? '0 (no mixer; SSRC is the sole source)' : `${v} contributing source id(s) follow the header`),
      note: 'Number of 32-bit CSRC ids that follow the fixed header (0 for a normal end-to-end stream).',
      desc: 'The contributing-source count: how many 32-bit CSRC identifiers follow the fixed header. It is non-zero only when an RTP mixer has combined several streams into one; for an ordinary point-to-point flow it is 0.',
      detail: `CSRC COUNT (4 bits, RFC 3550 §5.1): the number (0-15) of CSRC identifiers that follow the 12-byte fixed header, each a 32-bit SSRC of a stream that a MIXER folded into this packet.

EXAMPLE: an audio conference bridge mixing three talkers emits packets with its own SSRC and CC=3, listing the three talkers' SSRCs as CSRCs so receivers know who is in the mix.

HEADER LENGTH: the dissector adds CC*4 bytes to the header length so the CSRC list is consumed and does not leak into the media payload. The individual ids are not surfaced as named fields (their count is variable). For the common CC=0 case the header is exactly 12 bytes.`,
    },
    {
      name: 'marker',
      label: 'Marker (M)',
      bits: 1,
      type: 'flags',
      flagBits: ['M'],
      note: 'Profile-specific significant event — e.g. first packet of a talkspurt (audio) or last packet of a frame (video).',
      desc: 'The marker bit, whose meaning is defined by the RTP profile. For audio it typically marks the first packet of a talkspurt after silence; for video it marks the last packet of a frame so the decoder can render.',
      detail: `MARKER (1 bit, RFC 3550 §5.1): "The interpretation of the marker is defined by a profile. It is intended to allow significant events such as frame boundaries to be marked in the packet stream."

AUDIO (RFC 3551): M=1 on the first packet of a talkspurt that follows a silence period — a hint to the jitter buffer to reset timing. With silence suppression, the sender stops sending during silence, so the timestamp jumps and M flags the resumption.

VIDEO: M=1 on the last packet of an access unit/frame (all packets of one frame share a timestamp), telling the decoder the frame is complete and can be displayed.

BIT POSITION: M is the most-significant bit of the second header octet; the lower 7 bits are the payload type. So that octet is (M<<7)|PT.`,
    },
    {
      name: 'payloadType',
      label: 'Payload type (PT)',
      bits: 7,
      type: 'enum',
      enumMap: PT,
      decode: (v) => (v >= 96 && v <= 127 ? `${v} (dynamic — codec bound out-of-band via SDP)` : (PT[v] ? `${v} (${PT[v]})` : `${v}`)),
      note: 'Identifies the codec/format. 0=PCMU, 8=PCMA, 9=G722 (static); 96-127 are dynamic (mapped by SDP).',
      desc: 'The 7-bit payload type names the media format carried in the payload. Low values are STATIC types fixed by RFC 3551 (0=PCMU/G.711 µ-law, 8=PCMA/G.711 A-law, 9=G722). Values 96-127 are DYNAMIC and bound to a specific codec by out-of-band signalling (SDP).',
      detail: `PAYLOAD TYPE (7 bits, RFC 3550 §5.1; values from RFC 3551 §6):
STATIC AUDIO: 0=PCMU(G.711 µ-law) | 3=GSM | 4=G723 | 8=PCMA(G.711 A-law) | 9=G722 | 18=G729
STATIC VIDEO: 26=JPEG | 31=H261 | 33=MP2T | 34=H263

DYNAMIC RANGE 96-127: most modern codecs (Opus, VP8/VP9, H.264, AV1) have no fixed number. SDP's "a=rtpmap:" line maps a chosen dynamic number to a codec for the session, e.g. "a=rtpmap:111 opus/48000/2".

ONE TYPE PER PACKET: a stream may switch PT mid-call (e.g. comfort-noise), but each packet declares its own format here.

NOTE: PT must not collide with the RTCP packet-type space when RTP and RTCP share a port; this is one reason 72-76 are avoided.`,
    },
    {
      name: 'sequenceNumber',
      label: 'Sequence number',
      bits: 16,
      desc: 'A 16-bit counter that increments by one for each RTP packet sent. The receiver uses it to detect packet loss and to restore the original order of packets that UDP may reorder. Its initial value is random.',
      detail: `SEQUENCE NUMBER (16 bits, RFC 3550 §5.1): "increments by one for each RTP data packet sent, and may be used by the receiver to detect packet loss and to restore packet sequence."

RANDOM START: the initial value is chosen randomly (unpredictable) to make known-plaintext attacks on encrypted media harder; it then increments monotonically and wraps modulo 2^16.

LOSS & REORDER: a gap in sequence numbers signals loss; an out-of-order arrival is reordered by the jitter buffer. RTP does not retransmit — the receiver conceals loss (e.g. interpolation) instead. RTCP reception reports tally these to compute the loss fraction.

INDEPENDENT OF TIMESTAMP: sequence counts PACKETS, timestamp counts MEDIA SAMPLES. They advance at different rates (e.g. a silence gap stops time advancing in samples but the next packet's sequence is still +1).

ENDIANNESS: 16-bit big-endian (network order).`,
    },
    {
      name: 'timestamp',
      label: 'Timestamp',
      bits: 32,
      desc: 'A 32-bit media timestamp giving the sampling instant of the first byte of the payload, measured in clock ticks of a media-specific rate (e.g. 8000 Hz for G.711 voice, 90000 Hz for video). It lets the receiver play media out at the correct pace and compute jitter.',
      detail: `TIMESTAMP (32 bits, RFC 3550 §5.1): "reflects the sampling instant of the first octet in the RTP data packet. The sampling instant MUST be derived from a clock that increments monotonically and linearly in time."

CLOCK RATE: media-dependent, not wall-clock. G.711 voice samples at 8000 Hz, so a packet carrying 20 ms of audio (160 samples) advances the timestamp by 160. Most video uses a 90000 Hz clock.

RANDOM START: like the sequence number, the initial value is random.

NOT A PACKET COUNTER: several packets can share one timestamp (all packets of one video frame), and the timestamp can jump (silence suppression) while the sequence number still increments by one.

PLAYOUT & JITTER: the receiver schedules playout from the timestamp and measures inter-arrival jitter as the variation between RTP-timestamp spacing and arrival spacing. RTCP Sender Reports map this media timestamp to a wall-clock NTP time so audio and video streams (which use different clocks) can be lip-synced.

ENDIANNESS: 32-bit big-endian (network order).`,
    },
    {
      name: 'ssrc',
      label: 'SSRC',
      bits: 32,
      type: 'hex',
      desc: 'The 32-bit synchronization source identifier: a randomly chosen number that uniquely names the source of this stream within an RTP session. All packets from one source carry the same SSRC, tying their sequence numbers and timestamps into one timing space.',
      detail: `SSRC (32 bits, RFC 3550 §5.1): "identifies the synchronization source. This identifier SHOULD be chosen randomly, with the intent that no two synchronization sources within the same RTP session will have the same SSRC identifier."

WHY RANDOM, NOT THE IP: a source is identified by SSRC rather than its network address so that a mixer can relay it, and so identity survives an address change. It is the key that groups a source's sequence numbers and timestamps.

COLLISION HANDLING (§8): if two sources pick the same SSRC, both detect the collision (via RTCP or a packet with an unexpected source) and one picks a new SSRC and signals the change with an RTCP BYE.

CSRC vs SSRC: when a mixer combines streams, its own SSRC labels the mixed stream and the original sources appear as CSRCs (see CSRC count).

ENDIANNESS: 32-bit big-endian, shown here in hex as an opaque identifier.`,
    },
  ],
  // Fixed header is 12 bytes; the CSRC list (CC * 4 bytes) follows it and is part
  // of the header, so consume it too. (A header extension when X=1 is NOT parsed
  // here — see the top-of-file note — so it stays in the payload.)
  headerBytes: (h) => 12 + h.get('csrcCount') * 4,
  // No further dissectable protocol: the payload is opaque codec media.
};
