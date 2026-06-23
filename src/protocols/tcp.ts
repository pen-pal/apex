// TCP segment header. RFC 9293 (obsoletes RFC 793).
// The behaviour view (state machine) and conversation view (handshake) are
// declared here as DATA and consumed by the corresponding view components.
import type { ProtocolSpec, BuildCtx, StateMachine, ConversationSpec } from '../core/types';
import { inetChecksum } from '../core/checksum';

const APP_PORTS: Record<number, string> = {
  21: 'ftp', 22: 'ssh', 23: 'telnet', 25: 'smtp', 43: 'whois', 49: 'tacacs', 53: 'dns', 80: 'http',
  88: 'kerberos', 102: 'tpkt', 110: 'pop3', 111: 'sunrpc', 139: 'smb1', 143: 'imap', 179: 'bgp', 389: 'ldap',
  443: 'tls', 445: 'smb2', 502: 'modbus', 554: 'rtsp', 646: 'ldp', 1080: 'socks', 1883: 'mqtt', 3260: 'iscsi', 3306: 'mysql', 3389: 'rdp',
  3868: 'diameter', 5060: 'sip', 5222: 'xmpp', 5432: 'postgres', 5672: 'amqp', 5900: 'rfb', 6379: 'redis', 6667: 'irc', 20000: 'dnp3', 27017: 'mongodb',
};

export const tcpStateMachine: StateMachine = {
  initial: 'CLOSED',
  states: ['CLOSED', 'LISTEN', 'SYN_SENT', 'SYN_RECEIVED', 'ESTABLISHED', 'FIN_WAIT_1', 'FIN_WAIT_2', 'CLOSING', 'CLOSE_WAIT', 'LAST_ACK', 'TIME_WAIT'],
  transitions: {
    CLOSED: { 'passive-open': 'LISTEN', 'send-SYN': 'SYN_SENT' },
    LISTEN: { 'recv-SYN': 'SYN_RECEIVED', 'close': 'CLOSED' },
    SYN_SENT: { 'recv-SYN+ACK': 'ESTABLISHED', 'recv-SYN': 'SYN_RECEIVED', 'close': 'CLOSED' },
    SYN_RECEIVED: { 'recv-ACK': 'ESTABLISHED', 'close': 'FIN_WAIT_1' },
    ESTABLISHED: { 'close': 'FIN_WAIT_1', 'recv-FIN': 'CLOSE_WAIT' },
    FIN_WAIT_1: { 'recv-ACK': 'FIN_WAIT_2', 'recv-FIN': 'CLOSING' },
    FIN_WAIT_2: { 'recv-FIN': 'TIME_WAIT' },
    CLOSING: { 'recv-ACK': 'TIME_WAIT' },
    CLOSE_WAIT: { 'close': 'LAST_ACK' },
    LAST_ACK: { 'recv-ACK': 'CLOSED' },
    TIME_WAIT: { 'timeout': 'CLOSED' },
  },
};

// The full connection lifecycle as DATA: three-way open, data transfer, four-way
// close. seq/ack numbers are derived live from the real payload length by the
// view (advance tells it how each segment consumes sequence space).
export const tcpHandshake: ConversationSpec = {
  participants: ['client', 'server'],
  steps: [
    { from: 'client', label: 'SYN', flags: 'SYN (0x02)', advance: 'syn', clientState: 'SYN_SENT', serverState: 'LISTEN',
      note: 'Client opens the connection with a random ISN. SYN consumes one sequence number; no data and no ACK yet.' },
    { from: 'server', label: 'SYN, ACK', flags: 'SYN, ACK (0x12)', advance: 'syn', clientState: 'SYN_SENT', serverState: 'SYN_RECEIVED',
      note: 'Server acknowledges the client SYN (ack = client ISN + 1) and sends its own random ISN.' },
    { from: 'client', label: 'ACK', flags: 'ACK (0x10)', advance: 'none', clientState: 'ESTABLISHED', serverState: 'ESTABLISHED',
      note: 'Client acknowledges the server SYN. The three-way handshake is complete — both sides are ESTABLISHED.' },
    { from: 'client', label: 'PSH, ACK', flags: 'PSH, ACK (0x18)', advance: 'data', clientState: 'ESTABLISHED', serverState: 'ESTABLISHED',
      note: 'The application data is sent. PSH tells the receiver to deliver it to the app promptly rather than buffering.' },
    { from: 'server', label: 'ACK', flags: 'ACK (0x10)', advance: 'none', clientState: 'ESTABLISHED', serverState: 'ESTABLISHED',
      note: 'Server acknowledges the bytes received. The cumulative ack = next byte it expects.' },
    { from: 'client', label: 'FIN, ACK', flags: 'FIN, ACK (0x11)', advance: 'fin', clientState: 'FIN_WAIT_1', serverState: 'ESTABLISHED',
      note: 'Client begins the active close. FIN consumes one sequence number; it can still receive data.' },
    { from: 'server', label: 'ACK', flags: 'ACK (0x10)', advance: 'none', clientState: 'FIN_WAIT_2', serverState: 'CLOSE_WAIT',
      note: 'Server acknowledges the FIN. It enters CLOSE_WAIT until its own application closes.' },
    { from: 'server', label: 'FIN, ACK', flags: 'FIN, ACK (0x11)', advance: 'fin', clientState: 'FIN_WAIT_2', serverState: 'LAST_ACK',
      note: 'The server application closes; the server sends its own FIN and moves to LAST_ACK.' },
    { from: 'client', label: 'ACK', flags: 'ACK (0x10)', advance: 'none', clientState: 'TIME_WAIT', serverState: 'CLOSED',
      note: 'Client acknowledges the server FIN and waits 2×MSL in TIME_WAIT so stray packets cannot bleed into a new connection.' },
  ],
};

export const tcp: ProtocolSpec = {
  id: 'tcp',
  name: 'TCP',
  layer: 4,
  summary: 'The transport-layer segment: ports, sequence/ack numbers, flags, flow control. Reliable, ordered delivery.',
  fields: [
    {
      name: 'srcPort',
      label: 'Source port',
      bits: 16,
      desc: 'A 16-bit number identifying the sending application. Clients typically use ephemeral ports assigned by the OS for outbound connections.',
      detail: `THE 4-TUPLE: (SrcIP, SrcPort, DstIP, DstPort) uniquely identifies a TCP connection.

RANGES (RFC 6335):
- System (0-1023): Well-known. Binding usually requires elevated privileges. 80=HTTP, 443=HTTPS, 22=SSH
- User (1024-49151): Registered. 3306=MySQL, 5432=PostgreSQL, 6379=Redis
- Dynamic/ephemeral (49152-65535): The range IANA suggests for OS-assigned outbound ports

ACTUAL EPHEMERAL RANGES VARY BY OS:
- Linux default: 32768-60999 (configurable via /proc/sys/net/ipv4/ip_local_port_range)
- Windows / macOS: roughly the IANA 49152-65535 range

PORT EXHAUSTION: If a host opens many connections to the same destination 4-tuple and ephemeral ports linger in TIME_WAIT (~2*MSL), new connections can fail with "Address already in use".

SO_REUSEADDR: lets a new socket bind a port that has connections lingering in TIME_WAIT. SO_REUSEPORT (Linux 3.9+): multiple sockets bind the same port and the kernel load-balances incoming connections across them (used by nginx workers).`,
    },
    {
      name: 'dstPort',
      label: 'Destination port',
      bits: 16,
      decode: (v) => (APP_PORTS[v] ? `${v} (${APP_PORTS[v].toUpperCase()})` : String(v)),
      desc: 'Identifies the receiving application. The OS uses it (with the rest of the 4-tuple) to look up which socket should receive the data.',
      detail: `SOCKET LOOKUP (most specific match wins):
1. Exact 4-tuple match -> an established connection
2. Listening socket on the dst port (wildcard remote) -> a new connection
3. No match -> the host typically replies with RST

WELL-KNOWN PORTS:
20/21=FTP | 22=SSH | 23=Telnet (cleartext, avoid) | 25=SMTP
53=DNS (UDP+TCP) | 67/68=DHCP | 80=HTTP | 443=HTTPS
110=POP3 | 143=IMAP | 993=IMAPS | 3306=MySQL
3389=RDP | 5432=PostgreSQL | 6379=Redis | 8080=HTTP-alt

PORT 0: reserved; not used for listening. A connect to port 0 generally fails.

WILDCARD BIND: binding to 0.0.0.0:80 accepts connections arriving on any local interface.`,
    },
    {
      name: 'seq',
      label: 'Sequence number',
      bits: 32,
      note: "Byte offset of this segment's first data byte in the stream.",
      desc: 'The byte-level position of this segment’s first data byte in the stream — a byte counter, not a packet counter. It is what lets the receiver reassemble data in order.',
      detail: `FUNDAMENTAL: TCP is a byte stream. Seq identifies the position of the first payload byte. If a segment carries 100 bytes at seq=1001, the next segment starts at seq=1101.

ISN (Initial Sequence Number): chosen unpredictably for security. RFC 6528 specifies generating it from a hash of the 4-tuple plus a secret (Linux historically used MD5/SHA-1 over those inputs), so off-path attackers cannot guess it.

SYN CONSUMES ONE SEQUENCE NUMBER: with ISN=N, the SYN occupies seq=N and the first data byte is seq=N+1. (FIN likewise consumes one.)

WRAPAROUND: the 32-bit space is ~4.3 GB. On a fast link this can wrap quickly (e.g. ~3.4 s at 10 Gbps), so old and new segments could collide. PAWS (RFC 7323, formerly RFC 1323) uses the TCP timestamp option to disambiguate.

SACK (Selective ACK, RFC 2018): without it, the cumulative ACK can only confirm one contiguous run. With SACK the receiver can say "I have 1000-1999 AND 2100-2999," so the sender retransmits only the 2000-2099 hole.

OUT-OF-ORDER: if seq=2000 arrives before seq=1000, the receiver buffers it and sends a duplicate ACK still asking for 1000. Three duplicate ACKs trigger fast retransmit.`,
    },
    {
      name: 'ack',
      label: 'Acknowledgment number',
      bits: 32,
      note: 'Next sequence number the sender expects to receive.',
      desc: 'The next byte the sender expects from the other side. Valid only when the ACK flag is set; it means "I have received all bytes up to ack-1."',
      detail: `CUMULATIVE: ACK=5001 means "I have everything through byte 5000," implicitly acknowledging all earlier bytes. (SACK blocks, carried as options, add selective info on top of this.)

HANDSHAKE:
- SYN:      seq=ISN_C, ack field unused (ACK flag not set)
- SYN-ACK:  seq=ISN_S, ack=ISN_C+1
- ACK:      seq=ISN_C+1, ack=ISN_S+1

DUPLICATE ACKS (fast-retransmit signal):
1st/2nd dup: receiver got out-of-order data, still missing the hole
3rd dup:     sender retransmits the missing segment without waiting for the RTO timer

DELAYED ACKS: a receiver may wait briefly (commonly up to ~200 ms, and at most every second full-sized segment) before ACKing, cutting ACK traffic. Combined with Nagle this can add latency; TCP_QUICKACK can suppress it.

PIGGYBACKING: the ACK rides along in data segments going the other way; a pure ACK segment is sent only when there is no return data.

ROBUST TO ACK LOSS: a lost ACK is covered by the next cumulative ACK or by the sender's retransmission timeout, so the stream still makes progress.`,
    },
    {
      name: 'dataOffset',
      label: 'Data offset',
      bits: 4,
      decode: (v) => `header is ${v * 4} bytes`,
      desc: 'The TCP header length measured in 32-bit words. The minimum value 5 means a 20-byte header (no options); the maximum 15 means a 60-byte header.',
      detail: `DATA OFFSET (4 bits): valid range 5-15.
- 5 = 20 bytes: no options, the most common case
- 6 = 24 bytes: e.g. one 4-byte MSS option (plus padding)
- 15 = 60 bytes: the maximum, which caps how many option bytes a segment can carry

It is the field that tells the receiver where the (variable-length) options end and the application payload begins; without it the boundary would be ambiguous. The value is in 32-bit words, so the header is always a multiple of 4 bytes (options are padded to that boundary).`,
    },
    {
      name: 'reserved',
      label: 'Reserved',
      bits: 4,
      note: 'Reserved bits (modern TCP also places the NS flag here).',
      desc: 'Four bits reserved for future use; they must be sent as zero. The low bit of this nibble historically held the experimental NS (ECN-nonce) flag.',
      detail: `These bits sit between the 4-bit Data Offset and the 8 control flags and are reserved for future use — senders set them to 0 and receivers ignore them.

NS (Nonce Sum): the lowest of these reserved bits was assigned to the experimental ECN-nonce flag by RFC 3540. That mechanism saw essentially no deployment and RFC 8311 reclassified RFC 3540 as historic, so this bit is once again simply reserved. (This is why the model's 8 control flags begin at CWR rather than NS.)`,
    },
    {
      name: 'flags',
      label: 'Flags',
      bits: 8,
      type: 'flags',
      flagBits: ['CWR', 'ECE', 'URG', 'ACK', 'PSH', 'RST', 'SYN', 'FIN'],
      desc: 'Eight control bits that drive connection setup, teardown, and signalling — SYN, ACK, FIN, RST, PSH, URG, plus the ECN flags CWR and ECE.',
      detail: `FLAG BITS (MSB to LSB in this byte):
CWR (0x80): Congestion Window Reduced — the sender has reduced its window in response to an ECE
ECE (0x40): ECN-Echo — echoes that congestion was signalled (RFC 3168)
URG (0x20): Urgent pointer is valid — effectively deprecated (RFC 6093)
ACK (0x10): Acknowledgment field is valid — set on every segment after the initial SYN
PSH (0x08): Push — deliver buffered data to the application promptly rather than waiting for more
RST (0x04): Reset — abort the connection immediately
SYN (0x02): Synchronize — open a connection and synchronize sequence numbers; consumes one seq number
FIN (0x01): Finish — sender has no more data; consumes one seq number

COMMON COMBINATIONS:
0x02=SYN | 0x12=SYN+ACK | 0x10=ACK | 0x18=PSH+ACK
0x11=FIN+ACK | 0x14=RST+ACK | 0x04=RST

Note: the single bit just above CWR — the low bit of the preceding 4-bit Reserved nibble — once carried the experimental NS (ECN-nonce) flag (RFC 3540, now historic per RFC 8311), so older diagrams sometimes show a 9th flag bit.`,
    },
    {
      name: 'window',
      label: 'Window size',
      bits: 16,
      note: 'Bytes the sender can receive before it needs an ack -- flow control.',
      desc: 'How many more bytes (beyond the acknowledged byte) this sender is currently willing to accept. It is the core of TCP flow control, keeping a fast sender from overwhelming a slow receiver.',
      detail: `MEANING: the advertised window roughly equals receive-buffer space still free = BufferSize - (bytes received but not yet read by the app).

ZERO WINDOW: when the buffer is full the receiver advertises 0 and the sender stops. When the app drains data the receiver sends a window update. If that update is lost, the sender periodically sends Zero-Window Probes (small segments) to elicit a fresh ACK carrying the current window.

WINDOW SCALING (RFC 7323): a raw 16-bit window maxes out at 65535 bytes — far too small for high bandwidth-delay-product paths (e.g. ~12.5 MB is needed at 1 Gbps with 100 ms RTT). A scale factor (shift count 0-14) negotiated once in the SYN multiplies this field, extending the effective window up to ~1 GB. The scale is fixed at handshake time; it is not carried in every segment.

SILLY WINDOW SYNDROME: repeatedly advertising tiny windows leads to tiny segments and ruinous header overhead. Clark's fix on the receiver (don't advertise an opening until it is at least one MSS or half the buffer) and Nagle's algorithm on the sender avoid it.

EFFECTIVE SEND WINDOW: min(receiver's advertised window, sender's congestion window). Even a generous advertised window won't make the sender exceed cwnd.`,
    },
    {
      name: 'checksum',
      label: 'Checksum',
      bits: 16,
      type: 'hex',
      note: 'Covers a pseudo-header (incl. the IPs), the TCP header, and the data.',
      desc: 'A 16-bit error check covering a pseudo-header (src/dst IP, protocol, TCP length), the TCP header, and the payload. Including the IPs binds the segment to its endpoints.',
      detail: `PSEUDO-HEADER (12 bytes, included only in the calculation, never transmitted):
- Source IP (4B) | Destination IP (4B) | Zero (1B) | Protocol = 6 (1B) | TCP length (2B)

WHY IT MATTERS: folding the IP addresses and protocol into the checksum binds the segment to its endpoints, so a misdelivered packet (routing or NAT bug) fails verification at the receiver.

ALGORITHM: the standard Internet checksum (RFC 1071) — the same one's-complement sum used by IPv4 — but over a larger scope (pseudo-header + TCP header + payload). The data is conceptually padded with a zero byte to an even length for the sum.

WHY TCP HAS ITS OWN CHECK (the link CRC isn't enough):
1. The Ethernet FCS protects only one hop and is recomputed at each one; TCP's check is end-to-end.
2. The NIC strips the FCS before the OS sees the frame.
3. The pseudo-header catches misdelivery, which a link CRC cannot.
4. Some link layers carry no CRC.
5. It can catch corruption introduced inside the host's network stack.

RELATED: the UDP checksum is optional in IPv4 (a transmitted 0 means "not computed") but mandatory in IPv6, which has no network-layer header checksum.

OFFLOADING: modern NICs compute/verify this in hardware (essential at 10 Gbps+); on Linux, ethtool -k <iface> shows tx/rx-checksumming. Captures taken before offload runs can show "incorrect" checksums that are actually fine on the wire.`,
    },
    {
      name: 'urgentPointer',
      label: 'Urgent pointer',
      bits: 16,
      note: 'Offset of urgent data when the URG flag is set.',
      desc: 'When the URG flag is set, this points to the end of the urgent data so the receiver can process it out of band. It is effectively deprecated.',
      detail: `INTENDED USE: mark a region of the stream as urgent so the application is notified ahead of normal in-order delivery — e.g. a Telnet interrupt. When URG is set, this field gives the offset (from the segment's sequence number) to the urgent data; RFC 1122 vs the original RFC 793 disagreed on whether it points at the last urgent byte or one past it.

REALITY (RFC 6093 documents the mess):
- Implementations historically disagreed on the pointer's exact semantics and on whether urgent data is delivered inline or via a separate out-of-band read (e.g. the socket MSG_OOB flag / SIGURG).
- Because of these differences RFC 6093 advises new applications NOT to use the urgent mechanism, and middleboxes often clear URG anyway.

WHERE IT STILL APPEARS: some SSH implementations have used urgent data for interactive signalling, but this is niche.

MODERN ALTERNATIVES: application- or transport-level signalling such as HTTP/2 RST_STREAM, WebSocket control frames, and TLS alerts replace the original out-of-band intent.`,
    },
  ],
  headerBytes: (h) => h.get('dataOffset') * 4,
  next: (h) => APP_PORTS[h.get('dstPort')] ?? null,
  states: tcpStateMachine,
  conversation: tcpHandshake,
  encode: ({ payload, conn }: BuildCtx) => {
    const hdr = [
      (conn.srcPort >> 8) & 255, conn.srcPort & 255, (conn.dstPort >> 8) & 255, conn.dstPort & 255,
      (conn.seq >>> 24) & 255, (conn.seq >>> 16) & 255, (conn.seq >>> 8) & 255, conn.seq & 255,
      (conn.ack >>> 24) & 255, (conn.ack >>> 16) & 255, (conn.ack >>> 8) & 255, conn.ack & 255,
      0x50, conn.flags, (conn.window >> 8) & 255, conn.window & 255, 0x00, 0x00, 0x00, 0x00,
    ];
    const tcpLen = 20 + payload.length;
    const pseudo = [...conn.srcIp, ...conn.dstIp, 0, 6, (tcpLen >> 8) & 255, tcpLen & 255];
    const ck = inetChecksum([...pseudo, ...hdr, ...payload]);
    hdr[16] = (ck >> 8) & 255; hdr[17] = ck & 255;
    return hdr;
  },
};
