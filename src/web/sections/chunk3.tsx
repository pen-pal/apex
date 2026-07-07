// GENERATED section registry chunk 3 — see sections/registry.tsx. One data row per section: title, sub, component.
import { AccumulatorSection } from '../AccumulatorSection';
import type { SectionEntry } from './registry';
import { BgpPathSection } from '../BgpPathSection';
import { CongestionSection } from '../CongestionSection';
import { Http2Section } from '../Http2Section';
import { QuicSection } from '../QuicSection';
import { QuicMigSection } from '../QuicMigSection';
import { NatSection } from '../NatSection';
import { SlidingWindowSection } from '../SlidingWindowSection';
import { SwsSection } from '../SwsSection';
import { BufferbloatSection } from '../BufferbloatSection';
import { CookiesSection } from '../CookiesSection';
import { TracerouteSection } from '../TracerouteSection';
import { DhcpSection } from '../DhcpSection';
import { SwitchSection } from '../SwitchSection';
import { TokenBucketSection } from '../TokenBucketSection';
import { ConsistentHashSection } from '../ConsistentHashSection';
import { JumpHashSection } from '../JumpHashSection';
import { RendezvousSection } from '../RendezvousSection';
import { LoadBalanceSection } from '../LoadBalanceSection';
import { BloomSection } from '../BloomSection';
import { CacheHierarchySection } from '../CacheHierarchySection';
import { QosSection } from '../QosSection';
import { MerkleSection } from '../MerkleSection';
import { LamportSigSection } from '../LamportSigSection';
import { LenExtSection } from '../LenExtSection';
import { HmacSection } from '../HmacSection';
import { PaddingOracleSection } from '../PaddingOracleSection';
import { VectorClockSection } from '../VectorClockSection';
import { CrdtSection } from '../CrdtSection';
import { OpTransformSection } from '../OpTransformSection';
import { GossipSection } from '../GossipSection';
import { RaftSection } from '../RaftSection';
import { CapSection } from '../CapSection';
import { ReplicationSection } from '../ReplicationSection';
import { ChainRepSection } from '../ChainRepSection';
import { TwoPcSection } from '../TwoPcSection';
import { ThreePcSection } from '../ThreePcSection';
import { FragmentSection } from '../FragmentSection';
import { BgpHijackSection } from '../BgpHijackSection';
import { MplsSection } from '../MplsSection';
import { SegRouteSection } from '../SegRouteSection';
import { NatTraversalSection } from '../NatTraversalSection';
import { IpCompareSection } from '../IpCompareSection';
import { ArpSection } from '../ArpSection';
import { TorSection } from '../TorSection';
import { BitTorrentSection } from '../BitTorrentSection';
import { MagnetSection } from '../MagnetSection';
import { MixnetSection } from '../MixnetSection';
import { TrafficCorrSection } from '../TrafficCorrSection';
import { FirewallSection } from '../FirewallSection';
import { SiemSection } from '../SiemSection';
import { SeccompSection } from '../SeccompSection';
import { HoneypotSection } from '../HoneypotSection';
import { CensorshipSection } from '../CensorshipSection';
import { OnionServiceSection } from '../OnionServiceSection';
import { CsrfSection } from '../CsrfSection';
import { IdsSection } from '../IdsSection';
import { DnsTunnelSection } from '../DnsTunnelSection';
import { CsmaSection } from '../CsmaSection';
import { MulticastSection } from '../MulticastSection';
import { VlanSection } from '../VlanSection';
import { NtpSection } from '../NtpSection';
import { GpsSection } from '../GpsSection';
import { ArqSection } from '../ArqSection';

export const chunk3: Record<string, SectionEntry> = {
  "bgp": { Component: BgpPathSection, title: <>BGP best-path selection</>, sub: <>Step down BGP's tie-breaker ladder and watch candidate routes get eliminated until one best path wins.</> },
  "congestion": { Component: CongestionSection, title: <>TCP congestion control</>, sub: <>Watch the congestion window probe, back off, and recover — the sawtooth behind every TCP transfer's speed.</> },
  "http2": { Component: Http2Section, title: <>HTTP/2 multiplexing</>, sub: <>One connection, many interleaved streams — watch short requests stop waiting behind big ones.</> },
  "quic": { Component: QuicSection, title: <>QUIC vs TCP + TLS</>, sub: <>Fewer round trips to the first byte, and no transport-layer head-of-line blocking — why HTTP/3 left TCP.</> },
  "quicmig": { Component: QuicMigSection, title: <>QUIC connection migration</>, sub: <>Why a QUIC download survives walking from wifi onto cellular while a TCP one dies. TCP finds your connection by its 4-tuple — change your IP and it's gone, forcing a full reconnect. QUIC tags every packet with a connection ID independent of address, so the same connection is recognized from a new network and only needs a quick path validation. Toggle the protocol and switch networks to see it.</> },
  "nat": { Component: NatSection, title: <>NAT / PAT</>, sub: <>One public IP for a whole network — watch the translation table build and route replies home.</> },
  "flow": { Component: SlidingWindowSection, title: <>TCP flow control</>, sub: <>The sliding window — how the receiver's advertised window throttles a sender that's going too fast.</> },
  "sws": { Component: SwsSection, title: <>Silly window syndrome</>, sub: <>The TCP flow-control pathology where a connection collapses into a flood of tiny segments, wasting nearly all its bandwidth on packet headers. A slow-reading receiver frees a few bytes at a time and advertises those tiny windows; an eager sender fills each one with a runt segment. The cure is Clark's receiver-side avoidance plus Nagle's sender-side coalescing. Drag the reader's pace and watch goodput collapse and recover.</> },
  "bufferbloat": { Component: BufferbloatSection, title: <>Bufferbloat &amp; AQM</>, sub: <>Why a bigger buffer makes latency worse — and how active queue management keeps it low.</> },
  "cookies": { Component: CookiesSection, title: <>HTTP cookies &amp; sessions</>, sub: <>Craft a request and watch which cookies attach — domain, path, Secure, and SameSite rules in action.</> },
  "traceroute": { Component: TracerouteSection, title: <>Traceroute</>, sub: <>Map the routers to a destination using only the TTL field — one hop revealed per probe.</> },
  "dhcp": { Component: DhcpSection, title: <>DHCP — DORA &amp; the lease</>, sub: <>Discover, Offer, Request, Ack — how a device gets an address from nothing, and how the lease ages.</> },
  "switch": { Component: SwitchSection, title: <>Ethernet switch (L2)</>, sub: <>Send frames and watch the switch learn MAC addresses, then flood the unknown and forward the known.</> },
  "ratelimit": { Component: TokenBucketSection, title: <>Rate limiting (token bucket)</>, sub: <>How an API allows bursts but caps the sustained rate — drain the bucket and watch the 429s begin.</> },
  "chash": { Component: ConsistentHashSection, title: <>Consistent hashing</>, sub: <>Add or remove a server and watch only a small arc of keys move — not the whole keyspace.</> },
  "jumphash": { Component: JumpHashSection, title: <>Jump consistent hash</>, sub: <>Google's memoryless consistent-hash algorithm: map a key to one of N shards in five lines, so that growing N by one moves only ~1/N of keys — and only onto the new shard. Drag the bucket count and watch which keys move, then compare against plain key % N, which reshuffles almost everything.</> },
  "rendezvous": { Component: RendezvousSection, title: <>Rendezvous hashing (HRW)</>, sub: <>Highest Random Weight: to place a key, score it against every node with hash(key, node) and pick the highest — no ring, no virtual nodes. Keys spread evenly, and adding or removing a node moves only ~1/N of them. The full ranking doubles as a replica preference list. Pick a key, watch the weights, and add/remove nodes to see how little moves.</> },
  "lb": { Component: LoadBalanceSection, title: <>Load balancing</>, sub: <>Six strategies — round-robin, weighted, least-connections, IP-hash, random, and power-of-two-choices — watch each spread requests differently, and see why sampling just two backends (P2C) nearly eliminates the tail that dooms pure random.</> },
  "bloom": { Component: BloomSection, title: <>Bloom filter</>, sub: <>A few bits and a few hashes that answer “definitely not” or “probably yes” — watch it fill and false-positive.</> },
  "cdn": { Component: CacheHierarchySection, title: <>CDN &amp; caching</>, sub: <>Watch a request cascade browser → edge → origin: cold miss, warm hit, then TTL expiry and revalidation.</> },
  "qos": { Component: QosSection, title: <>QoS packet scheduling</>, sub: <>Strict priority vs weighted round robin — watch one starve a class and the other share fairly.</> },
  "merkle": { Component: MerkleSection, title: <>Merkle tree</>, sub: <>One root hash commits to a whole dataset — click a leaf for its proof, edit one and watch its path change.</> },
  "accumulator": { Component: AccumulatorSection, title: <>A whole set in one number (RSA accumulator)</>, sub: <>Where a Merkle tree’s membership proofs grow as log(n), an RSA accumulator commits to a set with a single number and proves membership with a single number — constant size. Map each element to a prime; the accumulator is acc = g^(∏ primes) mod N. A witness for x is g^(∏ of the others); anyone checks w^x ≡ acc. Faking membership needs an x-th root of acc, hard under Strong RSA. Verified in node: witnesses verify for every member, adds update correctly (acc′ = acc^x), and non-members never verify. Powers stateless blockchains, revocation, and anonymous credentials. Prove membership and add elements.</> },
  "lamportsig": { Component: LamportSigSection, title: <>Lamport one-time signatures</>, sub: <>A digital signature built from nothing but a hash function — quantum-resistant, and the root of the post-quantum schemes SPHINCS+ and XMSS. The private key is 2L random secrets; the public key is those secrets hashed; signing reveals one secret per message-digest bit, and verifying re-hashes them. But it signs exactly once: sign a second message with the same key and watch positions expose both secrets, letting a forger take over. Type a message and see.</> },
  "lenext": { Component: LenExtSection, title: <>The length-extension attack</>, sub: <>Why H(secret ‖ message) is a broken MAC — and why HMAC exists. Because a Merkle–Damgård digest is the hash's internal state, an attacker who never learns the secret can resume from a published tag, append the message's padding plus their own bytes, and forge a valid tag. Play the attacker, watch the forgery get accepted, then flip to HMAC and watch it fail.</> },
  "hmac": { Component: HmacSection, title: <>HMAC — keyed message authentication</>, sub: <>How you prove a message came from someone holding a shared secret and wasn't tampered with — the MAC behind TLS, JWTs (HS256), webhook signatures, and AWS request signing. Naive keyed hashing H(key ‖ msg) is broken by length extension; HMAC hashes twice with two key-derived pads so there's nothing to extend. Type a key and message and watch it build from real SHA-256, matching the RFC 4231 vectors.</> },
  "paddingoracle": { Component: PaddingOracleSection, title: <>The padding-oracle attack</>, sub: <>How a server that only says "valid padding" or "invalid padding" leaks the entire plaintext of a CBC-encrypted message — without the key. Because CBC decryption XORs the previous block, an attacker forges it byte by byte and watches the padding check to recover each byte. Type a secret, step through the attack, and watch the plaintext fall.</> },
  "vclock": { Component: VectorClockSection, title: <>Vector clocks</>, sub: <>Order events across processes without a shared clock — click two to see if one caused the other or they're concurrent.</> },
  "crdt": { Component: CrdtSection, title: <>CRDTs</>, sub: <>Conflict-free replicated data types — edit two replicas offline, then merge to a deterministic result with no lost updates and no coordination.</> },
  "optransform": { Component: OpTransformSection, title: <>Operational transformation</>, sub: <>How Google Docs lets many people type in one document at once. When a site receives a concurrent edit, it transforms the operation against its own — adjusting indices so both replicas converge to the same text no matter what order edits arrive. Set two concurrent edits and watch both replicas converge, then compare the naive approach that diverges.</> },
  "gossip": { Component: GossipSection, title: <>Gossip / epidemic spread</>, sub: <>Watch news sweep a leaderless cluster round by round in the classic S-curve — converging in ~log(N) rounds.</> },
  "raft": { Component: RaftSection, title: <>Raft leader election</>, sub: <>Click a node to fire its election timeout — watch terms, votes, and majorities decide a single leader.</> },
  "cap": { Component: CapSection, title: <>CAP theorem</>, sub: <>Partition the network, then choose consistency or availability — and watch the trade-off you can't escape.</> },
  "replication": { Component: ReplicationSection, title: <>Replication &amp; the WAL</>, sub: <>Leader appends, followers copy — sync waits for a quorum, async risks the tail. Crash the leader and see what survives.</> },
  "chainrep": { Component: ChainRepSection, title: <>Chain replication</>, sub: <>Strong consistency without quorum math. Replicas form a chain: writes enter the head and flow to the tail, which commits and acks; reads are served by the tail, so they always see the latest committed write. Step a write down the chain, then fail a node and watch the chain reconfigure with a simple head/tail relabel.</> },
  "twopc": { Component: TwoPcSection, title: <>Two-phase commit</>, sub: <>Atomic commit across databases — vote, decide, and watch the coordinator-crash blocking problem.</> },
  "threepc": { Component: ThreePcSection, title: <>Three-phase commit</>, sub: <>The non-blocking fix for two-phase commit. 2PC leaves participants stuck holding locks if the coordinator crashes after the votes; 3PC's extra pre-commit phase lets the survivors decide on their own. Set the votes and the coordinator crash point, and compare the two protocols side by side — plus why consensus (Paxos/Raft) replaced both.</> },
  "fragment": { Component: FragmentSection, title: <>IP fragmentation &amp; MTU</>, sub: <>Split a datagram to fit the link — offsets, MF flags, reassembly — or set DF and watch Path-MTU Discovery.</> },
  "bgphijack": { Component: BgpHijackSection, title: <>BGP route propagation &amp; hijacking</>, sub: <>Watch a prefix spread across ASes — then a rogue AS hijack it and redirect the internet's traffic.</> },
  "mpls": { Component: MplsSection, title: <>MPLS label switching</>, sub: <>Forward on a label, not an address — step a packet down the LSP and watch the label pushed at the ingress, swapped hop by hop, and popped at the penultimate router.</> },
  "segrouting": { Component: SegRouteSection, title: <>Segment routing</>, sub: <>Steer a packet along any path by writing a stack of waypoints ("segments") into its header — no per-flow state in the core the way old RSVP-TE needed. A node segment means "reach router X by the shortest path"; an adjacency segment forces one specific link. Pick a segment list and watch the realized route light up, engineered to detour around a link the shortest path would take.</> },
  "natpunch": { Component: NatTraversalSection, title: <>NAT traversal (STUN / TURN / ICE)</>, sub: <>How two peers behind NATs connect — hole-punch a direct path, or fall back to a relay when a symmetric NAT blocks it.</> },
  "ipcompare": { Component: IpCompareSection, title: <>IPv4 vs IPv6 headers</>, sub: <>The two headers side by side — what IPv6 removed, renamed, and added, and why it forwards faster.</> },
  "arp": { Component: ArpSection, title: <>ARP resolution</>, sub: <>Map an IP to its MAC on the LAN — who-has broadcast, is-at reply, the cache, and gratuitous ARP.</> },
  "tor": { Component: TorSection, title: <>Tor &amp; onion routing</>, sub: <>Wrap a request in one encryption layer per relay and send it through a 3-hop circuit; each relay peels one layer and learns only the previous and next hop. No single relay links you to the site — watch when a guard+exit collusion breaks it.</> },
  "bittorrent": { Component: BitTorrentSection, title: <>BitTorrent &amp; the swarm</>, sub: <>No central server: a file is split into pieces, a swarm of peers each holds some, and you pull from many at once — rarest piece first so nothing goes extinct, uploading tit-for-tat. Watch a file fill in live, each piece coloured by the peer it came from.</> },
  "dnstunnel": { Component: DnsTunnelSection, title: <>DNS tunneling (C2 &amp; exfil)</>, sub: <>A firewall blocks everything but DNS — so malware hides data in the subdomains of DNS queries to a domain the attacker owns. Type a secret and watch it hex-encode into queries, slip past the firewall, and reassemble at the attacker’s server — plus how a defender catches it.</> },
  "ids": { Component: IdsSection, title: <>IDS / IPS detection</>, sub: <>Two ways to catch an intruder, failing in opposite directions: a signature detector is precise but blind to anything new; an anomaly detector spots novel behaviour but cries wolf at unusual-but-innocent traffic. Scan the same stream with each and watch the catches, misses, and false alarms.</> },
  "csrf": { Component: CsrfSection, title: <>CSRF &amp; SameSite</>, sub: <>An attacker page makes your browser POST to a site you’re logged into — the browser attaches your cookie by destination, so the request looks authentic. Toggle SameSite and a CSRF token and watch the forged transfer succeed or get blocked.</> },
  "onionservice": { Component: OnionServiceSection, title: <>Onion services (.onion)</>, sub: <>Reach a server that has no public IP — and neither side learns the other’s location. Both sides meet at a rendezvous relay over their own Tor circuit, so no relay sees two IPs. Compromise relays yourself and confirm it: no single one links both ends — only controlling a relay on each end (both guards) deanonymizes.</> },
  "censorship": { Component: CensorshipSection, title: <>Censorship circumvention</>, sub: <>A national firewall hunts and blocks Tor with DPI, a relay blocklist, and SNI filtering. Watch a connection pick up obfs4, a bridge, and domain fronting one at a time until it slips through — each technique defeats exactly one layer.</> },
  "honeypot": { Component: HoneypotSection, title: <>Honeypot &amp; honeytokens</>, sub: <>A decoy service has no legitimate use, so any interaction with it is malicious by definition — which gives it something a volume alarm can’t have: zero false positives. Run it next to a threshold IDS on the same traffic and watch the difference: the IDS false-flags a chatty backup job, the honeypot never does. Its catch is realism — tune the decoy so a scanning attacker actually probes it instead of fingerprinting and skipping.</> },
  "seccomp": { Component: SeccompSection, title: <>seccomp (syscall sandbox)</>, sub: <>A process can voluntarily give up the right to make syscalls outside an allowlist — so even after it’s exploited, a blocked <code>execve</code>/<code>ptrace</code> goes nowhere. It’s how Docker, Chrome, and systemd box in a compromise. Below, a program does real work and then gets exploited into spawning a shell: write the filter so the program still runs but the exploit is blocked. Too tight kills it mid-work; too loose is theatre.</> },
  "siem": { Component: SiemSection, title: <>SIEM log correlation</>, sub: <>A single failed login means nothing; correlated across a time window it’s an attack. A SIEM ingests logs from every host and runs rules like “K failed logins from one source within W seconds.” Hidden in the benign noise below is a brute-force burst — tune the threshold and the window to catch it without drowning in false alarms. Too tight misses the breach; too loose flags every password typo.</> },
  "firewall": { Component: FirewallSection, title: <>Firewall rules (iptables)</>, sub: <>A packet-filter firewall reads its rules top-to-bottom and stops at the first one that matches — which is exactly where people get burned. The chain below starts in the classic buggy order, with a broad “allow SSH” sitting above the rule meant to block the attacker, so the attacker walks in. Reorder or disable rules until legit traffic still flows and the attacker is dropped. Real CIDR matching and first-match evaluation.</> },
  "trafficcorr": { Component: TrafficCorrSection, title: <>Traffic correlation attack</>, sub: <>Onion routing hides what you send and which relay carries it — but not the shape of your traffic over time. Play the adversary: you captured your target’s flow entering Tor; match its bursts-and-gaps fingerprint to one of the flows leaving Tor, with no decryption at all. Then switch on constant-rate cover traffic and watch your attack collapse — the reason Tor can’t beat a global observer and mix networks trade latency for defense.</> },
  "mixnet": { Component: MixnetSection, title: <>Mix networks</>, sub: <>Onion routing like Tor forwards every cell immediately, so an adversary who watches both ends can correlate timing and link you to whom you’re talking to. A <strong>mix</strong> refuses to: it batches messages, peels a layer off each, and releases them shuffled — so the best an observer can do is a 1-in-N guess. Drag the batch size and watch the anonymity set move; the cost is latency, which is why it suits messaging, not live browsing.</> },
  "magnet": { Component: MagnetSection, title: <>Magnet links &amp; the infohash</>, sub: <>A magnet link is nothing but an infohash — the SHA-1 content address of a torrent’s piece list. From that one number a client finds peers via the DHT and fetches everything else, with no tracker or file to seize. Tamper a byte and watch the whole address move — that’s content addressing, and it’s what makes torrents tamper-evident and censorship-resistant.</> },
  "csma": { Component: CsmaSection, title: <>WiFi CSMA/CA</>, sub: <>How stations share one wireless channel — random backoff, collisions, and the contention window growing under load.</> },
  "multicast": { Component: MulticastSection, title: <>Multicast &amp; IGMP</>, sub: <>One sender, many subscribers — join hosts to a group and watch an IGMP-snooping switch forward the frame to only the members, not every port.</> },
  "vlan": { Component: VlanSection, title: <>802.1Q VLAN tagging</>, sub: <>Build the 4-byte VLAN tag, follow a frame across access and trunk ports, and run the double-tagging hop that abuses the native VLAN.</> },
  "ntp": { Component: NtpSection, title: <>NTP clock sync</>, sub: <>Four timestamps recover the clock offset across an unknown network — slide the path delays and watch it stay exact when symmetric, and the server's own delay cancel out.</> },
  "gps": { Component: GpsSection, title: <>How GPS finds your position</>, sub: <>Each satellite broadcasts its position and atomic-clock time; your receiver turns each signal's travel time into a distance, placing you on a circle. Intersect them and they meet at one point — trilateration. But your phone's cheap clock inflates every range by the same amount, so the circles miss; the fix is to solve the clock offset as a fourth unknown, which is why you need four satellites. Slide the assumed clock offset and watch the circles converge on your position — or run the real Gauss-Newton solve.</> },
  "arq": { Component: ArqSection, title: <>ARQ — Go-Back-N vs Selective Repeat</>, sub: <>Drop one frame and compare: Go-Back-N resends it and everything after; Selective Repeat buffers and resends only the gap.</> },
};
