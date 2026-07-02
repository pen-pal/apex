// GENERATED section registry chunk 2 — see sections/registry.tsx. One data row per section: title, sub, component.
import type { SectionEntry } from './registry';
import { ChandySection } from '../ChandySection';
import { LpmSection } from '../LpmSection';
import { VitSection } from '../VitSection';
import { SctpSection } from '../SctpSection';
import { MptcpSection } from '../MptcpSection';
import { PageReplaceSection } from '../PageReplaceSection';
import { RetrySection } from '../RetrySection';
import { SmuggleSection } from '../SmuggleSection';
import { PhiSection } from '../PhiSection';
import { CtSection } from '../CtSection';
import { CondSection } from '../CondSection';
import { IsoSection } from '../IsoSection';
import { VxSection } from '../VxSection';
import { SriSection } from '../SriSection';
import { AeSection } from '../AeSection';
import { HintedHandoffSection } from '../HintedHandoffSection';
import { ReadRepairSection } from '../ReadRepairSection';
import { VrrpSection } from '../VrrpSection';
import { TtSection } from '../TtSection';
import { EcnSection } from '../EcnSection';
import { DotxSection } from '../DotxSection';
import { IpsecSection } from '../IpsecSection';
import { CbSection } from '../CbSection';
import { EcmpSection } from '../EcmpSection';
import { RtmSection } from '../RtmSection';
import { X3dhSection } from '../X3dhSection';
import { ThresholdSection } from '../ThresholdSection';
import { TfoSection } from '../TfoSection';
import { ZeroRttSection } from '../ZeroRttSection';
import { RaftLogSection } from '../RaftLogSection';
import { AvlSection } from '../AvlSection';
import { SplayTreeSection } from '../SplayTreeSection';
import { TreapSection } from '../TreapSection';
import { PieceTableSection } from '../PieceTableSection';
import { EncodingSection } from '../EncodingSection';
import { VarintSection } from '../VarintSection';
import { Base58Section } from '../Base58Section';
import { HuffmanSection } from '../HuffmanSection';
import { GolombRiceSection } from '../GolombRiceSection';
import { EliasCodeSection } from '../EliasCodeSection';
import { GorillaSection } from '../GorillaSection';
import { CobsSection } from '../CobsSection';
import { ErrorDetectSection } from '../ErrorDetectSection';
import { IdentitySection } from '../IdentitySection';
import { JwtSection } from '../JwtSection';
import { AttacksSection } from '../AttacksSection';
import { RoutingSection } from '../RoutingSection';
import { DnsJourneySection } from '../DnsJourneySection';
import { SubnetSection } from '../SubnetSection';

export const chunk2: Record<string, SectionEntry> = {
  "chandy": { Component: ChandySection, title: <>Chandy-Lamport snapshot</>, sub: <>Record a consistent global state of a distributed system with no shared clock — using marker messages over FIFO channels. Step through a two-account bank and watch the snapshot capture the money caught in flight, keeping the books balanced.</> },
  "viterbi": { Component: VitSection, title: <>Viterbi / convolutional codes</>, sub: <>Forward error correction: a rate-1/2 encoder doubles each bit, and the Viterbi decoder walks a trellis to recover the most-likely message. Click a received bit to inject an error and watch it get corrected — no retransmission.</> },
  "sctp": { Component: SctpSection, title: <>SCTP multi-homing</>, sub: <>The transport that survives a dead network path. An association binds multiple addresses per endpoint and fails over to an alternate when a path dies — no reconnect, no lost connection. Fire timeouts and watch it reroute, then see the stateless cookie handshake.</> },
  "mptcp": { Component: MptcpSection, title: <>Multipath TCP</>, sub: <>One TCP connection spread across several network paths at once — your phone using Wi-Fi and cellular together. The stream is striped across subflows, each byte carrying a connection-level Data Sequence Number so segments reassemble in order despite racing across paths. Toggle a path off and watch every byte reroute onto the survivor, connection intact.</> },
  "pagereplace": { Component: PageReplaceSection, title: <>Page replacement</>, sub: <>When memory is full, which page gets evicted? Compare FIFO, LRU, Clock and Optimal on a reference string — count the page faults and watch FIFO's Belady anomaly, where more frames cause more faults.</> },
  "retry": { Component: RetrySection, title: <>Retry &amp; circuit breaker</>, sub: <>How resilient clients avoid making an outage worse. Compare backoff strategies and watch jitter flatten a thundering-herd retry storm, then see a circuit breaker trip open, shed load, and probe its way back to healthy.</> },
  "smuggle": { Component: SmuggleSection, title: <>HTTP request smuggling</>, sub: <>When a front-end proxy and back-end server disagree on how to delimit a request body, the leftover bytes get smuggled onto the next victim's request. Watch CL.TE and TE.CL desyncs split the same bytes at different offsets.</> },
  "phiaccrual": { Component: PhiSection, title: <>Failure detectors (φ-accrual)</>, sub: <>How distributed systems decide a peer is dead without a brittle fixed timeout. A continuous suspicion level adapts to the link's jitter — drag the threshold and compare it against a naive timeout across a GC pause and a real crash.</> },
  "consttime": { Component: CtSection, title: <>Timing attacks</>, sub: <>Why comparing a secret with <code>==</code> is a vulnerability. A naive compare leaks the matching-prefix length through its running time — watch the byte-by-byte attack walk the secret out of it, and watch constant-time compare give the attacker nothing.</> },
  "conditional": { Component: CondSection, title: <>Conditional &amp; range requests</>, sub: <>ETags and validators let HTTP skip work: 304 Not Modified reuses a cached body, 206 Partial Content resumes a download, and If-Match prevents lost updates. Build requests and watch the server's status and bytes-sent change.</> },
  "siteisolation": { Component: IsoSection, title: <>Site isolation</>, sub: <>How a page earns its own process and re-unlocks SharedArrayBuffer post-Spectre. Set COOP and COEP headers and watch crossOriginIsolated resolve, plus which cross-origin subresources are still allowed to embed.</> },
  "vxlan": { Component: VxSection, title: <>VXLAN overlay</>, sub: <>How clouds run millions of isolated tenant L2 networks over one shared L3 fabric. Watch a VTEP wrap a tenant frame in VXLAN/UDP/IP, learn inner-MAC → remote-VTEP to turn floods into unicast, and keep VNIs fully isolated.</> },
  "sri": { Component: SriSection, title: <>Subresource Integrity</>, sub: <>How a page pins the exact bytes of a CDN script so a compromised file can't run. Edit the served file or simulate a CDN compromise and watch the browser re-hash it and block the mismatch.</> },
  "antientropy": { Component: AeSection, title: <>Read-repair &amp; anti-entropy</>, sub: <>How leaderless replicas heal divergence. Make a replica diverge and watch a Merkle-tree comparison drill down only through differing branches to pinpoint the bad keys in O(log n), plus read-repair on the quorum-read path.</> },
  "hintedhandoff": { Component: HintedHandoffSection, title: <>Hinted handoff</>, sub: <>How Dynamo-style stores keep accepting writes while a replica is down. The value is parked as a "hint" on the next healthy node — counting toward the write quorum (a sloppy quorum) — and replayed when the owner recovers. Knock nodes down, tune N and W, and watch writes stay available, then heal.</> },
  "readrepair": { Component: ReadRepairSection, title: <>Read repair — fix-on-read</>, sub: <>How an eventually-consistent store (Dynamo, Cassandra) heals stale replicas as a side effect of ordinary reads: query R replicas, return the freshest, and write it back to the ones that were behind. Build a read set, watch stale replicas get repaired — and see the stale read you get when the read set misses the newest write, the reason strong reads want R + W &gt; N.</> },
  "vrrp": { Component: VrrpSection, title: <>VRRP redundancy</>, sub: <>First-hop redundancy: a group of routers shares one virtual gateway IP so a host is never stranded by a single failure. Toggle routers and watch mastership move, with a priority skew that prevents two backups colliding.</> },
  "truetime": { Component: TtSection, title: <>TrueTime &amp; commit-wait</>, sub: <>How Spanner orders transactions globally using real clocks with bounded uncertainty. Drag ε and watch the commit timestamp and the 2ε commit-wait that buys external consistency — then toggle it off to see ordering break.</> },
  "ecn": { Component: EcnSection, title: <>ECN marking</>, sub: <>How a router signals congestion by marking a packet instead of dropping it. Walk the CE→ECE→CWR signal and compare an ECN flow (marks, zero loss) against a drop-based one — same backoff, no retransmits.</> },
  "dot1x": { Component: DotxSection, title: <>802.1X / EAPOL</>, sub: <>Port-based network access control: a switch port stays blocked until your device passes EAP authentication against a RADIUS server. Step the exchange and watch the authenticator relay EAP and the port flip to authorized.</> },
  "ipsec": { Component: IpsecSection, title: <>IPsec ESP (VPN)</>, sub: <>How a VPN encrypts IP packets. Flip between transport and tunnel mode and watch the ESP wrapping, the encrypted region (opaque, never faked), what an eavesdropper can still read, and how the receiver demuxes by SPI to the right key.</> },
  "causalbcast": { Component: CbSection, title: <>Causal broadcast</>, sub: <>Delivering messages so a reply never appears before the message it answers, even when the network reorders them. Step through a reordered conversation and watch the receiver buffer and release messages to preserve causal order.</> },
  "ecmp": { Component: EcmpSection, title: <>ECMP load spreading</>, sub: <>How a router spreads traffic across equal-cost paths by hashing each flow — keeping flows in order while balancing load. Watch flows scatter, then see the polarization trap when cascaded routers share a hash seed.</> },
  "realtime": { Component: RtmSection, title: <>Realtime: SSE vs WebSocket</>, sub: <>Three ways to push server events to a browser — long-poll, SSE, and WebSocket — compared on one timeline. Drag the network delay and watch long-poll stall events that fire during its reconnect gap.</> },
  "x3dh": { Component: X3dhSection, title: <>X3DH key agreement</>, sub: <>How Signal starts an encrypted session with someone who's offline. Bob's prekey bundle plus Alice's ephemeral fold into four Diffie-Hellman results and one shared key — which Bob rederives later, no live handshake.</> },
  "threshsig": { Component: ThresholdSection, title: <>Threshold signatures</>, sub: <>A t-of-n signing key that no single party holds. Pick a coalition and watch partial signatures combine — via Lagrange interpolation — into one signature that verifies under the group key, while fewer than t signers fail.</> },
  "tfo": { Component: TfoSection, title: <>TCP Fast Open</>, sub: <>Shaving the handshake round-trip off repeat connections by sending request data right in the SYN — with a cookie to keep spoofers out. Compare normal TCP, the first cookie-fetching visit, and a 0-RTT repeat.</> },
  "zerortt": { Component: ZeroRttSection, title: <>0-RTT resumption &amp; the replay problem</>, sub: <>How TLS 1.3 and QUIC send your request in the very first packet — zero round trips to the first byte — using a resumption ticket from a prior visit. The sharp edge: that early data has no server freshness yet, so it can be replayed. Toggle first vs return visit, pick a method, and watch an attacker's replay be harmless for a GET and a double-charge for a POST.</> },
  "raftlog": { Component: RaftLogSection, title: <>Raft log replication</>, sub: <>How an elected leader makes every follower's log identical and decides when an entry is safely committed — including the subtle §5.4.2 rule that stops a majority-stored entry from being overwritten.</> },
  "avl": { Component: AvlSection, title: <>AVL tree</>, sub: <>A binary search tree that rebalances itself after every insert via rotations, so it never degrades into a linked list. Insert keys (or 7 sorted ones) and watch the balance factors and rotations keep it log-deep.</> },
  "splaytree": { Component: SplayTreeSection, title: <>Splay tree — the self-adjusting BST</>, sub: <>A binary search tree that rebalances around whatever you touch: every lookup rotates that node all the way to the root, so recently- and frequently-accessed keys stay near the top and cost O(1). No balance factors or colors — just "move what you touched up." Click nodes and watch the tree remold itself to your access pattern.</> },
  "treap": { Component: TreapSection, title: <>Treap — the randomized BST</>, sub: <>A binary search tree that stays balanced by accident, not by rules. Every node gets a random priority, and the tree maintains BST order on keys plus heap order on priorities at once — which, for random priorities, is a balanced tree with no rotations to track. Add keys (even a sorted run that would ruin a plain BST) and watch it stay shallow; because priorities come from a key hash, the shape depends only on the key set, not insertion order.</> },
  "piecetable": { Component: PieceTableSection, title: <>Piece table — how a text editor holds your document</>, sub: <>The structure VS Code (and historically Word) uses to edit text without ever moving the bytes. The original file is loaded once and never mutated; everything you type is appended to a separate buffer; and the document is just an ordered list of pieces — spans into those two immutable buffers. That's why edits are cheap and undo is nearly free. Insert and delete, and watch the pieces re-stitch while the buffers stay put.</> },
  "encoding": { Component: EncodingSection, title: <>Encoding</>, sub: <>How data is represented as bytes — type and watch it transform, for real.</> },
  "varint": { Component: VarintSection, title: <>Varint &amp; zigzag encoding</>, sub: <>How Protocol Buffers packs integers: seven data bits per byte plus a continuation flag, so small numbers cost one byte and you only pay for the magnitude you use. Type a value to see the bytes and their continuation bits — then meet the negative-number gotcha (a plain signed varint is always 10 bytes) and watch zigzag collapse it back to one.</> },
  "base58": { Component: Base58Section, title: <>Base58 &amp; Base58Check</>, sub: <>The encoding behind Bitcoin addresses and IPFS content IDs. Like Base64 but it drops the look-alike characters (0, O, I, l) so a human can transcribe it, and because 58 isn't a power of two it encodes the whole input as one big base-58 number. Base58Check wraps a version byte and a 4-byte double-SHA256 checksum so a mistyped address is caught before any coins move. Build a real address and watch the checksum catch a typo.</> },
  "huffman": { Component: HuffmanSection, title: <>Huffman coding</>, sub: <>Optimal prefix-free compression — type text and watch the tree build, frequent symbols get short codes, and the bitstream shrink below fixed-width.</> },
  "golombrice": { Component: GolombRiceSection, title: <>Golomb-Rice coding</>, sub: <>The variable-length integer code that's optimal when small values dominate — audio residuals, gaps between events, sparse bitmaps. Split a number into a quotient sent in unary and a remainder in k binary bits; tiny values get tiny codes. Tune the parameter k and watch the bits-per-value curve find its sweet spot.</> },
  "eliascode": { Component: EliasCodeSection, title: <>Elias γ/δ coding</>, sub: <>Parameter-free, self-delimiting codes for positive integers: write a number in binary so a decoder knows where it ends with no separator and no fixed width. γ prefixes the value with ⌊log2 n⌋ zeros as a unary length; δ encodes that length with γ itself, winning for larger numbers. Type a number to see it decompose, then feed a list of gaps and compare against fixed-width.</> },
  "gorilla": { Component: GorillaSection, title: <>Gorilla — time-series compression</>, sub: <>How monitoring systems (Prometheus, InfluxDB) store billions of metric points in a fraction of the space. Timestamps ride on delta-of-delta (regular intervals → one bit); values are XOR'd against the previous point (unchanged or similar → almost no bits). Pick a metric shape and watch a 128-bit-per-sample series collapse — losslessly.</> },
  "cobs": { Component: CobsSection, title: <>COBS — Consistent Overhead Byte Stuffing</>, sub: <>How you frame a raw byte stream so 0x00 can mark the end of a frame — even when the payload contains zeros. COBS removes every zero byte with a tiny, bounded overhead (⌊n/254⌋+1 bytes, never the doubling that escaping risks), leaving 0x00 free as the delimiter. Pick a payload and watch the zeros vanish into code bytes, then decode back exactly.</> },
  "errors": { Component: ErrorDetectSection, title: <>Error control</>, sub: <>How the wire catches — and sometimes repairs — flipped bits, from parity to CRC to Hamming.</> },
  "identity": { Component: IdentitySection, title: <>Identity &amp; Auth</>, sub: <>Tokens, one-time codes, and delegated access — how systems prove who you are.</> },
  "jwt": { Component: JwtSection, title: <>JWT &amp; the alg=none attack</>, sub: <>The signed tokens behind most stateless auth: header.payload.signature, base64url-encoded, signed (not encrypted) so anyone can read the claims but only the key holder can forge a valid one. See a real HS256 token built with genuine HMAC-SHA256, toggle a claim to watch the signature change, then forge an alg=none token and watch a naive verifier accept the unsigned forgery while a strict one rejects it.</> },
  "attacks": { Component: AttacksSection, title: <>Attacks, made visible</>, sub: <>Real mechanisms with real numbers — each shown with its defence. For understanding, not harm.</> },
  "routing": { Component: RoutingSection, title: <>Routing &amp; paths</>, sub: <>Watch a link-state network compute shortest paths with Dijkstra — and reroute when a link cost changes.</> },
  "lpm": { Component: LpmSection, title: <>How a router forwards a packet</>, sub: <>Routing protocols learn the routes; this is the split-second data-plane decision that uses them. A narrated walk through longest-prefix match: a packet arrives, several prefixes in the forwarding table match at once, and the most specific (longest) one wins — found fast by walking a trie. Type any destination and watch which port it takes.</> },
  "dns": { Component: DnsJourneySection, title: <>DNS journey</>, sub: <>Follow a name down the delegation hierarchy — root to TLD to authoritative — and see why caching makes it fast.</> },
  "subnet": { Component: SubnetSection, title: <>Subnetting &amp; CIDR</>, sub: <>See where the network ends and the host begins — on the actual bits — then split a block into subnets.</> },
};
