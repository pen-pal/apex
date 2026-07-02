// Apex UI. A multi-section visual playground for how the internet works:
//   • Network    — build/inspect real frames across 90+ protocols
//   • Cryptography — real hashing/encryption on sandbox values
//   • Encoding   — how data becomes bytes (UTF-8, bases, Base64, floats)
// Everything derives from real bytes; nothing is faked.
import { StrictMode, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import { initAnalytics, trackSection, trackDwell, trackInteraction } from './analytics';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { ProtocolRegistry } from '../core/registry';
import { registerCoreProtocols } from '../protocols';
import { buildFrame } from '../core/builder';
import { dissect } from '../core/engine';
import { buildByteModel } from './byteModel';
import { buildJourney, journeyFromTree } from './journeyModel';
import { findHeaderChecksum } from './checksumWalk';
import { findStateful } from './stateWalk';
import { encodePayload, type Mode } from './payload';
import { buildConnection, DEFAULT_FORM, type ConnForm, type FlagSet } from './connectionForm';
import { EXAMPLES } from './examples';
import { parseCapture, type Pcap } from './pcap';
import { ByteView } from './ByteView';
import { JourneyView } from './JourneyView';
import { LifecycleView } from './LifecycleView';
import { ChecksumView } from './ChecksumView';
import { CryptoView } from './CryptoView';
import { AesRoundSection } from './AesRoundSection';
import { ClassicalSection } from './ClassicalSection';
import { OneTimePadSection } from './OneTimePadSection';
import { AeadSection } from './AeadSection';
import { RsaSection } from './RsaSection';
import { EccSection } from './EccSection';
import { EcdsaSection } from './EcdsaSection';
import { SchnorrSection } from './SchnorrSection';
import { ChachaSection } from './ChachaSection';
import { HashInternalsSection } from './HashInternalsSection';
import { LweSection } from './LweSection';
import { BB84Section } from './BB84Section';
import { StpSection } from './StpSection';
import { SlaacSection } from './SlaacSection';
import { LineCodingSection } from './LineCodingSection';
import { EcbPenguinSection } from './EcbPenguinSection';
import { LamportSection } from './LamportSection';
import { QuorumSection } from './QuorumSection';
import { Lz77Section } from './Lz77Section';
import { CorsSection } from './CorsSection';
import { TcpHandshakeSection } from './TcpHandshakeSection';
import { TimeWaitSection } from './TimeWaitSection';
import { DnssecSection } from './DnssecSection';
import { KaminskySection } from './KaminskySection';
import { PaxosSection } from './PaxosSection';
import { WebInjectSection } from './WebInjectSection';
import { DhKexSection } from './DhKexSection';
import { CrcWalkSection } from './CrcWalkSection';
import { SnowflakeSection } from './SnowflakeSection';
import { PmtudSection } from './PmtudSection';
import { CountMinSection } from './CountMinSection';
import { MinHashSection } from './MinHashSection';
import { SackSection } from './SackSection';
import { BullySection } from './BullySection';
import { CspSection } from './CspSection';
import { EdDsaSection } from './EdDsaSection';
import { HllSection } from './HllSection';
import { TtlHopSection } from './TtlHopSection';
import { BdpSection } from './BdpSection';
import { WebAuthnSection } from './WebAuthnSection';
import { AnycastSection } from './AnycastSection';
import { MailAuthSection } from './MailAuthSection';
import { ConsistencySection } from './ConsistencySection';
import { ReedSolomonSection } from './ReedSolomonSection';
import { CubicSection } from './CubicSection';
import { WpaSection } from './WpaSection';
import { BbrSection } from './BbrSection';
import { BtreeSection } from './BtreeSection';
import { LsmSection } from './LsmSection';
import { MvccSection } from './MvccSection';
import { WalSection } from './WalSection';
import { SkipListSection } from './SkipListSection';
import { PedersenSection } from './PedersenSection';
import { LockingSection } from './LockingSection';
import { TrieSection } from './TrieSection';
import { HamtSection } from './HamtSection';
import { PbftSection } from './PbftSection';
import { LzwSection } from './LzwSection';
import { HlcSection } from './HlcSection';
import { CuckooSection } from './CuckooSection';
import { RobinHoodSection } from './RobinHoodSection';
import { GeohashSection } from './GeohashSection';
import { KdTreeSection } from './KdTreeSection';
import { ChordSection } from './ChordSection';
import { KademliaSection } from './KademliaSection';
import { UnionFindSection } from './UnionFindSection';
import { FenwickSection } from './FenwickSection';
import { SparseTableSection } from './SparseTableSection';
import { CartesianSection } from './CartesianSection';
import { RoaringSection } from './RoaringSection';
import { BitmapIndexSection } from './BitmapIndexSection';
import { KmpSection } from './KmpSection';
import { RabinKarpSection } from './RabinKarpSection';
import { HashTableSection } from './HashTableSection';
import { EditDistanceSection } from './EditDistanceSection';
import { TopoSortSection } from './TopoSortSection';
import { AstarSection } from './AstarSection';
import { HeapSection } from './HeapSection';
import { PairingHeapSection } from './PairingHeapSection';
import { SortingSection } from './SortingSection';
import { KadaneSection } from './KadaneSection';
import { LisSection } from './LisSection';
import { QuickselectSection } from './QuickselectSection';
import { MomSection } from './MomSection';
import { DnfSection } from './DnfSection';
import { FisherYatesSection } from './FisherYatesSection';
import { AliasMethodSection } from './AliasMethodSection';
import { MajoritySection } from './MajoritySection';
import { SegTreeSection } from './SegTreeSection';
import { IntervalTreeSection } from './IntervalTreeSection';
import { ReservoirSection } from './ReservoirSection';
import { DfaSection } from './DfaSection';
import { FencingSection } from './FencingSection';
import { LeasesSection } from './LeasesSection';
import { HashChainSection } from './HashChainSection';
import { HappyEyeballsSection } from './HappyEyeballsSection';
import { NagleSection } from './NagleSection';
import { ChandySection } from './ChandySection';
import { VitSection } from './VitSection';
import { SctpSection } from './SctpSection';
import { MptcpSection } from './MptcpSection';
import { PageReplaceSection } from './PageReplaceSection';
import { RetrySection } from './RetrySection';
import { SmuggleSection } from './SmuggleSection';
import { PhiSection } from './PhiSection';
import { CtSection } from './CtSection';
import { CondSection } from './CondSection';
import { IsoSection } from './IsoSection';
import { VxSection } from './VxSection';
import { SriSection } from './SriSection';
import { AeSection } from './AeSection';
import { HintedHandoffSection } from './HintedHandoffSection';
import { ReadRepairSection } from './ReadRepairSection';
import { VrrpSection } from './VrrpSection';
import { TtSection } from './TtSection';
import { EcnSection } from './EcnSection';
import { DotxSection } from './DotxSection';
import { IpsecSection } from './IpsecSection';
import { CbSection } from './CbSection';
import { EcmpSection } from './EcmpSection';
import { RtmSection } from './RtmSection';
import { X3dhSection } from './X3dhSection';
import { ThresholdSection } from './ThresholdSection';
import { TfoSection } from './TfoSection';
import { ZeroRttSection } from './ZeroRttSection';
import { RaftLogSection } from './RaftLogSection';
import { AvlSection } from './AvlSection';
import { SplayTreeSection } from './SplayTreeSection';
import { TreapSection } from './TreapSection';
import { PieceTableSection } from './PieceTableSection';
import { StoryView } from './StoryView';
import { EncodingSection } from './EncodingSection';
import { VarintSection } from './VarintSection';
import { Base58Section } from './Base58Section';
import { HuffmanSection } from './HuffmanSection';
import { GolombRiceSection } from './GolombRiceSection';
import { EliasCodeSection } from './EliasCodeSection';
import { GorillaSection } from './GorillaSection';
import { CobsSection } from './CobsSection';
import { ErrorDetectSection } from './ErrorDetectSection';
import { IdentitySection } from './IdentitySection';
import { JwtSection } from './JwtSection';
import { AttacksSection } from './AttacksSection';
import { RoutingSection } from './RoutingSection';
import { DnsJourneySection } from './DnsJourneySection';
import { SubnetSection } from './SubnetSection';
import { BgpPathSection } from './BgpPathSection';
import { CongestionSection } from './CongestionSection';
import { Http2Section } from './Http2Section';
import { QuicSection } from './QuicSection';
import { QuicMigSection } from './QuicMigSection';
import { NatSection } from './NatSection';
import { SlidingWindowSection } from './SlidingWindowSection';
import { SwsSection } from './SwsSection';
import { BufferbloatSection } from './BufferbloatSection';
import { CookiesSection } from './CookiesSection';
import { CertChainSection } from './CertChainSection';
import { TracerouteSection } from './TracerouteSection';
import { DhcpSection } from './DhcpSection';
import { SwitchSection } from './SwitchSection';
import { TokenBucketSection } from './TokenBucketSection';
import { ConsistentHashSection } from './ConsistentHashSection';
import { JumpHashSection } from './JumpHashSection';
import { RendezvousSection } from './RendezvousSection';
import { LoadBalanceSection } from './LoadBalanceSection';
import { BloomSection } from './BloomSection';
import { CacheHierarchySection } from './CacheHierarchySection';
import { QosSection } from './QosSection';
import { MerkleSection } from './MerkleSection';
import { LamportSigSection } from './LamportSigSection';
import { LenExtSection } from './LenExtSection';
import { HmacSection } from './HmacSection';
import { PaddingOracleSection } from './PaddingOracleSection';
import { VectorClockSection } from './VectorClockSection';
import { CrdtSection } from './CrdtSection';
import { OpTransformSection } from './OpTransformSection';
import { GossipSection } from './GossipSection';
import { RaftSection } from './RaftSection';
import { CapSection } from './CapSection';
import { ReplicationSection } from './ReplicationSection';
import { ChainRepSection } from './ChainRepSection';
import { TwoPcSection } from './TwoPcSection';
import { ThreePcSection } from './ThreePcSection';
import { FragmentSection } from './FragmentSection';
import { BgpHijackSection } from './BgpHijackSection';
import { MplsSection } from './MplsSection';
import { SegRouteSection } from './SegRouteSection';
import { NatTraversalSection } from './NatTraversalSection';
import { IpCompareSection } from './IpCompareSection';
import { IcmpSection } from './IcmpSection';
import { ArpSection } from './ArpSection';
import { CsmaSection } from './CsmaSection';
import { MulticastSection } from './MulticastSection';
import { VlanSection } from './VlanSection';
import { NtpSection } from './NtpSection';
import { ArqSection } from './ArqSection';
import { QueueingSection } from './QueueingSection';
import { RtoSection } from './RtoSection';
import { DistanceVectorSection } from './DistanceVectorSection';
import { MdnsSection } from './MdnsSection';
import { EncryptedDnsSection } from './EncryptedDnsSection';
import { HttpThreeSection } from './HttpThreeSection';
import { GrpcSection } from './GrpcSection';
import { WebSocketSection } from './WebSocketSection';
import { DhMitmSection } from './DhMitmSection';
import { TlsDowngradeSection } from './TlsDowngradeSection';
import { PasswordHashSection } from './PasswordHashSection';
import { ShamirSection } from './ShamirSection';
import { EnvelopeSection } from './EnvelopeSection';
import { FeldmanSection } from './FeldmanSection';
import { ProofOfWorkSection } from './ProofOfWorkSection';
import { FeistelSection } from './FeistelSection';
import { Poly1305Section } from './Poly1305Section';
import { HashCollisionSection } from './HashCollisionSection';
import { RatchetSection } from './RatchetSection';
import { KerberosSection } from './KerberosSection';
import { RevocationSection } from './RevocationSection';
import { SshSection } from './SshSection';
import { GROUPS, metaById, groupOf } from './sections';
import { OverviewSection } from './OverviewSection';
import { JourneyBar } from './JourneyBar';
import { pathById } from './paths';
import { CpuSchedSection } from './CpuSchedSection';
import { PageWalkSection } from './PageWalkSection';
import { InodeSection } from './InodeSection';
import { MesiSection } from './MesiSection';
import { FalseSharingSection } from './FalseSharingSection';
import { JoinsSection } from './JoinsSection';
import { FlowCtlSection } from './FlowCtlSection';
import { TsoSection } from './TsoSection';
import { LinkStateSection } from './LinkStateSection';
import { MaxFlowSection } from './MaxFlowSection';
import { NttSection } from './NttSection';
import { BwtSection } from './BwtSection';
import { TailLatencySection } from './TailLatencySection';
import { HdrHistSection } from './HdrHistSection';
import { DdSketchSection } from './DdSketchSection';
import { WatermarkSection } from './WatermarkSection';
import { MstSection } from './MstSection';
import { CfsSection } from './CfsSection';
import { PriorityInvSection } from './PriorityInvSection';
import { PipelineSection } from './PipelineSection';
import { SccSection } from './SccSection';
import { CycleDetectSection } from './CycleDetectSection';
import { QueryPlanSection } from './QueryPlanSection';
import { RumSection } from './RumSection';
import { ArithSection } from './ArithSection';
import { SwimSection } from './SwimSection';
import { AhoCorasickSection } from './AhoCorasickSection';
import { FloydSection } from './FloydSection';
import { BellmanFordSection } from './BellmanFordSection';
import { LeakyBucketSection } from './LeakyBucketSection';
import { GcraSection } from './GcraSection';
import { DramSection } from './DramSection';
import { AdderSection } from './AdderSection';
import { LatchSection } from './LatchSection';
import { AluSection } from './AluSection';
import { MemBusSection } from './MemBusSection';
import { IoSection } from './IoSection';
import { SsdSection } from './SsdSection';
import { TransistorSection } from './TransistorSection';
import { GpuSection } from './GpuSection';
import { CpuCacheSection } from './CpuCacheSection';
import { OooExecSection } from './OooExecSection';
import { RopeSection } from './RopeSection';
import { GapBufferSection } from './GapBufferSection';
import { FastInvSqrtSection } from './FastInvSqrtSection';
import { KahanSumSection } from './KahanSumSection';
import { KaratsubaSection } from './KaratsubaSection';
import { SimAnnealSection } from './SimAnnealSection';
import { HammingSection } from './HammingSection';
import { BresenhamSection } from './BresenhamSection';
import { ConvexHullSection } from './ConvexHullSection';
import { MarchSquaresSection } from './MarchSquaresSection';
import { VoronoiSection } from './VoronoiSection';
import { CodePanel } from './CodePanel';
import { KnapsackSection } from './KnapsackSection';
import { DeployStratSection } from './DeployStratSection';
import { HealthCheckSection } from './HealthCheckSection';
import { AutoscaleSection } from './AutoscaleSection';
import { UslSection } from './UslSection';
import { PidSection } from './PidSection';
import { SloSection } from './SloSection';
import { TracingSection } from './TracingSection';
import { FeatureFlagSection } from './FeatureFlagSection';
import { GracefulShutdownSection } from './GracefulShutdownSection';
import { IdempotencySection } from './IdempotencySection';
import { LoadShedSection } from './LoadShedSection';
import { BulkheadSection } from './BulkheadSection';
import { ChaosSection } from './ChaosSection';
import { SingleFlightSection } from './SingleFlightSection';
import { BranchPredictSection } from './BranchPredictSection';
import { SpectreSection } from './SpectreSection';
import { BoyerMooreSection } from './BoyerMooreSection';
import { NewtonSection } from './NewtonSection';
import { CowSection } from './CowSection';
import { MtfSection } from './MtfSection';
import { CdcSection } from './CdcSection';
import { RsyncSection } from './RsyncSection';
import { TlbSection } from './TlbSection';
import { NumaSection } from './NumaSection';
import { BuddyAllocSection } from './BuddyAllocSection';
import { TimingWheelSection } from './TimingWheelSection';
import { EpollSection } from './EpollSection';
import { FutexSection } from './FutexSection';
import { RcuSection } from './RcuSection';
import { AbaSection } from './AbaSection';
import { SeqlockSection } from './SeqlockSection';
import { IoUringSection } from './IoUringSection';
import { BakerySection } from './BakerySection';
import { SuffixArraySection } from './SuffixArraySection';
import { ManacherSection } from './ManacherSection';
import { ZalgoSection } from './ZalgoSection';
import { FftSection } from './FftSection';
import { SsrfSection } from './SsrfSection';
import { XxeSection } from './XxeSection';
import { DnsRebindSection } from './DnsRebindSection';
import { ArpSpoofSection } from './ArpSpoofSection';
import { ProtoPolluteSection } from './ProtoPolluteSection';
import { SagaSection } from './SagaSection';
import { BlindSigSection } from './BlindSigSection';
import { VrfSection } from './VrfSection';
import { OtSection } from './OtSection';
import { PaillierSection } from './PaillierSection';
import { ElGamalSection } from './ElGamalSection';
import { ClickjackSection } from './ClickjackSection';
import { HstsSection } from './HstsSection';
import { OpenRedirectSection } from './OpenRedirectSection';
import { HashFloodSection } from './HashFloodSection';
import { RedosSection } from './RedosSection';
import { SubdomainTakeoverSection } from './SubdomainTakeoverSection';
import { BgpRrSection } from './BgpRrSection';
import { RouteFlapSection } from './RouteFlapSection';
import './style.css';

const registry = new ProtocolRegistry();
registerCoreProtocols(registry);

type Section = 'network' | 'crypto' | 'classical' | 'otpad' | 'aesround' | 'aead' | 'chacha' | 'hashint' | 'rsa' | 'ecc' | 'ecdsa' | 'schnorr' | 'dhmitm' | 'bb84' | 'ecbpenguin' | 'lamport' | 'quorum' | 'lz77' | 'cors' | 'tcphand' | 'dnssec' | 'paxos' | 'webinject' | 'dhkex' | 'crc32' | 'snowflake' | 'pmtud' | 'countmin' | 'sack' | 'bully' | 'csp' | 'eddsa' | 'hll' | 'ttlhop' | 'bdp' | 'webauthn' | 'anycast' | 'mailauth' | 'consistency' | 'reedsolomon' | 'cubic' | 'wpa' | 'bbr' | 'btree' | 'lsm' | 'mvcc' | 'wal' | 'skiplist' | 'pedersen' | 'locking' | 'trie' | 'pbft' | 'lzw' | 'hlc' | 'cuckoo' | 'geohash' | 'chord' | 'unionfind' | 'fenwick' | 'kmp' | 'rabinkarp' | 'hashtable' | 'editdist' | 'toposort' | 'astar' | 'heap' | 'sorting' | 'majority' | 'segtree' | 'avl' | 'reservoir' | 'dfa' | 'fencing' | 'hashchain' | 'happyeyeballs' | 'nagle' | 'chandy' | 'viterbi' | 'sctp' | 'pagereplace' | 'retry' | 'smuggle' | 'phiaccrual' | 'consttime' | 'conditional' | 'siteisolation' | 'vxlan' | 'sri' | 'antientropy' | 'vrrp' | 'truetime' | 'ecn' | 'dot1x' | 'ipsec' | 'causalbcast' | 'ecmp' | 'realtime' | 'x3dh' | 'tfo' | 'threshsig' | 'raftlog' | 'tlsdowngrade' | 'pwhash' | 'pqc' | 'shamir' | 'pow' | 'kerberos' | 'revocation' | 'ssh' | 'feistel' | 'poly1305' | 'hashbreak' | 'ratchet' | 'encoding' | 'huffman' | 'errors' | 'identity' | 'attacks' | 'routing' | 'dns' | 'subnet' | 'bgp' | 'congestion' | 'http2' | 'quic' | 'nat' | 'flow' | 'bufferbloat' | 'cookies' | 'certs' | 'traceroute' | 'dhcp' | 'switch' | 'stptree' | 'slaac' | 'linecode' | 'ratelimit' | 'chash' | 'lb' | 'bloom' | 'cdn' | 'qos' | 'merkle' | 'vclock' | 'crdt' | 'gossip' | 'raft' | 'cap' | 'replication' | 'twopc' | 'fragment' | 'bgphijack' | 'mpls' | 'natpunch' | 'ipcompare' | 'icmp' | 'arp' | 'csma' | 'multicast' | 'vlan' | 'ntp' | 'arq' | 'rto' | 'queueing' | 'distvec' | 'mdns' | 'encdns' | 'http3' | 'grpc' | 'websocket' | 'cpusched' | 'pagewalk' | 'mesi' | 'joins' | 'h2flow' | 'tso' | 'ospf' | 'maxflow' | 'ntt' | 'bwt' | 'taillatency' | 'mst' | 'cfs' | 'pipeline' | 'scc' | 'queryplan' | 'rum' | 'arith' | 'swim' | 'ahocorasick' | 'floyd' | 'leakybucket' | 'knapsack' | 'deployments' | 'healthcheck' | 'autoscale' | 'slo' | 'tracing' | 'featureflags' | 'gracefulshutdown' | 'idempotency' | 'loadshed' | 'chaos' | 'singleflight' | 'branchpredict' | 'boyermoore' | 'newton' | 'cow' | 'mtf' | 'tlb' | 'suffixarray' | 'fft' | 'ssrf' | 'saga' | 'blindsig' | 'clickjack' | 'bgprr' | 'vrf' | 'hsts' | 'numa' | 'ot' | 'bellmanford' | 'cdc' | 'watermark' | 'openredirect' | 'paillier' | 'manacher' | 'epoll' | 'varint' | 'hintedhandoff' | 'futex' | 'quicmig' | 'quickselect' | 'feldman' | 'chainrep' | 'iouring' | 'golombrice' | 'hashflood' | 'hdrhist' | 'aliasmethod' | 'bakery' | 'zerortt' | 'redos' | 'splaytree' | 'kaminsky' | 'threepc' | 'kdtree' | 'subdomain' | 'zalgo' | 'rcu' | 'lenext' | 'roaring' | 'priorityinv' | 'leases' | 'timewait' | 'paddingoracle' | 'bulkhead' | 'hamt' | 'shuffle' | 'optransform' | 'spectre' | 'jumphash' | 'cycledetect' | 'gorilla' | 'protopollute' | 'mptcp' | 'envelope' | 'falseshare' | 'intervaltree' | 'treap' | 'kadane' | 'readrepair' | 'dnsrebind' | 'cobs' | 'piecetable' | 'rendezvous' | 'buddyalloc' | 'timingwheel' | 'usl' | 'segrouting' | 'eliascode' | 'arpspoof' | 'sparsetable' | 'elgamal' | 'dnf' | 'sws' | 'ddsketch' | 'lamportsig' | 'minhash' | 'pid' | 'xxe' | 'aba' | 'bitmapindex' | 'rsync' | 'kademlia' | 'inode' | 'medianofmedians' | 'robinhood' | 'hmac' | 'routeflap' | 'seqlock' | 'cartesian' | 'jwt' | 'pairingheap' | 'base58' | 'lis' | 'gcra' | 'dram' | 'adder' | 'latch' | 'alu' | 'membus' | 'io' | 'ssd' | 'transistor' | 'gpu' | 'cpucache' | 'oooexec' | 'rope' | 'gapbuffer' | 'fastinvsqrt' | 'kahan' | 'karatsuba' | 'simanneal' | 'hamming' | 'bresenham' | 'convexhull' | 'marchsquares' | 'voronoi' | 'overview';

type View = 'story' | 'anatomy' | 'journey' | 'state' | 'checksum';
const TABS: { id: View; label: string }[] = [
  { id: 'story', label: 'Packet story' },
  { id: 'anatomy', label: 'Byte anatomy' },
  { id: 'journey', label: 'Journey' },
  { id: 'state', label: 'Connection lifecycle' },
  { id: 'checksum', label: 'Checksum' },
];

function App() {
  const [section, setSection] = useState<Section>('overview'); // land on the map (journeys + filterable catalog), not a single section
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [navQuery, setNavQuery] = useState('');
  const [journeyId, setJourneyId] = useState<string | null>(null);
  const [dark, setDark] = useState<boolean>(() => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches);

  useEffect(() => { initAnalytics(); }, []);                 // load configured provider beacons once
  // per-section pageview + dwell time (how long each section is read); flush on tab hide / unload
  const dwellRef = useRef<{ id: string; at: number } | null>(null);
  useEffect(() => {
    const prev = dwellRef.current;
    if (prev) trackDwell(prev.id, (Date.now() - prev.at) / 1000);
    dwellRef.current = { id: section, at: Date.now() };
    trackSection(section);
  }, [section]);
  useEffect(() => {
    const flush = () => { const c = dwellRef.current; if (c && document.visibilityState === 'hidden') { trackDwell(c.id, (Date.now() - c.at) / 1000); c.at = Date.now(); } };
    document.addEventListener('visibilitychange', flush);
    window.addEventListener('pagehide', flush);
    return () => { document.removeEventListener('visibilitychange', flush); window.removeEventListener('pagehide', flush); };
  }, []);
  // coarse "did the user interact with this section" signal (deduped to one event per section, no per-click spam)
  const secRef = useRef(section); secRef.current = section;
  useEffect(() => {
    const onInteract = () => trackInteraction(secRef.current);
    const main = document.querySelector('main');
    main?.addEventListener('click', onInteract);
    main?.addEventListener('input', onInteract);
    return () => { main?.removeEventListener('click', onInteract); main?.removeEventListener('input', onInteract); };
  }, []);
  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; }, [dark]);
  const activeGroup = groupOf(section);
  const activePath = journeyId ? pathById[journeyId] ?? null : null;

  // Start a guided journey: remember it and jump to its first stop. The bar's position then
  // derives from `section`, so ordinary nav/search clicks keep it in sync with zero extra state.
  const startPath = (pathId: string) => {
    const p = pathById[pathId];
    if (!p) return;
    setJourneyId(pathId);
    setSection(p.steps[0].id as Section);
    setOpenMenu(null);
    setNavQuery('');
  };

  // flat, searchable index of every section (label + group, for the search box)
  const allSections = useMemo(
    () => GROUPS.flatMap((g) => g.ids.map((id) => ({ id, label: metaById[id].label, icon: metaById[id].icon, group: g.label }))),
    [],
  );
  const navMatches = useMemo(() => {
    const q = navQuery.trim().toLowerCase();
    if (!q) return [];
    return allSections.filter((s) => s.label.toLowerCase().includes(q) || s.group.toLowerCase().includes(q)).slice(0, 10);
  }, [navQuery, allSections]);
  const gotoSection = (id: string) => { setSection(id as Section); setNavQuery(''); setOpenMenu(null); };
  const [input, setInput] = useState('Hi');
  const [mode, setMode] = useState<Mode>('text');
  const [view, setView] = useState<View>('story');
  const [exampleId, setExampleId] = useState<string | null>(null);
  const [pcap, setPcap] = useState<Pcap | null>(null);
  const [pcapIdx, setPcapIdx] = useState(0);
  const [pcapError, setPcapError] = useState<string | null>(null);
  const [form, setForm] = useState<ConnForm>(DEFAULT_FORM);

  const { bytes: payload, error } = useMemo(() => encodePayload(input, mode), [input, mode]);
  const { conn, errors: connErrors } = useMemo(() => buildConnection(form), [form]);

  const builtIn = exampleId ? EXAMPLES.find((e) => e.id === exampleId) ?? null : null;
  const pcapPkt = pcap
    ? {
        id: `pcap-${pcapIdx}`,
        label: `pcap packet #${pcapIdx + 1}`,
        startId: pcap.startId,
        bytes: pcap.packets[pcapIdx].bytes,
        note: `Captured frame ${pcapIdx + 1} of ${pcap.packets.length} (${pcap.packets[pcapIdx].bytes.length} bytes on the wire).`,
      }
    : null;
  const capture = pcapPkt ?? builtIn;

  const textTree = useMemo(() => {
    const safe = payload.length ? payload : [0];
    return dissect(buildFrame(safe, registry, conn).bytes, 'ethernet', registry);
  }, [payload, conn]);
  const activeTree = useMemo(
    () => (capture ? dissect(capture.bytes, capture.startId, registry) : textTree),
    [capture, textTree],
  );
  const anatomyModel = useMemo(() => buildByteModel(activeTree), [activeTree]);
  const journey = useMemo(
    () => (capture ? journeyFromTree(activeTree) : buildJourney(payload, registry, conn)),
    [capture, activeTree, payload, conn],
  );
  const stateful = useMemo(() => findStateful(activeTree), [activeTree]);
  const ckTarget = useMemo(() => findHeaderChecksum(activeTree), [activeTree]);

  const pickExample = (id: string | null) => {
    setExampleId(id);
    if (id) { setPcap(null); setPcapError(null); setView('story'); }
  };
  const clearCapture = () => { setExampleId(null); setPcap(null); setPcapError(null); };
  const loadPcap = async (file: File | undefined) => {
    if (!file) return;
    try {
      const pc = parseCapture(await file.arrayBuffer());
      setPcap(pc); setPcapIdx(0); setExampleId(null); setPcapError(null); setView('anatomy');
    } catch (e) {
      setPcap(null); setPcapError(e instanceof Error ? e.message : String(e));
    }
  };

  const payloadHex = payload.map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');

  return (
    <div className={`app ${activePath ? 'has-jbar' : ''}`}>
      <header className="topbar">
        <div className="topbar-inner">
          <button type="button" className={`brand ${section === 'overview' ? 'home' : ''}`} onClick={() => setSection('overview')} title="Home / all sections"><span className="logo">◆</span> Apex</button>
          <button type="button" className="mobile-browse" onClick={() => setSection('overview')} aria-label="Browse all sections">☰ Browse</button>
          <nav className="topnav" aria-label="Section groups">
            {GROUPS.map((g) => {
              const isOpen = openMenu === g.label;
              const isActive = g.label === activeGroup;
              // Compact single-word tab labels keep all six on one line and stop
              // the wrap. Keyed on the full g.label so the state model
              // (openMenu / activeGroup / groupOf) is untouched; the full name
              // lives on as the title tooltip + the dropdown heading.
              const SHORT: Record<string, string> = {
                'Network basics': 'Network',
                'Routing & naming': 'Routing',
                'Transport & web': 'Transport',
                'Cryptography': 'Crypto',
                'Security & web': 'Security',
                'Data & encoding': 'Data',
                'Distributed systems': 'Systems',
                'Storage & databases': 'Storage',
                'Systems & OS': 'OS',
                'Operations & SRE': 'Ops',
              };
              const short = SHORT[g.label] ?? g.label.split(' ')[0];
              return (
                <div className="topgroup" key={g.label}>
                  <button
                    type="button"
                    className={`topgroup-h ${isActive ? 'active' : ''} ${isOpen ? 'open' : ''}`}
                    onClick={() => setOpenMenu(isOpen ? null : g.label)}
                    aria-expanded={isOpen}
                    aria-haspopup="menu"
                    title={g.label}
                  >
                    <span className="tg-icon" aria-hidden="true">{g.icon}</span>
                    <span className="tg-label" data-label={short}>{short}</span>
                    <span className="tg-caret" aria-hidden="true">{isOpen ? '▴' : '▾'}</span>
                  </button>
                  {isOpen && (
                    <div className="topmenu" role="menu" aria-label={g.label}>
                      <div className="topmenu-head"><span className="tg-icon" aria-hidden="true">{g.icon}</span>{g.label}</div>
                      {g.ids.map((id) => {
                        const m = metaById[id];
                        return (
                          <button
                            key={id}
                            type="button"
                            role="menuitem"
                            className={section === id ? 'on' : ''}
                            onClick={() => { setSection(id as Section); setOpenMenu(null); }}
                          >
                            <span className="sec-icon" aria-hidden="true">{m.icon}</span> {m.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
          <div className="navsearch">
            <input
              type="search"
              className="navsearch-input"
              placeholder="🔎 Search sections…"
              value={navQuery}
              onChange={(e) => setNavQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && navMatches[0]) gotoSection(navMatches[0].id); if (e.key === 'Escape') setNavQuery(''); }}
              aria-label="Search sections"
            />
            {navMatches.length > 0 && (
              <div className="navsearch-results" role="listbox">
                {navMatches.map((s) => (
                  <button key={s.id} type="button" role="option" className={section === s.id ? 'on' : ''} onClick={() => gotoSection(s.id)}>
                    <span className="sec-icon" aria-hidden="true">{s.icon}</span>
                    <span className="navsearch-lbl">{s.label}</span>
                    <span className="navsearch-grp">{s.group}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="topbar-actions">
            <a className="topbar-ghlink" href="https://github.com/pen-pal/apex" target="_blank" rel="noopener noreferrer" title="Source on GitHub" aria-label="Source on GitHub">
              <svg viewBox="0 0 16 16" width="17" height="17" aria-hidden="true" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 012-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
            </a>
            <button type="button" className="topbar-toggle" onClick={() => setDark((d) => !d)} title={dark ? 'Switch to light mode' : 'Switch to dark mode'} aria-label="Toggle dark mode">{dark ? '☀' : '☾'}</button>
          </div>
        </div>
      </header>
      {openMenu && <div className="topnav-backdrop" onClick={() => setOpenMenu(null)} />}
      {navQuery && <div className="topnav-backdrop" onClick={() => setNavQuery('')} />}

      <main className="content">
        {section === 'overview' && (
          <OverviewSection onPick={(id) => setSection(id as Section)} onStartPath={startPath} current={section} />
        )}

        {section === 'network' && (
          <>
            <header>
              <h1>Network</h1>
              <p className="sub">
                Type a message — it becomes a real Ethernet/IPv4/TCP frame with real checksums — or load one of
                90+ protocols and follow it across the stack, byte by byte.
              </p>
            </header>

            <div className="controls">
              <div className="mode">
                <button className={mode === 'text' ? 'on' : ''} onClick={() => setMode('text')}>Text</button>
                <button className={mode === 'number' ? 'on' : ''} onClick={() => setMode('number')}>Number</button>
              </div>
              <input className="msg" value={input} onChange={(e) => setInput(e.target.value)}
                placeholder={mode === 'text' ? 'Type a message…' : 'Type an integer, e.g. 443 or -200'} spellCheck={false} />
              <div className="payload-readout">
                {error ? <span className="err">{error}</span> : (
                  <>
                    <span className="k">payload</span>
                    <code>{payloadHex || '—'}</code>
                    <span className="cnt">{payload.length} byte{payload.length === 1 ? '' : 's'}</span>
                  </>
                )}
              </div>
              <select className="examples" value={exampleId ?? ''} onChange={(e) => pickExample(e.target.value || null)}>
                <option value="">Examples: real captures…</option>
                {EXAMPLES.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
              </select>
              <label className="pcap-load">
                ↥ Load .pcap / .pcapng
                <input type="file" accept=".pcap,.pcapng,.cap,application/vnd.tcpdump.pcap" onChange={(e) => loadPcap(e.target.files?.[0])} />
              </label>
            </div>

            {pcapError && <p className="pcap-error">⚠ {pcapError}</p>}
            {pcap && (
              <div className="pcap-strip">
                <span className="pcap-strip-label">{pcap.packets.length} packets · link type {pcap.linkType}</span>
                <div className="pcap-packets">
                  {pcap.packets.slice(0, 200).map((p) => (
                    <button key={p.index} className={p.index === pcapIdx ? 'on' : ''}
                      onClick={() => { setPcapIdx(p.index); setView('anatomy'); }}>
                      #{p.index + 1} · {p.bytes.length}B
                    </button>
                  ))}
                  {pcap.packets.length > 200 && <span className="pcap-more">+{pcap.packets.length - 200} more</span>}
                </div>
              </div>
            )}

            {!capture && (
              <details className="advanced">
                <summary>Advanced — edit the connection (rebuilds the frame live)</summary>
                <div className="adv-grid">
                  {([['srcIp', 'Source IP'], ['dstIp', 'Dest IP'], ['srcPort', 'Source port'], ['dstPort', 'Dest port'], ['ttl', 'TTL'], ['window', 'Window']] as [keyof ConnForm, string][]).map(([key, label]) => (
                    <label key={key} className="adv-field">
                      <span>{label}</span>
                      <input className={connErrors[key] ? 'bad' : ''} value={form[key] as string}
                        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} spellCheck={false} />
                      {connErrors[key] && <em className="adv-err">{connErrors[key]}</em>}
                    </label>
                  ))}
                  <div className="adv-flags">
                    <span>TCP flags</span>
                    <div className="adv-flagrow">
                      {(['SYN', 'ACK', 'PSH', 'RST', 'FIN'] as (keyof FlagSet)[]).map((fl) => (
                        <label key={fl}>
                          <input type="checkbox" checked={form.flags[fl]}
                            onChange={() => setForm((f) => ({ ...f, flags: { ...f.flags, [fl]: !f.flags[fl] } }))} />
                          {fl}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </details>
            )}

            <nav className="viewtabs">
              {TABS.map((t) => (
                <button key={t.id} className={view === t.id ? 'on' : ''} onClick={() => setView(t.id)}>{t.label}</button>
              ))}
            </nav>

            {view === 'story' && (
              <StoryView tree={activeTree} model={anatomyModel} journey={journey} built={!capture}
                caption={capture ? `${capture.label} — ${capture.note}` : undefined} />
            )}
            {view === 'anatomy' && (
              <>
                {capture ? (
                  <div className="example-banner">
                    <span><strong>{capture.label}</strong> — {capture.note}</span>
                    <button className="ghost" onClick={clearCapture}>✕ back to your message</button>
                  </div>
                ) : (
                  <p className="insight">
                    {mode === 'number'
                      ? `As a number, "${input.trim() || '…'}" is packed big-endian into ${payload.length} byte${payload.length === 1 ? '' : 's'}${input.trim().startsWith('-') ? ' as two’s complement' : ''} — switch to Text to see the same characters become their ASCII codes instead.`
                      : `As text, each character becomes its byte value (e.g. "443" → 34 34 33). Switch to Number to see 443 packed as 01 BB.`}
                  </p>
                )}
                <ByteView model={anatomyModel} />
              </>
            )}
            {view === 'journey' && <JourneyView journey={journey} message={!capture && mode === 'text' ? input : journey.recovered} />}
            {view === 'state' && (
              stateful ? (
                <LifecycleView machine={stateful.machine} conversation={stateful.conversation} payloadLength={payload.length || 1} name={stateful.name} />
              ) : (
                <div className="journey">
                  <section className="jsec">
                    <h2>State machine</h2>
                    <p className="jsec-sub">
                      <strong>{activeTree.header.spec.name}</strong> is connectionless — there is no handshake or
                      connection state machine to walk. (TCP, shown for the default text frame, is the
                      connection-oriented contrast: it declares an 11-state machine and a 3-way handshake.)
                    </p>
                  </section>
                </div>
              )
            )}
            {view === 'checksum' && <ChecksumView target={ckTarget} />}
          </>
        )}

        {section === 'crypto' && (
          <>
            <header>
              <h1>Cryptography</h1>
              <p className="sub">Real cryptography on sandbox values — never on captured streams. Watch structure become noise.</p>
            </header>
            <CryptoView />
          </>
        )}

        {section === 'classical' && (
          <>
            <header>
              <h1>Classical ciphers</h1>
              <p className="sub">Caesar and Vigenère — and how frequency analysis breaks them from the ciphertext alone, the failure that motivated modern ciphers designed to look like noise.</p>
            </header>
            <ClassicalSection />
          </>
        )}

        {section === 'otpad' && (
          <>
            <header>
              <h1>One-time pad</h1>
              <p className="sub">The only cipher with proven perfect secrecy — XOR with a random pad reveals nothing, but reuse it once and it shatters.</p>
            </header>
            <OneTimePadSection />
          </>
        )}

        {section === 'aesround' && (
          <>
            <header>
              <h1>AES internals</h1>
              <p className="sub">Step inside the block cipher — watch 10 rounds of SubBytes, ShiftRows, MixColumns and AddRoundKey transform the 4×4 state.</p>
            </header>
            <AesRoundSection onOpen={(id) => setSection(id as Section)} />
          </>
        )}

        {section === 'aead' && (
          <>
            <header>
              <h1>CTR, nonce reuse &amp; AEAD</h1>
              <p className="sub">Turn the block cipher into a stream cipher, watch a reused nonce leak two messages, then add a GHASH tag that catches tampering — all on real, NIST-verified bytes.</p>
            </header>
            <AeadSection />
          </>
        )}

        {section === 'rsa' && (
          <>
            <header>
              <h1>RSA</h1>
              <p className="sub">Pick two primes and watch the public/private keypair fall out — then encrypt the public way, decrypt the private way, sign, verify, and see the whole secret rest on factoring being hard.</p>
            </header>
            <RsaSection />
          </>
        )}

        {section === 'ecc' && (
          <>
            <header>
              <h1>Elliptic curves &amp; ECDH</h1>
              <p className="sub">The whole finite group on one grid: walk kG to feel the discrete-log trapdoor, watch point addition add indices, and run ECDH to a shared secret.</p>
            </header>
            <EccSection />
          </>
        )}

        {section === 'ecdsa' && (
          <>
            <header>
              <h1>ECDSA &amp; nonce reuse</h1>
              <p className="sub">Sign with the private scalar, verify with the public point — then watch a reused nonce hand an attacker the private key, the real PS3 / Bitcoin bug.</p>
            </header>
            <EcdsaSection />
          </>
        )}

        {section === 'schnorr' && (
          <>
            <header>
              <h1>Zero-knowledge proof (Schnorr)</h1>
              <p className="sub">Prove you know a secret without revealing it — the three-move commit/challenge/response, and why the challenge must come after the commitment.</p>
            </header>
            <SchnorrSection />
          </>
        )}

        {section === 'chacha' && (
          <>
            <header>
              <h1>ChaCha20</h1>
              <p className="sub">A 4×4 matrix of words stirred by add–rotate–xor — step through the rounds, build the keystream, and XOR it over a message. No S-boxes, fast in software.</p>
            </header>
            <ChachaSection />
          </>
        )}

        {section === 'hashint' && (
          <>
            <header>
              <h1>SHA-256 internals</h1>
              <p className="sub">Pad and block a message, watch the Merkle–Damgård chain fold each block into the 256-bit state, step the 64 compression rounds — and see why the digest <em>is</em> the state, the root of length extension.</p>
            </header>
            <HashInternalsSection onOpen={(id) => setSection(id as Section)} />
          </>
        )}

        {section === 'pqc' && (
          <>
            <header>
              <h1>Post-quantum (LWE)</h1>
              <p className="sub">Hide a secret in noise (Learning With Errors), encrypt a bit by burying it near 0 or q/2, and watch rounding recover it — the lattice kernel inside ML-KEM (Kyber).</p>
            </header>
            <LweSection />
          </>
        )}

        {section === 'bb84' && (
          <>
            <header>
              <h1>Quantum key distribution (BB84)</h1>
              <p className="sub">Agree on a key secured by physics — send qubits in random bases, sift the matches, and watch an eavesdropper's measurements inject detectable errors.</p>
            </header>
            <BB84Section />
          </>
        )}

        {section === 'stptree' && (
          <>
            <header>
              <h1>Spanning Tree Protocol</h1>
              <p className="sub">Redundant links keep a LAN alive but create loops that flood broadcasts forever. Watch STP elect a root bridge and block exactly the right ports to leave a single loop-free tree.</p>
            </header>
            <StpSection />
          </>
        )}

        {section === 'slaac' && (
          <>
            <header>
              <h1>IPv6 SLAAC &amp; address types</h1>
              <p className="sub">No DHCP needed — watch a host turn its MAC into an interface identifier (EUI-64), mint its own link-local and global addresses, and classify any IPv6 address by its leading bits.</p>
            </header>
            <SlaacSection />
          </>
        )}

        {section === 'linecode' && (
          <>
            <header>
              <h1>Line coding</h1>
              <p className="sub">A 1 and a 0 must become real voltage on the wire — see the same bits drawn as NRZ-L, NRZI, Manchester, Differential Manchester, and AMI, and why some keep their own clock and some don't.</p>
            </header>
            <LineCodingSection />
          </>
        )}

        {section === 'ecbpenguin' && (
          <>
            <header>
              <h1>Block-cipher modes &amp; the ECB penguin</h1>
              <p className="sub">Same key, same AES — three modes. Watch a padlock image survive ECB encryption intact while CBC and CTR turn it to noise, the classic proof that &ldquo;encrypted&rdquo; isn&rsquo;t automatically &ldquo;hidden.&rdquo;</p>
            </header>
            <EcbPenguinSection />
          </>
        )}

        {section === 'lamport' && (
          <>
            <header>
              <h1>Lamport logical clocks</h1>
              <p className="sub">With no shared clock, how do distributed machines agree on order? Watch counters tick and messages bump them, building a causal order from one simple rule — and see exactly where it falls short.</p>
            </header>
            <LamportSection />
          </>
        )}

        {section === 'quorum' && (
          <>
            <header>
              <h1>Tunable quorum consistency</h1>
              <p className="sub">One inequality — R + W &gt; N — decides whether a distributed read can ever return stale data. Slide the read and write quorums and watch the overlap that guarantees consistency appear and disappear.</p>
            </header>
            <QuorumSection />
          </>
        )}

        {section === 'lz77' && (
          <>
            <header>
              <h1>LZ77 sliding-window compression</h1>
              <p className="sub">The dictionary half of gzip and PNG. Step through the encoder as it finds repeats in a sliding window and replaces them with compact (distance, length, next) tokens — then watch an independent decoder rebuild the original exactly.</p>
            </header>
            <Lz77Section />
          </>
        )}

        {section === 'cors' && (
          <>
            <header>
              <h1>CORS &amp; the Same-Origin Policy</h1>
              <p className="sub">Why can one site's JavaScript read another's data only with permission? Configure the page, the request, and the server's CORS headers, and watch the browser allow, preflight, or block the read.</p>
            </header>
            <CorsSection />
          </>
        )}

        {section === 'tcphand' && (
          <>
            <header>
              <h1>TCP handshake &amp; teardown</h1>
              <p className="sub">The most-drawn diagram in networking, made exact. Step through SYN / SYN-ACK / ACK and the four-way close while both endpoints walk the TCP state machine — with real, editable sequence numbers.</p>
            </header>
            <TcpHandshakeSection />
          </>
        )}

        {section === 'timewait' && (
          <>
            <header>
              <h1>TIME_WAIT &amp; ephemeral-port exhaustion</h1>
              <p className="sub">Why the side that closes a TCP connection can't reuse its port for ~60s — and how a client opening too many short-lived connections runs out of ephemeral ports. Drag the connect rate, TIME_WAIT duration, and port pool to watch exhaustion appear, then click a fix and watch it clear.</p>
            </header>
            <TimeWaitSection />
          </>
        )}

        {section === 'dnssec' && (
          <>
            <header>
              <h1>DNSSEC chain of trust</h1>
              <p className="sub">How DNS answers become trustworthy: a chain of signatures from the root anchor down to the record. Validate it, then corrupt a DS hash or an RRSIG and watch it turn bogus at exactly the broken link.</p>
            </header>
            <DnssecSection />
          </>
        )}

        {section === 'kaminsky' && (
          <>
            <header>
              <h1>DNS cache poisoning &amp; the Kaminsky attack</h1>
              <p className="sub">How an off-path attacker forges a DNS reply to hijack a domain in a resolver's cache. The resolver accepts the first valid-looking answer, so the attacker guesses the query ID (and source port) and floods forgeries — Kaminsky's random-name trick makes every guess a fresh race. Toggle the defenses and watch the time to poison jump from a fraction of a second to infeasible.</p>
            </header>
            <KaminskySection />
          </>
        )}

        {section === 'paxos' && (
          <>
            <header>
              <h1>Paxos consensus</h1>
              <p className="sub">How distributed nodes agree on one value despite competing proposers and failures. Step through Prepare/Promise/Accept/Accepted and watch the safety rule that makes a chosen value impossible to override.</p>
            </header>
            <PaxosSection />
          </>
        )}

        {section === 'webinject' && (
          <>
            <header>
              <h1>Injection — SQLi &amp; XSS</h1>
              <p className="sub">The most common web vulnerability class, made concrete: see the same payload pop a query built by string concatenation and a page built by raw HTML, then go inert against parameterization and escaping.</p>
            </header>
            <WebInjectSection />
          </>
        )}

        {section === 'dhkex' && (
          <>
            <header>
              <h1>Diffie–Hellman key agreement</h1>
              <p className="sub">Two strangers agree on a shared secret over a fully public channel while an eavesdropper watches every byte. The keystone behind TLS, SSH, WireGuard, and the Signal ratchet.</p>
            </header>
            <DhKexSection />
          </>
        )}

        {section === 'crc32' && (
          <>
            <header>
              <h1>CRC-32 shift-register walk</h1>
              <p className="sub">The checksum on every Ethernet frame, gzip stream, and PNG — watch the 32-bit register fold in each byte, expand the bit-level shifts, and flip one bit to see the whole checksum change.</p>
            </header>
            <CrcWalkSection />
          </>
        )}

        {section === 'snowflake' && (
          <>
            <header>
              <h1>Snowflake IDs</h1>
              <p className="sub">How a thousand servers mint unique, time-sortable 64-bit IDs without ever coordinating. Watch the four bit-fields and generate a burst to see the per-millisecond sequence climb.</p>
            </header>
            <SnowflakeSection />
          </>
        )}

        {section === 'pmtud' && (
          <>
            <header>
              <h1>Path MTU Discovery</h1>
              <p className="sub">A packet can only be as big as the narrowest link it crosses. Watch a Don't-Fragment packet shrink to fit via ICMP feedback — and black-hole when a firewall eats those ICMPs.</p>
            </header>
            <PmtudSection />
          </>
        )}

        {section === 'countmin' && (
          <>
            <header>
              <h1>Count-Min Sketch</h1>
              <p className="sub">Count how often each item appears in a massive stream using a tiny fixed grid, by accepting a one-sided error. Add items, watch the hashed cells climb, and compare the min-estimate against the truth.</p>
            </header>
            <CountMinSection />
          </>
        )}

        {section === 'minhash' && (
          <>
            <header>
              <h1>MinHash — set similarity by sketch</h1>
              <p className="sub">Estimate how similar two sets are (their Jaccard similarity) from tiny fixed-size signatures — the engine behind web-scale near-duplicate detection. Each signature slot is the minimum of one hash over the set, and two slots match with probability exactly equal to the Jaccard similarity, so the fraction of matching slots estimates it. Edit two documents and drag the signature size to watch the estimate converge on the truth.</p>
            </header>
            <MinHashSection />
          </>
        )}

        {section === 'sack' && (
          <>
            <header>
              <h1>TCP Selective ACK (SACK)</h1>
              <p className="sub">When a segment is lost but later ones arrive, how does the sender know what to resend? Drop segments on the wire and compare SACK (resend only the holes) with go-back-N (resend everything after the gap).</p>
            </header>
            <SackSection />
          </>
        )}

        {section === 'bully' && (
          <>
            <header>
              <h1>Leader election (Bully algorithm)</h1>
              <p className="sub">When the coordinator dies, who takes over — and how does everyone agree? Kill nodes, pick who starts the election, and step through the ELECTION/OK/COORDINATOR messages as the highest survivor bullies its way to the crown.</p>
            </header>
            <BullySection />
          </>
        )}

        {section === 'csp' && (
          <>
            <header>
              <h1>Content-Security-Policy</h1>
              <p className="sub">The defense-in-depth behind output-escaping: a policy telling the browser which scripts, styles, and images may load. Edit it and watch inline scripts, eval, and cross-origin loads get allowed or blocked.</p>
            </header>
            <CspSection />
          </>
        )}

        {section === 'eddsa' && (
          <>
            <header>
              <h1>EdDSA (Ed25519)</h1>
              <p className="sub">A Schnorr-style signature whose nonce is derived deterministically from the secret and message — removing the random-nonce footgun that catastrophically breaks ECDSA when reused.</p>
            </header>
            <EdDsaSection />
          </>
        )}

        {section === 'hll' && (
          <>
            <header>
              <h1>HyperLogLog</h1>
              <p className="sub">Estimate how many distinct items a massive stream contains using a few hundred bytes. Add items and batches and watch the registers fill while the cardinality estimate tracks the truth — duplicates cost nothing.</p>
            </header>
            <HllSection />
          </>
        )}

        {section === 'ttlhop' && (
          <>
            <header>
              <h1>TTL &amp; header-checksum recompute</h1>
              <p className="sub">The two things every router does to every packet. Watch the TTL count down hop by hop and the real IPv4 header checksum recompute — until the packet expires and an ICMP Time Exceeded heads home.</p>
            </header>
            <TtlHopSection />
          </>
        )}

        {section === 'bdp' && (
          <>
            <header>
              <h1>Bandwidth-Delay Product</h1>
              <p className="sub">Why a fast link can still feel slow. Slide bandwidth, RTT, and window size and watch how much of the pipe your window can actually fill — and why window scaling was essential for long fat networks.</p>
            </header>
            <BdpSection />
          </>
        )}

        {section === 'webauthn' && (
          <>
            <header>
              <h1>Passkeys (WebAuthn / FIDO2)</h1>
              <p className="sub">Passwordless login by public-key signature. Register a passkey, then watch a login succeed on the real site and fail on a phishing clone — because the device signs the origin it's actually visiting.</p>
            </header>
            <WebAuthnSection />
          </>
        )}

        {section === 'anycast' && (
          <>
            <header>
              <h1>IP Anycast</h1>
              <p className="sub">One IP address advertised from many locations — each client is routed to the nearest instance. Withdraw a site and watch its traffic re-route instantly. How root DNS, 1.1.1.1, and CDNs work.</p>
            </header>
            <AnycastSection />
          </>
        )}

        {section === 'mailauth' && (
          <>
            <header>
              <h1>Email authentication (SPF · DKIM · DMARC)</h1>
              <p className="sub">Anyone can forge a From: address — these three DNS records make the claim checkable. Pick a scenario (genuine, spoofed, tampered, forwarded) and watch SPF, DKIM, and DMARC adjudicate it.</p>
            </header>
            <MailAuthSection />
          </>
        )}

        {section === 'consistency' && (
          <>
            <header>
              <h1>Consistency models</h1>
              <p className="sub">When clients share one value, which sets of read results are legal? Pick a history and watch a real checker search for a valid order to decide if it's linearizable, only sequentially consistent, or neither.</p>
            </header>
            <ConsistencySection />
          </>
        )}

        {section === 'reedsolomon' && (
          <>
            <header>
              <h1>Reed-Solomon erasure coding</h1>
              <p className="sub">The error correction behind scratched CDs, torn QR codes, and RAID-6. Encode a message with redundant symbols, scratch some off, and watch the data reconstruct itself from the survivors — using real GF(256) arithmetic.</p>
            </header>
            <ReedSolomonSection />
          </>
        )}

        {section === 'cubic' && (
          <>
            <header>
              <h1>TCP CUBIC</h1>
              <p className="sub">The congestion controller most of the internet runs by default. Watch its cubic window curve climb back toward the pre-loss window and probe beyond it — overlaid against Reno's slow linear sawtooth.</p>
            </header>
            <CubicSection />
          </>
        )}

        {section === 'wpa' && (
          <>
            <header>
              <h1>WPA2 4-way handshake</h1>
              <p className="sub">How your phone and the access point agree on a fresh encryption key from a shared Wi-Fi password — exchanging only nonces, never the key itself. Step through it and watch both sides derive the identical PTK.</p>
            </header>
            <WpaSection />
          </>
        )}

        {section === 'bbr' && (
          <>
            <header>
              <h1>TCP BBR</h1>
              <p className="sub">Congestion control that models the path instead of waiting for loss. Compare BBR and a loss-based flow on the same link — same throughput, but watch BBR keep the buffer empty while the other drowns in bufferbloat.</p>
            </header>
            <BbrSection />
          </>
        )}

        {section === 'btree' && (
          <>
            <header>
              <h1>B+tree index</h1>
              <p className="sub">The balanced, sorted structure behind every database index. Insert keys and watch nodes fill, split, and push separators up — keeping every leaf at the same depth so every lookup is O(log n).</p>
            </header>
            <BtreeSection />
          </>
        )}

        {section === 'lsm' && (
          <>
            <header>
              <h1>LSM-tree</h1>
              <p className="sub">The write-optimized engine behind RocksDB and Cassandra. Put keys into the memtable, watch it flush to immutable SSTables, see read amplification grow — then compact to merge them and drop tombstones.</p>
            </header>
            <LsmSection />
          </>
        )}

        {section === 'mvcc' && (
          <>
            <header>
              <h1>MVCC &amp; snapshot isolation</h1>
              <p className="sub">Why a SELECT never waits for an UPDATE. Step through two concurrent transactions and watch each write append a new row version while a long reader keeps seeing its own consistent snapshot.</p>
            </header>
            <MvccSection />
          </>
        )}

        {section === 'wal' && (
          <>
            <header>
              <h1>Write-Ahead Logging</h1>
              <p className="sub">How a database survives a crash mid-transaction. Drag the crash point and watch recovery REDO the transactions whose commit survived and UNDO the ones that didn't — always landing in a consistent state.</p>
            </header>
            <WalSection />
          </>
        )}

        {section === 'skiplist' && (
          <>
            <header>
              <h1>Skip list</h1>
              <p className="sub">O(log n) search from nothing but linked lists and coin flips — the structure inside Redis sorted sets and LSM memtables. Search a key and watch the path ride the express lanes and skip most nodes.</p>
            </header>
            <SkipListSection />
          </>
        )}

        {section === 'pedersen' && (
          <>
            <header>
              <h1>Pedersen commitments</h1>
              <p className="sub">Seal a value in an envelope that reveals nothing yet binds you to it — and that you can add to other sealed envelopes. The homomorphism behind confidential transactions and zero-knowledge proofs.</p>
            </header>
            <PedersenSection />
          </>
        )}

        {section === 'locking' && (
          <>
            <header>
              <h1>Locking &amp; deadlock</h1>
              <p className="sub">The lock-based path to concurrency correctness — and its hazard. Pick a scenario and watch shared/exclusive locks grant or block, the wait-for graph form, and a cycle light up as a deadlock.</p>
            </header>
            <LockingSection />
          </>
        )}

        {section === 'trie' && (
          <>
            <header>
              <h1>Trie (prefix tree)</h1>
              <p className="sub">A tree shaped like its keys: words sharing a prefix share a path. Type a prefix and watch the matching subtree light up and autocomplete fill — the same walk that powers IP longest-prefix routing.</p>
            </header>
            <TrieSection />
          </>
        )}

        {section === 'hamt' && (
          <>
            <header>
              <h1>HAMT — the persistent map</h1>
              <p className="sub">How immutable maps (Clojure, Scala, immutable.js) make "copies" cheap. A hash array mapped trie stores entries in sparse bitmap nodes; updating a key copies only the nodes on the path to it and shares every other subtree with the old version. Insert a key and watch which nodes are copied vs reused — both versions coexist, valid and unchanged.</p>
            </header>
            <HamtSection />
          </>
        )}

        {section === 'pbft' && (
          <>
            <header>
              <h1>PBFT — Byzantine fault tolerance</h1>
              <p className="sub">Consensus when nodes can lie, not just crash. Slide the replica count and the number of malicious nodes to see why tolerating f Byzantine faults needs n ≥ 3f+1 replicas and 2f+1 quorums.</p>
            </header>
            <PbftSection />
          </>
        )}

        {section === 'lzw' && (
          <>
            <header>
              <h1>LZW compression</h1>
              <p className="sub">The dictionary scheme behind GIF and TIFF. Step the encoder as it builds a dictionary on the fly and emits codes — a dictionary the decoder rebuilds identically from the codes alone, nothing shipped.</p>
            </header>
            <LzwSection />
          </>
        )}

        {section === 'hlc' && (
          <>
            <header>
              <h1>Hybrid Logical Clocks</h1>
              <p className="sub">Timestamps that stay close to real time yet still order causally-related events. Watch the HLC track the physical clock, absorb a backward jump, and get pulled forward by an incoming message.</p>
            </header>
            <HlcSection />
          </>
        )}

        {section === 'cuckoo' && (
          <>
            <header>
              <h1>Cuckoo hashing</h1>
              <p className="sub">A hash table with O(1) worst-case lookup — every key lives in one of just two slots. Insert keys and watch the cuckoo evictions chain, then delete one (something a Bloom filter can't do).</p>
            </header>
            <CuckooSection />
          </>
        )}

        {section === 'robinhood' && (
          <>
            <header>
              <h1>Robin Hood hashing</h1>
              <p className="sub">An open-addressing hash table that flattens the worst case with one rule: while probing to insert, if you meet an element closer to its home than you are to yours, evict it and take the slot, carrying it onward — robbing from the "rich" (low probe distance) to help the "poor." Probe distances equalize, so the max lookup cost stays tiny. Add keys and compare the probe-distance spread against plain linear probing.</p>
            </header>
            <RobinHoodSection />
          </>
        )}

        {section === 'geohash' && (
          <>
            <header>
              <h1>Geohashing</h1>
              <p className="sub">Turn a latitude/longitude into a short, sortable string where nearby points share a prefix. Watch the geohash grow as the bounding box shrinks, and compare two places to see proximity become a shared prefix.</p>
            </header>
            <GeohashSection />
          </>
        )}

        {section === 'kdtree' && (
          <>
            <header>
              <h1>k-d tree — nearest-neighbor search</h1>
              <p className="sub">A tree that indexes points in space so you find the nearest one without checking them all. It splits the plane recursively — vertical, then horizontal, alternating — giving each point a rectangle, and a query skips any rectangle on the far side of a split that's already too far. Click to move the query and watch how few points it actually checks.</p>
            </header>
            <KdTreeSection />
          </>
        )}

        {section === 'chord' && (
          <>
            <header>
              <h1>Chord DHT</h1>
              <p className="sub">How a peer-to-peer network finds which node owns a key in O(log n) hops. Pick a start node and a key and watch the lookup leap along finger-table shortcuts to the owner instead of crawling the ring.</p>
            </header>
            <ChordSection />
          </>
        )}

        {section === 'kademlia' && (
          <>
            <header>
              <h1>Kademlia DHT — the XOR metric</h1>
              <p className="sub">The distributed hash table behind BitTorrent, IPFS, and Ethereum node discovery. Its trick is measuring "distance" between IDs as their bitwise XOR — so two IDs are close exactly when they share a long binary prefix. Nodes keep k-buckets of contacts (many nearby, few far), and a lookup asks the closest peers it knows, then the closest they know, converging in O(log n) hops. Run a lookup and watch it fix another bit of the target's prefix each hop.</p>
            </header>
            <KademliaSection />
          </>
        )}

        {section === 'unionfind' && (
          <>
            <header>
              <h1>Union-Find (Disjoint Set Union)</h1>
              <p className="sub">Track groups and answer "are these two connected?" in near-constant time. Click elements to union their sets and watch the components merge — the engine behind Kruskal's MST and connectivity queries.</p>
            </header>
            <UnionFindSection />
          </>
        )}

        {section === 'fenwick' && (
          <>
            <header>
              <h1>Fenwick tree (Binary Indexed Tree)</h1>
              <p className="sub">Prefix sums and point updates both in O(log n) via one binary trick. Watch each tree node cover a block sized by its lowest set bit, and the query/update paths light up the ~log n nodes they touch.</p>
            </header>
            <FenwickSection />
          </>
        )}

        {section === 'sparsetable' && (
          <>
            <header>
              <h1>Sparse table — O(1) range minimum</h1>
              <p className="sub">Answer "what's the minimum in [l, r]?" in constant time for a static array, after an O(n log n) precompute. Because min is idempotent, any range is covered by two overlapping power-of-two blocks and the double-counted middle does no harm — so a query is one min of two lookups, no loop. Drag the range and watch the two blocks snap into place.</p>
            </header>
            <SparseTableSection />
          </>
        )}

        {section === 'cartesian' && (
          <>
            <header>
              <h1>Cartesian tree — where range-minimum is lowest-common-ancestor</h1>
              <p className="sub">A binary tree built from an array that is simultaneously a min-heap by value and a BST by index. Its defining trick: the minimum of any range a[i..j] is the lowest common ancestor of positions i and j — so range-minimum and LCA are the same problem, the equivalence that unlocks O(n)-build/O(1)-query RMQ. Drag a range and watch its minimum light up as the LCA.</p>
            </header>
            <CartesianSection />
          </>
        )}

        {section === 'roaring' && (
          <>
            <header>
              <h1>Roaring bitmaps — the compressed index</h1>
              <p className="sub">How databases store a set of millions of integer IDs compactly and intersect two of them at memory speed. The key space is split into chunks of 65536, and each chunk picks its own container — a sorted array when sparse, a flat 8 KB bitmap when dense. Add sparse and dense keys and watch the containers adapt, with a memory comparison to the naive options.</p>
            </header>
            <RoaringSection />
          </>
        )}

        {section === 'bitmapindex' && (
          <>
            <header>
              <h1>Bitmap index</h1>
              <p className="sub">How data warehouses make "WHERE status = active AND country = US AND tier != free" fly. For each distinct value of a low-cardinality column, keep a bitmap — one bit per row, set where the row matches — so a WHERE clause becomes bitwise AND/OR/NOT across bitmaps, 64 rows per instruction, with no non-matching row ever touched. Click values to build a query and watch it evaluate in the bits.</p>
            </header>
            <BitmapIndexSection />
          </>
        )}

        {section === 'kmp' && (
          <>
            <header>
              <h1>KMP string matching</h1>
              <p className="sub">Find a pattern in text in O(n+m) without ever re-reading a character. Step through the search and watch the failure function slide the pattern on a mismatch while the text pointer only moves forward.</p>
            </header>
            <KmpSection />
          </>
        )}

        {section === 'rabinkarp' && (
          <>
            <header>
              <h1>Rabin-Karp</h1>
              <p className="sub">String search by hashing, with a rolling hash that updates in O(1) as the window slides. Step the window and watch hash hits trigger a character check — the same rolling hash behind rsync and dedup.</p>
            </header>
            <RabinKarpSection />
          </>
        )}

        {section === 'hashtable' && (
          <>
            <header>
              <h1>Hash table collisions</h1>
              <p className="sub">Two classic ways to handle keys that hash to the same slot. Insert the same keys into separate chaining and open addressing side by side, and watch collisions either chain or probe forward.</p>
            </header>
            <HashTableSection />
          </>
        )}

        {section === 'editdist' && (
          <>
            <header>
              <h1>Edit distance</h1>
              <p className="sub">The fewest inserts, deletes, and substitutions to turn one string into another. Watch the DP grid fill and the backtrace path reveal the actual alignment — the engine behind diff and spellcheck.</p>
            </header>
            <EditDistanceSection />
          </>
        )}

        {section === 'toposort' && (
          <>
            <header>
              <h1>Topological sort</h1>
              <p className="sub">Order a dependency graph so every arrow points forward. Step Kahn's algorithm as it picks ready nodes and frees the next ones — and add a cyclic dependency to watch it become unorderable.</p>
            </header>
            <TopoSortSection />
          </>
        )}

        {section === 'astar' && (
          <>
            <header>
              <h1>A* pathfinding</h1>
              <p className="sub">Shortest path on a grid, but pointed at the goal. Paint walls and compare A*'s heuristic-focused search against goal-blind BFS — both find the same shortest path, but A* touches far fewer cells.</p>
            </header>
            <AstarSection />
          </>
        )}

        {section === 'heap' && (
          <>
            <header>
              <h1>Binary heap</h1>
              <p className="sub">The priority queue behind Dijkstra, A*, Huffman, and heapsort. Push values and watch them sift up, pop the minimum and watch the replacement sink down — shown as both a tree and the flat array it really is.</p>
            </header>
            <HeapSection />
          </>
        )}

        {section === 'pairingheap' && (
          <>
            <header>
              <h1>Pairing heap — the practical mergeable heap</h1>
              <p className="sub">A heap that is trivial to implement yet fast enough for Dijkstra and Prim (it's in Boost). Unlike an array-based binary heap it merges two heaps in O(1) and supports cheap decrease-key. It's one multi-way tree built almost entirely from "meld"; the only real work is delete-min, which two-pass merges the root's orphaned children. Insert keys and delete the min to watch the tree meld and recombine.</p>
            </header>
            <PairingHeapSection />
          </>
        )}

        {section === 'sorting' && (
          <>
            <header>
              <h1>Sorting algorithms</h1>
              <p className="sub">The same array, five ways. Step or play through bubble, insertion, selection, merge, and quicksort on a bar chart, and compare their comparison/swap counts to feel the O(n²) vs O(n log n) gap.</p>
            </header>
            <SortingSection />
          </>
        )}

        {section === 'kadane' && (
          <>
            <header>
              <h1>Kadane's algorithm — maximum subarray</h1>
              <p className="sub">Find the contiguous run of numbers with the largest sum, in a single O(n) pass. Sweep left to right keeping the best sum ending at the current position; drop the prefix the moment starting fresh beats extending — a negative prefix never helps. Step through and watch the running total reset and the best window emerge.</p>
            </header>
            <KadaneSection />
          </>
        )}

        {section === 'lis' && (
          <>
            <header>
              <h1>Longest increasing subsequence — patience sorting</h1>
              <p className="sub">The longest run of values that rise left to right (not necessarily adjacent), found in O(n log n) with a card-game trick. Deal the numbers like solitaire: each lands on the leftmost pile whose top is at least it, or starts a new pile — and the number of piles equals the LIS length. Pick an array and watch the piles form and the subsequence light up.</p>
            </header>
            <LisSection />
          </>
        )}

        {section === 'quickselect' && (
          <>
            <header>
              <h1>Quickselect — the k-th smallest in O(n)</h1>
              <p className="sub">Find a median or a percentile without sorting. Quickselect partitions around a pivot that lands at its final sorted position, then keeps only the side containing k and repeats — discarding half each time for O(n) average. Pick which order statistic you want and step the partitions as the search window collapses onto the answer.</p>
            </header>
            <QuickselectSection />
          </>
        )}

        {section === 'medianofmedians' && (
          <>
            <header>
              <h1>Median of medians — worst-case linear selection</h1>
              <p className="sub">How to find the k-th smallest in guaranteed O(n), even in the worst case, by choosing a provably good pivot. Split into groups of 5, take each group's median, then recursively take the median of those medians — a pivot that can never land in the extreme tails, so every partition is balanced. Watch the groups, their medians, the pivot, and the guaranteed balance.</p>
            </header>
            <MomSection />
          </>
        )}

        {section === 'dnf' && (
          <>
            <header>
              <h1>Dutch national flag</h1>
              <p className="sub">Dijkstra's one-pass, in-place sort of an array of three values (red/white/blue) using three pointers that carve four regions. Look at the middle pointer: a 0 swaps down, a 2 swaps up, a 1 stays — and the unknown zone shrinks to nothing. It's the partition step of 3-way quicksort, which is what keeps quicksort fast on duplicate-heavy data. Step through and watch the regions form.</p>
            </header>
            <DnfSection />
          </>
        )}

        {section === 'shuffle' && (
          <>
            <header>
              <h1>Shuffle bias — Fisher–Yates vs the naive shuffle</h1>
              <p className="sub">The one-character bug that makes the popular "swap each index with any random index" shuffle provably biased — while the correct Fisher–Yates shuffle is perfectly uniform. Run thousands of shuffles and watch a bias pattern emerge in the naive heatmap while Fisher–Yates stays flat, with the exact counting argument for why.</p>
            </header>
            <FisherYatesSection />
          </>
        )}

        {section === 'aliasmethod' && (
          <>
            <header>
              <h1>The Alias method — O(1) weighted sampling</h1>
              <p className="sub">Draw from a weighted distribution in constant time. The setup chops the n weights into n equal columns, each holding at most two outcomes (a primary and an alias); a sample is then one die roll to pick a column and one coin flip to pick within it. Drag the weights and watch the columns rebalance while every outcome keeps exactly its intended probability.</p>
            </header>
            <AliasMethodSection />
          </>
        )}

        {section === 'majority' && (
          <>
            <header>
              <h1>Boyer-Moore majority vote</h1>
              <p className="sub">Find the element making up more than half a stream in one pass with a single counter. Step through the cancellation and watch the true majority survive — then a verification pass confirm or reject it.</p>
            </header>
            <MajoritySection />
          </>
        )}

        {section === 'segtree' && (
          <>
            <header>
              <h1>Segment tree</h1>
              <p className="sub">Range-minimum queries and point updates, both O(log n) — the thing a Fenwick tree can't do. Drag the query range and watch the few covering nodes light up, then update a leaf and see the change ripple to the root.</p>
            </header>
            <SegTreeSection />
          </>
        )}

        {section === 'intervaltree' && (
          <>
            <header>
              <h1>Interval tree</h1>
              <p className="sub">Answer "which intervals overlap this range?" in O(log n + k) instead of scanning all of them — for calendars, genome features, firewall port ranges. A BST keyed by low endpoint, augmented so each node stores its subtree's maximum high endpoint, which lets a search prune whole subtrees that can't reach the query. Slide the query range and watch the overlaps light up and the pruned subtrees dim.</p>
            </header>
            <IntervalTreeSection />
          </>
        )}

        {section === 'reservoir' && (
          <>
            <header>
              <h1>Reservoir sampling</h1>
              <p className="sub">Pick k items uniformly from a stream you can't store and whose length you don't know, in one pass. Step the stream through a fixed reservoir, then see 3000 runs prove every item is selected about k/n of the time.</p>
            </header>
            <ReservoirSection />
          </>
        )}

        {section === 'dfa' && (
          <>
            <header>
              <h1>Finite automata (DFA)</h1>
              <p className="sub">The simplest computer: states and transitions, no memory — yet enough to power regexes and lexers. Feed a string and watch the active state walk the transitions, including the delightful 3-state machine for "divisible by 3".</p>
            </header>
            <DfaSection />
          </>
        )}

        {section === 'fencing' && (
          <>
            <header>
              <h1>Fencing tokens</h1>
              <p className="sub">Why a distributed lock alone can't protect data, and how a monotonically-increasing token fixes it. Watch the classic split-brain scenario corrupt data without fencing — and survive with it.</p>
            </header>
            <FencingSection />
          </>
        )}

        {section === 'leases' && (
          <>
            <header>
              <h1>Leases &amp; clock skew</h1>
              <p className="sub">A lock with an expiry date, so a crashed holder can't freeze the system — but it's only safe if the granter waits out the maximum clock skew before re-granting. Drag the skew, network delay, and guard interval and watch the split-brain window (two leaders at once) open and close.</p>
            </header>
            <LeasesSection />
          </>
        )}

        {section === 'hashchain' && (
          <>
            <header>
              <h1>Hash chain</h1>
              <p className="sub">The tamper-evidence trick behind blockchains, Git, and transparency logs. Each block stores the previous block's hash; edit any block's data and watch the mismatch cascade all the way to the tip.</p>
            </header>
            <HashChainSection />
          </>
        )}

        {section === 'happyeyeballs' && (
          <>
            <header>
              <h1>Happy Eyeballs</h1>
              <p className="sub">How a dual-stack client connects fast without stalling on a broken IPv6 path. Drag the IPv4/IPv6 connection times and watch the race — IPv6 preferred, IPv4 fallback racing in after a short delay.</p>
            </header>
            <HappyEyeballsSection />
          </>
        )}

        {section === 'nagle' && (
          <>
            <header>
              <h1>Nagle &amp; delayed ACK</h1>
              <p className="sub">Two TCP optimizations that deadlock when they meet. Toggle Nagle and delayed ACK, drag the RTT and ACK timer, and watch the write-write-read stall appear as a red band on the ladder diagram — then vanish under TCP_NODELAY.</p>
            </header>
            <NagleSection />
          </>
        )}

        {section === 'chandy' && (
          <>
            <header>
              <h1>Chandy-Lamport snapshot</h1>
              <p className="sub">Record a consistent global state of a distributed system with no shared clock — using marker messages over FIFO channels. Step through a two-account bank and watch the snapshot capture the money caught in flight, keeping the books balanced.</p>
            </header>
            <ChandySection />
          </>
        )}

        {section === 'viterbi' && (
          <>
            <header>
              <h1>Viterbi / convolutional codes</h1>
              <p className="sub">Forward error correction: a rate-1/2 encoder doubles each bit, and the Viterbi decoder walks a trellis to recover the most-likely message. Click a received bit to inject an error and watch it get corrected — no retransmission.</p>
            </header>
            <VitSection />
          </>
        )}

        {section === 'sctp' && (
          <>
            <header>
              <h1>SCTP multi-homing</h1>
              <p className="sub">The transport that survives a dead network path. An association binds multiple addresses per endpoint and fails over to an alternate when a path dies — no reconnect, no lost connection. Fire timeouts and watch it reroute, then see the stateless cookie handshake.</p>
            </header>
            <SctpSection />
          </>
        )}

        {section === 'mptcp' && (
          <>
            <header>
              <h1>Multipath TCP</h1>
              <p className="sub">One TCP connection spread across several network paths at once — your phone using Wi-Fi and cellular together. The stream is striped across subflows, each byte carrying a connection-level Data Sequence Number so segments reassemble in order despite racing across paths. Toggle a path off and watch every byte reroute onto the survivor, connection intact.</p>
            </header>
            <MptcpSection />
          </>
        )}

        {section === 'pagereplace' && (
          <>
            <header>
              <h1>Page replacement</h1>
              <p className="sub">When memory is full, which page gets evicted? Compare FIFO, LRU, Clock and Optimal on a reference string — count the page faults and watch FIFO's Belady anomaly, where more frames cause more faults.</p>
            </header>
            <PageReplaceSection />
          </>
        )}

        {section === 'retry' && (
          <>
            <header>
              <h1>Retry &amp; circuit breaker</h1>
              <p className="sub">How resilient clients avoid making an outage worse. Compare backoff strategies and watch jitter flatten a thundering-herd retry storm, then see a circuit breaker trip open, shed load, and probe its way back to healthy.</p>
            </header>
            <RetrySection />
          </>
        )}

        {section === 'smuggle' && (
          <>
            <header>
              <h1>HTTP request smuggling</h1>
              <p className="sub">When a front-end proxy and back-end server disagree on how to delimit a request body, the leftover bytes get smuggled onto the next victim's request. Watch CL.TE and TE.CL desyncs split the same bytes at different offsets.</p>
            </header>
            <SmuggleSection />
          </>
        )}

        {section === 'phiaccrual' && (
          <>
            <header>
              <h1>Failure detectors (φ-accrual)</h1>
              <p className="sub">How distributed systems decide a peer is dead without a brittle fixed timeout. A continuous suspicion level adapts to the link's jitter — drag the threshold and compare it against a naive timeout across a GC pause and a real crash.</p>
            </header>
            <PhiSection />
          </>
        )}

        {section === 'consttime' && (
          <>
            <header>
              <h1>Timing attacks</h1>
              <p className="sub">Why comparing a secret with <code>==</code> is a vulnerability. A naive compare leaks the matching-prefix length through its running time — watch the byte-by-byte attack walk the secret out of it, and watch constant-time compare give the attacker nothing.</p>
            </header>
            <CtSection />
          </>
        )}

        {section === 'conditional' && (
          <>
            <header>
              <h1>Conditional &amp; range requests</h1>
              <p className="sub">ETags and validators let HTTP skip work: 304 Not Modified reuses a cached body, 206 Partial Content resumes a download, and If-Match prevents lost updates. Build requests and watch the server's status and bytes-sent change.</p>
            </header>
            <CondSection />
          </>
        )}

        {section === 'siteisolation' && (
          <>
            <header>
              <h1>Site isolation</h1>
              <p className="sub">How a page earns its own process and re-unlocks SharedArrayBuffer post-Spectre. Set COOP and COEP headers and watch crossOriginIsolated resolve, plus which cross-origin subresources are still allowed to embed.</p>
            </header>
            <IsoSection />
          </>
        )}

        {section === 'vxlan' && (
          <>
            <header>
              <h1>VXLAN overlay</h1>
              <p className="sub">How clouds run millions of isolated tenant L2 networks over one shared L3 fabric. Watch a VTEP wrap a tenant frame in VXLAN/UDP/IP, learn inner-MAC → remote-VTEP to turn floods into unicast, and keep VNIs fully isolated.</p>
            </header>
            <VxSection />
          </>
        )}

        {section === 'sri' && (
          <>
            <header>
              <h1>Subresource Integrity</h1>
              <p className="sub">How a page pins the exact bytes of a CDN script so a compromised file can't run. Edit the served file or simulate a CDN compromise and watch the browser re-hash it and block the mismatch.</p>
            </header>
            <SriSection />
          </>
        )}

        {section === 'antientropy' && (
          <>
            <header>
              <h1>Read-repair &amp; anti-entropy</h1>
              <p className="sub">How leaderless replicas heal divergence. Make a replica diverge and watch a Merkle-tree comparison drill down only through differing branches to pinpoint the bad keys in O(log n), plus read-repair on the quorum-read path.</p>
            </header>
            <AeSection />
          </>
        )}

        {section === 'hintedhandoff' && (
          <>
            <header>
              <h1>Hinted handoff</h1>
              <p className="sub">How Dynamo-style stores keep accepting writes while a replica is down. The value is parked as a "hint" on the next healthy node — counting toward the write quorum (a sloppy quorum) — and replayed when the owner recovers. Knock nodes down, tune N and W, and watch writes stay available, then heal.</p>
            </header>
            <HintedHandoffSection />
          </>
        )}

        {section === 'readrepair' && (
          <>
            <header>
              <h1>Read repair — fix-on-read</h1>
              <p className="sub">How an eventually-consistent store (Dynamo, Cassandra) heals stale replicas as a side effect of ordinary reads: query R replicas, return the freshest, and write it back to the ones that were behind. Build a read set, watch stale replicas get repaired — and see the stale read you get when the read set misses the newest write, the reason strong reads want R + W &gt; N.</p>
            </header>
            <ReadRepairSection />
          </>
        )}

        {section === 'vrrp' && (
          <>
            <header>
              <h1>VRRP redundancy</h1>
              <p className="sub">First-hop redundancy: a group of routers shares one virtual gateway IP so a host is never stranded by a single failure. Toggle routers and watch mastership move, with a priority skew that prevents two backups colliding.</p>
            </header>
            <VrrpSection />
          </>
        )}

        {section === 'truetime' && (
          <>
            <header>
              <h1>TrueTime &amp; commit-wait</h1>
              <p className="sub">How Spanner orders transactions globally using real clocks with bounded uncertainty. Drag ε and watch the commit timestamp and the 2ε commit-wait that buys external consistency — then toggle it off to see ordering break.</p>
            </header>
            <TtSection />
          </>
        )}

        {section === 'ecn' && (
          <>
            <header>
              <h1>ECN marking</h1>
              <p className="sub">How a router signals congestion by marking a packet instead of dropping it. Walk the CE→ECE→CWR signal and compare an ECN flow (marks, zero loss) against a drop-based one — same backoff, no retransmits.</p>
            </header>
            <EcnSection />
          </>
        )}

        {section === 'dot1x' && (
          <>
            <header>
              <h1>802.1X / EAPOL</h1>
              <p className="sub">Port-based network access control: a switch port stays blocked until your device passes EAP authentication against a RADIUS server. Step the exchange and watch the authenticator relay EAP and the port flip to authorized.</p>
            </header>
            <DotxSection />
          </>
        )}

        {section === 'ipsec' && (
          <>
            <header>
              <h1>IPsec ESP (VPN)</h1>
              <p className="sub">How a VPN encrypts IP packets. Flip between transport and tunnel mode and watch the ESP wrapping, the encrypted region (opaque, never faked), what an eavesdropper can still read, and how the receiver demuxes by SPI to the right key.</p>
            </header>
            <IpsecSection />
          </>
        )}

        {section === 'causalbcast' && (
          <>
            <header>
              <h1>Causal broadcast</h1>
              <p className="sub">Delivering messages so a reply never appears before the message it answers, even when the network reorders them. Step through a reordered conversation and watch the receiver buffer and release messages to preserve causal order.</p>
            </header>
            <CbSection />
          </>
        )}

        {section === 'ecmp' && (
          <>
            <header>
              <h1>ECMP load spreading</h1>
              <p className="sub">How a router spreads traffic across equal-cost paths by hashing each flow — keeping flows in order while balancing load. Watch flows scatter, then see the polarization trap when cascaded routers share a hash seed.</p>
            </header>
            <EcmpSection />
          </>
        )}

        {section === 'realtime' && (
          <>
            <header>
              <h1>Realtime: SSE vs WebSocket</h1>
              <p className="sub">Three ways to push server events to a browser — long-poll, SSE, and WebSocket — compared on one timeline. Drag the network delay and watch long-poll stall events that fire during its reconnect gap.</p>
            </header>
            <RtmSection />
          </>
        )}

        {section === 'x3dh' && (
          <>
            <header>
              <h1>X3DH key agreement</h1>
              <p className="sub">How Signal starts an encrypted session with someone who's offline. Bob's prekey bundle plus Alice's ephemeral fold into four Diffie-Hellman results and one shared key — which Bob rederives later, no live handshake.</p>
            </header>
            <X3dhSection />
          </>
        )}

        {section === 'threshsig' && (
          <>
            <header>
              <h1>Threshold signatures</h1>
              <p className="sub">A t-of-n signing key that no single party holds. Pick a coalition and watch partial signatures combine — via Lagrange interpolation — into one signature that verifies under the group key, while fewer than t signers fail.</p>
            </header>
            <ThresholdSection />
          </>
        )}

        {section === 'tfo' && (
          <>
            <header>
              <h1>TCP Fast Open</h1>
              <p className="sub">Shaving the handshake round-trip off repeat connections by sending request data right in the SYN — with a cookie to keep spoofers out. Compare normal TCP, the first cookie-fetching visit, and a 0-RTT repeat.</p>
            </header>
            <TfoSection />
          </>
        )}

        {section === 'zerortt' && (
          <>
            <header>
              <h1>0-RTT resumption &amp; the replay problem</h1>
              <p className="sub">How TLS 1.3 and QUIC send your request in the very first packet — zero round trips to the first byte — using a resumption ticket from a prior visit. The sharp edge: that early data has no server freshness yet, so it can be replayed. Toggle first vs return visit, pick a method, and watch an attacker's replay be harmless for a GET and a double-charge for a POST.</p>
            </header>
            <ZeroRttSection />
          </>
        )}

        {section === 'raftlog' && (
          <>
            <header>
              <h1>Raft log replication</h1>
              <p className="sub">How an elected leader makes every follower's log identical and decides when an entry is safely committed — including the subtle §5.4.2 rule that stops a majority-stored entry from being overwritten.</p>
            </header>
            <RaftLogSection />
          </>
        )}

        {section === 'avl' && (
          <>
            <header>
              <h1>AVL tree</h1>
              <p className="sub">A binary search tree that rebalances itself after every insert via rotations, so it never degrades into a linked list. Insert keys (or 7 sorted ones) and watch the balance factors and rotations keep it log-deep.</p>
            </header>
            <AvlSection />
          </>
        )}

        {section === 'splaytree' && (
          <>
            <header>
              <h1>Splay tree — the self-adjusting BST</h1>
              <p className="sub">A binary search tree that rebalances around whatever you touch: every lookup rotates that node all the way to the root, so recently- and frequently-accessed keys stay near the top and cost O(1). No balance factors or colors — just "move what you touched up." Click nodes and watch the tree remold itself to your access pattern.</p>
            </header>
            <SplayTreeSection />
          </>
        )}

        {section === 'treap' && (
          <>
            <header>
              <h1>Treap — the randomized BST</h1>
              <p className="sub">A binary search tree that stays balanced by accident, not by rules. Every node gets a random priority, and the tree maintains BST order on keys plus heap order on priorities at once — which, for random priorities, is a balanced tree with no rotations to track. Add keys (even a sorted run that would ruin a plain BST) and watch it stay shallow; because priorities come from a key hash, the shape depends only on the key set, not insertion order.</p>
            </header>
            <TreapSection />
          </>
        )}

        {section === 'piecetable' && (
          <>
            <header>
              <h1>Piece table — how a text editor holds your document</h1>
              <p className="sub">The structure VS Code (and historically Word) uses to edit text without ever moving the bytes. The original file is loaded once and never mutated; everything you type is appended to a separate buffer; and the document is just an ordered list of pieces — spans into those two immutable buffers. That's why edits are cheap and undo is nearly free. Insert and delete, and watch the pieces re-stitch while the buffers stay put.</p>
            </header>
            <PieceTableSection />
          </>
        )}

        {section === 'encoding' && (
          <>
            <header>
              <h1>Encoding</h1>
              <p className="sub">How data is represented as bytes — type and watch it transform, for real.</p>
            </header>
            <EncodingSection />
          </>
        )}

        {section === 'varint' && (
          <>
            <header>
              <h1>Varint &amp; zigzag encoding</h1>
              <p className="sub">How Protocol Buffers packs integers: seven data bits per byte plus a continuation flag, so small numbers cost one byte and you only pay for the magnitude you use. Type a value to see the bytes and their continuation bits — then meet the negative-number gotcha (a plain signed varint is always 10 bytes) and watch zigzag collapse it back to one.</p>
            </header>
            <VarintSection />
          </>
        )}

        {section === 'base58' && (
          <>
            <header>
              <h1>Base58 &amp; Base58Check</h1>
              <p className="sub">The encoding behind Bitcoin addresses and IPFS content IDs. Like Base64 but it drops the look-alike characters (0, O, I, l) so a human can transcribe it, and because 58 isn't a power of two it encodes the whole input as one big base-58 number. Base58Check wraps a version byte and a 4-byte double-SHA256 checksum so a mistyped address is caught before any coins move. Build a real address and watch the checksum catch a typo.</p>
            </header>
            <Base58Section />
          </>
        )}

        {section === 'huffman' && (
          <>
            <header>
              <h1>Huffman coding</h1>
              <p className="sub">Optimal prefix-free compression — type text and watch the tree build, frequent symbols get short codes, and the bitstream shrink below fixed-width.</p>
            </header>
            <HuffmanSection />
          </>
        )}

        {section === 'golombrice' && (
          <>
            <header>
              <h1>Golomb-Rice coding</h1>
              <p className="sub">The variable-length integer code that's optimal when small values dominate — audio residuals, gaps between events, sparse bitmaps. Split a number into a quotient sent in unary and a remainder in k binary bits; tiny values get tiny codes. Tune the parameter k and watch the bits-per-value curve find its sweet spot.</p>
            </header>
            <GolombRiceSection />
          </>
        )}

        {section === 'eliascode' && (
          <>
            <header>
              <h1>Elias γ/δ coding</h1>
              <p className="sub">Parameter-free, self-delimiting codes for positive integers: write a number in binary so a decoder knows where it ends with no separator and no fixed width. γ prefixes the value with ⌊log2 n⌋ zeros as a unary length; δ encodes that length with γ itself, winning for larger numbers. Type a number to see it decompose, then feed a list of gaps and compare against fixed-width.</p>
            </header>
            <EliasCodeSection />
          </>
        )}

        {section === 'gorilla' && (
          <>
            <header>
              <h1>Gorilla — time-series compression</h1>
              <p className="sub">How monitoring systems (Prometheus, InfluxDB) store billions of metric points in a fraction of the space. Timestamps ride on delta-of-delta (regular intervals → one bit); values are XOR'd against the previous point (unchanged or similar → almost no bits). Pick a metric shape and watch a 128-bit-per-sample series collapse — losslessly.</p>
            </header>
            <GorillaSection />
          </>
        )}

        {section === 'cobs' && (
          <>
            <header>
              <h1>COBS — Consistent Overhead Byte Stuffing</h1>
              <p className="sub">How you frame a raw byte stream so 0x00 can mark the end of a frame — even when the payload contains zeros. COBS removes every zero byte with a tiny, bounded overhead (⌊n/254⌋+1 bytes, never the doubling that escaping risks), leaving 0x00 free as the delimiter. Pick a payload and watch the zeros vanish into code bytes, then decode back exactly.</p>
            </header>
            <CobsSection />
          </>
        )}

        {section === 'errors' && (
          <>
            <header>
              <h1>Error control</h1>
              <p className="sub">How the wire catches — and sometimes repairs — flipped bits, from parity to CRC to Hamming.</p>
            </header>
            <ErrorDetectSection />
          </>
        )}

        {section === 'identity' && (
          <>
            <header>
              <h1>Identity &amp; Auth</h1>
              <p className="sub">Tokens, one-time codes, and delegated access — how systems prove who you are.</p>
            </header>
            <IdentitySection />
          </>
        )}

        {section === 'jwt' && (
          <>
            <header>
              <h1>JWT &amp; the alg=none attack</h1>
              <p className="sub">The signed tokens behind most stateless auth: header.payload.signature, base64url-encoded, signed (not encrypted) so anyone can read the claims but only the key holder can forge a valid one. See a real HS256 token built with genuine HMAC-SHA256, toggle a claim to watch the signature change, then forge an alg=none token and watch a naive verifier accept the unsigned forgery while a strict one rejects it.</p>
            </header>
            <JwtSection />
          </>
        )}

        {section === 'attacks' && (
          <>
            <header>
              <h1>Attacks, made visible</h1>
              <p className="sub">Real mechanisms with real numbers — each shown with its defence. For understanding, not harm.</p>
            </header>
            <AttacksSection />
          </>
        )}

        {section === 'routing' && (
          <>
            <header>
              <h1>Routing &amp; paths</h1>
              <p className="sub">Watch a link-state network compute shortest paths with Dijkstra — and reroute when a link cost changes.</p>
            </header>
            <RoutingSection />
          </>
        )}

        {section === 'dns' && (
          <>
            <header>
              <h1>DNS journey</h1>
              <p className="sub">Follow a name down the delegation hierarchy — root to TLD to authoritative — and see why caching makes it fast.</p>
            </header>
            <DnsJourneySection />
          </>
        )}

        {section === 'subnet' && (
          <>
            <header>
              <h1>Subnetting &amp; CIDR</h1>
              <p className="sub">See where the network ends and the host begins — on the actual bits — then split a block into subnets.</p>
            </header>
            <SubnetSection />
          </>
        )}

        {section === 'bgp' && (
          <>
            <header>
              <h1>BGP best-path selection</h1>
              <p className="sub">Step down BGP's tie-breaker ladder and watch candidate routes get eliminated until one best path wins.</p>
            </header>
            <BgpPathSection />
          </>
        )}

        {section === 'congestion' && (
          <>
            <header>
              <h1>TCP congestion control</h1>
              <p className="sub">Watch the congestion window probe, back off, and recover — the sawtooth behind every TCP transfer's speed.</p>
            </header>
            <CongestionSection />
          </>
        )}

        {section === 'http2' && (
          <>
            <header>
              <h1>HTTP/2 multiplexing</h1>
              <p className="sub">One connection, many interleaved streams — watch short requests stop waiting behind big ones.</p>
            </header>
            <Http2Section />
          </>
        )}

        {section === 'quic' && (
          <>
            <header>
              <h1>QUIC vs TCP + TLS</h1>
              <p className="sub">Fewer round trips to the first byte, and no transport-layer head-of-line blocking — why HTTP/3 left TCP.</p>
            </header>
            <QuicSection />
          </>
        )}

        {section === 'quicmig' && (
          <>
            <header>
              <h1>QUIC connection migration</h1>
              <p className="sub">Why a QUIC download survives walking from wifi onto cellular while a TCP one dies. TCP finds your connection by its 4-tuple — change your IP and it's gone, forcing a full reconnect. QUIC tags every packet with a connection ID independent of address, so the same connection is recognized from a new network and only needs a quick path validation. Toggle the protocol and switch networks to see it.</p>
            </header>
            <QuicMigSection />
          </>
        )}

        {section === 'nat' && (
          <>
            <header>
              <h1>NAT / PAT</h1>
              <p className="sub">One public IP for a whole network — watch the translation table build and route replies home.</p>
            </header>
            <NatSection />
          </>
        )}

        {section === 'flow' && (
          <>
            <header>
              <h1>TCP flow control</h1>
              <p className="sub">The sliding window — how the receiver's advertised window throttles a sender that's going too fast.</p>
            </header>
            <SlidingWindowSection />
          </>
        )}

        {section === 'sws' && (
          <>
            <header>
              <h1>Silly window syndrome</h1>
              <p className="sub">The TCP flow-control pathology where a connection collapses into a flood of tiny segments, wasting nearly all its bandwidth on packet headers. A slow-reading receiver frees a few bytes at a time and advertises those tiny windows; an eager sender fills each one with a runt segment. The cure is Clark's receiver-side avoidance plus Nagle's sender-side coalescing. Drag the reader's pace and watch goodput collapse and recover.</p>
            </header>
            <SwsSection />
          </>
        )}

        {section === 'bufferbloat' && (
          <>
            <header>
              <h1>Bufferbloat &amp; AQM</h1>
              <p className="sub">Why a bigger buffer makes latency worse — and how active queue management keeps it low.</p>
            </header>
            <BufferbloatSection />
          </>
        )}

        {section === 'cookies' && (
          <>
            <header>
              <h1>HTTP cookies &amp; sessions</h1>
              <p className="sub">Craft a request and watch which cookies attach — domain, path, Secure, and SameSite rules in action.</p>
            </header>
            <CookiesSection />
          </>
        )}

        {section === 'certs' && (
          <>
            <header>
              <h1>Certificates &amp; PKI</h1>
              <p className="sub">Walk the certificate chain leaf → root — and watch validation fail at the exact link you break.</p>
            </header>
            <CertChainSection onOpen={(id) => setSection(id as Section)} />
          </>
        )}

        {section === 'traceroute' && (
          <>
            <header>
              <h1>Traceroute</h1>
              <p className="sub">Map the routers to a destination using only the TTL field — one hop revealed per probe.</p>
            </header>
            <TracerouteSection />
          </>
        )}

        {section === 'dhcp' && (
          <>
            <header>
              <h1>DHCP — DORA &amp; the lease</h1>
              <p className="sub">Discover, Offer, Request, Ack — how a device gets an address from nothing, and how the lease ages.</p>
            </header>
            <DhcpSection />
          </>
        )}

        {section === 'switch' && (
          <>
            <header>
              <h1>Ethernet switch (L2)</h1>
              <p className="sub">Send frames and watch the switch learn MAC addresses, then flood the unknown and forward the known.</p>
            </header>
            <SwitchSection />
          </>
        )}

        {section === 'ratelimit' && (
          <>
            <header>
              <h1>Rate limiting (token bucket)</h1>
              <p className="sub">How an API allows bursts but caps the sustained rate — drain the bucket and watch the 429s begin.</p>
            </header>
            <TokenBucketSection />
          </>
        )}

        {section === 'chash' && (
          <>
            <header>
              <h1>Consistent hashing</h1>
              <p className="sub">Add or remove a server and watch only a small arc of keys move — not the whole keyspace.</p>
            </header>
            <ConsistentHashSection />
          </>
        )}

        {section === 'jumphash' && (
          <>
            <header>
              <h1>Jump consistent hash</h1>
              <p className="sub">Google's memoryless consistent-hash algorithm: map a key to one of N shards in five lines, so that growing N by one moves only ~1/N of keys — and only onto the new shard. Drag the bucket count and watch which keys move, then compare against plain key % N, which reshuffles almost everything.</p>
            </header>
            <JumpHashSection />
          </>
        )}

        {section === 'rendezvous' && (
          <>
            <header>
              <h1>Rendezvous hashing (HRW)</h1>
              <p className="sub">Highest Random Weight: to place a key, score it against every node with hash(key, node) and pick the highest — no ring, no virtual nodes. Keys spread evenly, and adding or removing a node moves only ~1/N of them. The full ranking doubles as a replica preference list. Pick a key, watch the weights, and add/remove nodes to see how little moves.</p>
            </header>
            <RendezvousSection />
          </>
        )}

        {section === 'lb' && (
          <>
            <header>
              <h1>Load balancing</h1>
              <p className="sub">Six strategies — round-robin, weighted, least-connections, IP-hash, random, and power-of-two-choices — watch each spread requests differently, and see why sampling just two backends (P2C) nearly eliminates the tail that dooms pure random.</p>
            </header>
            <LoadBalanceSection />
          </>
        )}

        {section === 'bloom' && (
          <>
            <header>
              <h1>Bloom filter</h1>
              <p className="sub">A few bits and a few hashes that answer “definitely not” or “probably yes” — watch it fill and false-positive.</p>
            </header>
            <BloomSection />
          </>
        )}

        {section === 'cdn' && (
          <>
            <header>
              <h1>CDN &amp; caching</h1>
              <p className="sub">Watch a request cascade browser → edge → origin: cold miss, warm hit, then TTL expiry and revalidation.</p>
            </header>
            <CacheHierarchySection />
          </>
        )}

        {section === 'qos' && (
          <>
            <header>
              <h1>QoS packet scheduling</h1>
              <p className="sub">Strict priority vs weighted round robin — watch one starve a class and the other share fairly.</p>
            </header>
            <QosSection />
          </>
        )}

        {section === 'merkle' && (
          <>
            <header>
              <h1>Merkle tree</h1>
              <p className="sub">One root hash commits to a whole dataset — click a leaf for its proof, edit one and watch its path change.</p>
            </header>
            <MerkleSection />
          </>
        )}

        {section === 'lamportsig' && (
          <>
            <header>
              <h1>Lamport one-time signatures</h1>
              <p className="sub">A digital signature built from nothing but a hash function — quantum-resistant, and the root of the post-quantum schemes SPHINCS+ and XMSS. The private key is 2L random secrets; the public key is those secrets hashed; signing reveals one secret per message-digest bit, and verifying re-hashes them. But it signs exactly once: sign a second message with the same key and watch positions expose both secrets, letting a forger take over. Type a message and see.</p>
            </header>
            <LamportSigSection />
          </>
        )}

        {section === 'lenext' && (
          <>
            <header>
              <h1>The length-extension attack</h1>
              <p className="sub">Why H(secret ‖ message) is a broken MAC — and why HMAC exists. Because a Merkle–Damgård digest is the hash's internal state, an attacker who never learns the secret can resume from a published tag, append the message's padding plus their own bytes, and forge a valid tag. Play the attacker, watch the forgery get accepted, then flip to HMAC and watch it fail.</p>
            </header>
            <LenExtSection />
          </>
        )}

        {section === 'hmac' && (
          <>
            <header>
              <h1>HMAC — keyed message authentication</h1>
              <p className="sub">How you prove a message came from someone holding a shared secret and wasn't tampered with — the MAC behind TLS, JWTs (HS256), webhook signatures, and AWS request signing. Naive keyed hashing H(key ‖ msg) is broken by length extension; HMAC hashes twice with two key-derived pads so there's nothing to extend. Type a key and message and watch it build from real SHA-256, matching the RFC 4231 vectors.</p>
            </header>
            <HmacSection />
          </>
        )}

        {section === 'paddingoracle' && (
          <>
            <header>
              <h1>The padding-oracle attack</h1>
              <p className="sub">How a server that only says "valid padding" or "invalid padding" leaks the entire plaintext of a CBC-encrypted message — without the key. Because CBC decryption XORs the previous block, an attacker forges it byte by byte and watches the padding check to recover each byte. Type a secret, step through the attack, and watch the plaintext fall.</p>
            </header>
            <PaddingOracleSection />
          </>
        )}

        {section === 'vclock' && (
          <>
            <header>
              <h1>Vector clocks</h1>
              <p className="sub">Order events across processes without a shared clock — click two to see if one caused the other or they're concurrent.</p>
            </header>
            <VectorClockSection />
          </>
        )}

        {section === 'crdt' && (
          <>
            <header>
              <h1>CRDTs</h1>
              <p className="sub">Conflict-free replicated data types — edit two replicas offline, then merge to a deterministic result with no lost updates and no coordination.</p>
            </header>
            <CrdtSection />
          </>
        )}

        {section === 'optransform' && (
          <>
            <header>
              <h1>Operational transformation</h1>
              <p className="sub">How Google Docs lets many people type in one document at once. When a site receives a concurrent edit, it transforms the operation against its own — adjusting indices so both replicas converge to the same text no matter what order edits arrive. Set two concurrent edits and watch both replicas converge, then compare the naive approach that diverges.</p>
            </header>
            <OpTransformSection />
          </>
        )}

        {section === 'gossip' && (
          <>
            <header>
              <h1>Gossip / epidemic spread</h1>
              <p className="sub">Watch news sweep a leaderless cluster round by round in the classic S-curve — converging in ~log(N) rounds.</p>
            </header>
            <GossipSection />
          </>
        )}

        {section === 'raft' && (
          <>
            <header>
              <h1>Raft leader election</h1>
              <p className="sub">Click a node to fire its election timeout — watch terms, votes, and majorities decide a single leader.</p>
            </header>
            <RaftSection />
          </>
        )}

        {section === 'cap' && (
          <>
            <header>
              <h1>CAP theorem</h1>
              <p className="sub">Partition the network, then choose consistency or availability — and watch the trade-off you can't escape.</p>
            </header>
            <CapSection />
          </>
        )}

        {section === 'replication' && (
          <>
            <header>
              <h1>Replication &amp; the WAL</h1>
              <p className="sub">Leader appends, followers copy — sync waits for a quorum, async risks the tail. Crash the leader and see what survives.</p>
            </header>
            <ReplicationSection />
          </>
        )}

        {section === 'chainrep' && (
          <>
            <header>
              <h1>Chain replication</h1>
              <p className="sub">Strong consistency without quorum math. Replicas form a chain: writes enter the head and flow to the tail, which commits and acks; reads are served by the tail, so they always see the latest committed write. Step a write down the chain, then fail a node and watch the chain reconfigure with a simple head/tail relabel.</p>
            </header>
            <ChainRepSection />
          </>
        )}

        {section === 'twopc' && (
          <>
            <header>
              <h1>Two-phase commit</h1>
              <p className="sub">Atomic commit across databases — vote, decide, and watch the coordinator-crash blocking problem.</p>
            </header>
            <TwoPcSection />
          </>
        )}

        {section === 'threepc' && (
          <>
            <header>
              <h1>Three-phase commit</h1>
              <p className="sub">The non-blocking fix for two-phase commit. 2PC leaves participants stuck holding locks if the coordinator crashes after the votes; 3PC's extra pre-commit phase lets the survivors decide on their own. Set the votes and the coordinator crash point, and compare the two protocols side by side — plus why consensus (Paxos/Raft) replaced both.</p>
            </header>
            <ThreePcSection />
          </>
        )}

        {section === 'fragment' && (
          <>
            <header>
              <h1>IP fragmentation &amp; MTU</h1>
              <p className="sub">Split a datagram to fit the link — offsets, MF flags, reassembly — or set DF and watch Path-MTU Discovery.</p>
            </header>
            <FragmentSection />
          </>
        )}

        {section === 'bgphijack' && (
          <>
            <header>
              <h1>BGP route propagation &amp; hijacking</h1>
              <p className="sub">Watch a prefix spread across ASes — then a rogue AS hijack it and redirect the internet's traffic.</p>
            </header>
            <BgpHijackSection />
          </>
        )}

        {section === 'mpls' && (
          <>
            <header>
              <h1>MPLS label switching</h1>
              <p className="sub">Forward on a label, not an address — step a packet down the LSP and watch the label pushed at the ingress, swapped hop by hop, and popped at the penultimate router.</p>
            </header>
            <MplsSection />
          </>
        )}

        {section === 'segrouting' && (
          <>
            <header>
              <h1>Segment routing</h1>
              <p className="sub">Steer a packet along any path by writing a stack of waypoints ("segments") into its header — no per-flow state in the core the way old RSVP-TE needed. A node segment means "reach router X by the shortest path"; an adjacency segment forces one specific link. Pick a segment list and watch the realized route light up, engineered to detour around a link the shortest path would take.</p>
            </header>
            <SegRouteSection />
          </>
        )}

        {section === 'natpunch' && (
          <>
            <header>
              <h1>NAT traversal (STUN / TURN / ICE)</h1>
              <p className="sub">How two peers behind NATs connect — hole-punch a direct path, or fall back to a relay when a symmetric NAT blocks it.</p>
            </header>
            <NatTraversalSection />
          </>
        )}

        {section === 'ipcompare' && (
          <>
            <header>
              <h1>IPv4 vs IPv6 headers</h1>
              <p className="sub">The two headers side by side — what IPv6 removed, renamed, and added, and why it forwards faster.</p>
            </header>
            <IpCompareSection />
          </>
        )}

        {section === 'icmp' && (
          <>
            <header>
              <h1>ICMP messages</h1>
              <p className="sub">The internet's error and control messages — Echo, Time Exceeded, Destination Unreachable — with jumps to where each one appears.</p>
            </header>
            <IcmpSection onOpen={(id) => setSection(id as Section)} />
          </>
        )}

        {section === 'arp' && (
          <>
            <header>
              <h1>ARP resolution</h1>
              <p className="sub">Map an IP to its MAC on the LAN — who-has broadcast, is-at reply, the cache, and gratuitous ARP.</p>
            </header>
            <ArpSection />
          </>
        )}

        {section === 'csma' && (
          <>
            <header>
              <h1>WiFi CSMA/CA</h1>
              <p className="sub">How stations share one wireless channel — random backoff, collisions, and the contention window growing under load.</p>
            </header>
            <CsmaSection />
          </>
        )}

        {section === 'multicast' && (
          <>
            <header>
              <h1>Multicast &amp; IGMP</h1>
              <p className="sub">One sender, many subscribers — join hosts to a group and watch an IGMP-snooping switch forward the frame to only the members, not every port.</p>
            </header>
            <MulticastSection />
          </>
        )}

        {section === 'vlan' && (
          <>
            <header>
              <h1>802.1Q VLAN tagging</h1>
              <p className="sub">Build the 4-byte VLAN tag, follow a frame across access and trunk ports, and run the double-tagging hop that abuses the native VLAN.</p>
            </header>
            <VlanSection />
          </>
        )}

        {section === 'ntp' && (
          <>
            <header>
              <h1>NTP clock sync</h1>
              <p className="sub">Four timestamps recover the clock offset across an unknown network — slide the path delays and watch it stay exact when symmetric, and the server's own delay cancel out.</p>
            </header>
            <NtpSection />
          </>
        )}

        {section === 'arq' && (
          <>
            <header>
              <h1>ARQ — Go-Back-N vs Selective Repeat</h1>
              <p className="sub">Drop one frame and compare: Go-Back-N resends it and everything after; Selective Repeat buffers and resends only the gap.</p>
            </header>
            <ArqSection />
          </>
        )}

        {section === 'queueing' && (
          <>
            <header>
              <h1>M/M/1 queueing</h1>
              <p className="sub">The 1/(1−ρ) curve: push arrival rate toward the link's service rate and watch delay go from gentle to a wall — the math under bufferbloat and QoS.</p>
            </header>
            <QueueingSection />
          </>
        )}

        {section === 'rto' && (
          <>
            <header>
              <h1>RTO &amp; Karn's algorithm</h1>
              <p className="sub">How TCP sets its retransmit timeout from smoothed RTT — send packets to watch SRTT and the RTO track, then drop one to see Karn's backoff with no sample taken.</p>
            </header>
            <RtoSection />
          </>
        )}

        {section === 'distvec' && (
          <>
            <header>
              <h1>Distance-vector routing</h1>
              <p className="sub">Routers gossip distance vectors to converge on shortest paths — then cut a link and watch the count-to-infinity problem crawl the cost upward, and poison-reverse stop it.</p>
            </header>
            <DistanceVectorSection />
          </>
        )}

        {section === 'mdns' && (
          <>
            <header>
              <h1>mDNS &amp; DNS-SD</h1>
              <p className="sub">How your laptop finds the printer with no DNS server — browse a service type over multicast, then resolve the PTR→SRV→TXT→A chain to host and port.</p>
            </header>
            <MdnsSection />
          </>
        )}

        {section === 'encdns' && (
          <>
            <header>
              <h1>Encrypted DNS</h1>
              <p className="sub">The same lookup over Do53, DoT, DoH and DoQ — see what a network observer still learns from each, with the encrypted transports honestly opaque on the wire.</p>
            </header>
            <EncryptedDnsSection />
          </>
        )}

        {section === 'http3' && (
          <>
            <header>
              <h1>HTTP/3 &amp; QPACK</h1>
              <p className="sub">HTTP over QUIC: see how the stack changes from HTTP/2, and watch QPACK collapse repeated headers into one-byte dynamic-table indices without head-of-line blocking.</p>
            </header>
            <HttpThreeSection />
          </>
        )}

        {section === 'grpc' && (
          <>
            <header>
              <h1>gRPC &amp; protobuf</h1>
              <p className="sub">Build a request and watch it become protobuf bytes (tag/varint/length), get the gRPC length prefix, and ride an HTTP/2 stream's DATA frame with a trailing grpc-status.</p>
            </header>
            <GrpcSection />
          </>
        )}

        {section === 'websocket' && (
          <>
            <header>
              <h1>WebSocket</h1>
              <p className="sub">Upgrade HTTP into a full-duplex channel — compute the Sec-WebSocket-Accept challenge, then build masked frames byte by byte.</p>
            </header>
            <WebSocketSection />
          </>
        )}

        {section === 'dhmitm' && (
          <>
            <header>
              <h1>DH man-in-the-middle</h1>
              <p className="sub">Diffie–Hellman resists a passive eavesdropper but not an active one — watch Eve run DH with each side and relay, then authenticate the public values to catch her.</p>
            </header>
            <DhMitmSection onOpen={(id) => setSection(id as Section)} />
          </>
        )}

        {section === 'tlsdowngrade' && (
          <>
            <header>
              <h1>TLS downgrade</h1>
              <p className="sub">The ClientHello offers cipher suites before any encryption exists — watch an attacker strip the strong ones to force a breakable suite, then defend with the handshake transcript MAC.</p>
            </header>
            <TlsDowngradeSection />
          </>
        )}

        {section === 'pwhash' && (
          <>
            <header>
              <h1>Password hashing</h1>
              <p className="sub">Beyond salt and iterations — see why memory-hardness (scrypt, Argon2) is what actually defeats GPU/ASIC cracking, with a live attacker-cost comparison.</p>
            </header>
            <PasswordHashSection />
          </>
        )}

        {section === 'shamir' && (
          <>
            <header>
              <h1>Shamir Secret Sharing</h1>
              <p className="sub">Split a secret across n shares so any k reconstruct it and k−1 reveal nothing — gather shares and watch the vault open exactly at the threshold.</p>
            </header>
            <ShamirSection />
          </>
        )}

        {section === 'envelope' && (
          <>
            <header>
              <h1>Envelope encryption (KMS)</h1>
              <p className="sub">How cloud KMS encrypts data at scale without ever exposing the master key. A fresh Data Encryption Key (DEK) encrypts your data; a Key-Encryption Key (KEK) that lives only in the KMS wraps the DEK. Watch rotating the master key re-wrap only the tiny DEK — the ciphertext (your terabytes) is never touched.</p>
            </header>
            <EnvelopeSection />
          </>
        )}

        {section === 'feldman' && (
          <>
            <header>
              <h1>Verifiable secret sharing (Feldman VSS)</h1>
              <p className="sub">Shamir secret sharing without trusting the dealer. The dealer publishes one-way commitments to the polynomial's coefficients, so each participant can verify their share is consistent — catching a cheating dealer — while the secret stays hidden. Set the secret, watch each share verify, flip on cheating to see a bad share rejected, then reconstruct.</p>
            </header>
            <FeldmanSection />
          </>
        )}

        {section === 'pow' && (
          <>
            <header>
              <h1>Proof of Work</h1>
              <p className="sub">Grind a nonce until a real SHA-256 digest clears a zero-bit target — feel the cost climb with difficulty, the engine of hashcash and Bitcoin mining.</p>
            </header>
            <ProofOfWorkSection />
          </>
        )}

        {section === 'feistel' && (
          <>
            <header>
              <h1>Feistel networks (DES)</h1>
              <p className="sub">The block-cipher structure that's reversible for free — watch the L/R halves move through the rounds and decrypt run the same structure backward, even with a non-invertible round function.</p>
            </header>
            <FeistelSection />
          </>
        )}

        {section === 'poly1305' && (
          <>
            <header>
              <h1>Poly1305 MAC</h1>
              <p className="sub">The one-time authenticator paired with ChaCha20 — watch the message accumulate as a polynomial mod 2¹³⁰−5 into a tag, and a tampered byte miss it.</p>
            </header>
            <Poly1305Section />
          </>
        )}

        {section === 'hashbreak' && (
          <>
            <header>
              <h1>Broken hashes &amp; the birthday bound</h1>
              <p className="sub">SHA-1 still computes but is dead (SHAttered) — see the broken-hash family, why collision resistance is only half the bits, and what to use instead.</p>
            </header>
            <HashCollisionSection />
          </>
        )}

        {section === 'ratchet' && (
          <>
            <header>
              <h1>Double Ratchet</h1>
              <p className="sub">Signal's per-message keys — build a conversation, compromise the device, and watch forward secrecy protect the past while a DH ratchet heals the future.</p>
            </header>
            <RatchetSection />
          </>
        )}

        {section === 'kerberos' && (
          <>
            <header>
              <h1>Kerberos</h1>
              <p className="sub">Single sign-on without sending a password — step through the AS, TGS and AP exchanges and watch the tickets stay opaque to the client who just relays them.</p>
            </header>
            <KerberosSection />
          </>
        )}

        {section === 'revocation' && (
          <>
            <header>
              <h1>Revocation &amp; Certificate Transparency</h1>
              <p className="sub">How a browser distrusts a compromised cert before it expires (CRL/OCSP/stapling), and how Certificate Transparency catches a mis-issued one in public.</p>
            </header>
            <RevocationSection />
          </>
        )}

        {section === 'ssh' && (
          <>
            <header>
              <h1>SSH transport</h1>
              <p className="sub">How SSH builds an encrypted tunnel before any secret — step the handshake to NEWKEYS, then see host-key trust-on-first-use catch a man-in-the-middle.</p>
            </header>
            <SshSection />
          </>
        )}

        {section === 'cpusched' && (
          <>
            <header>
              <h1>CPU scheduling</h1>
              <p className="sub">One job set, every classic policy. Edit arrivals and bursts, then watch the Gantt chart and the turnaround/waiting/response numbers reveal the trade-offs — the convoy effect, SJF/SRTF minimizing waiting, round-robin trading turnaround for responsiveness.</p>
            </header>
            <CpuSchedSection />
          </>
        )}

        {section === 'pagewalk' && (
          <>
            <header>
              <h1>Page-table walk</h1>
              <p className="sub">Type a virtual address and watch the MMU translate it: split into four 9-bit table indices plus a 12-bit offset, then chase CR3 → PML4 → PDPT → PD → PT to a physical frame — or hit a not-present entry, fault, and demand-page it in.</p>
            </header>
            <PageWalkSection />
          </>
        )}

        {section === 'inode' && (
          <>
            <header>
              <h1>inode &amp; indirect blocks</h1>
              <p className="sub">How a classic Unix filesystem (ext2/3, FFS) maps a file offset to a disk block. A fixed-size inode holds a dozen direct pointers for small files (one read to the data), then single-, double-, and triple-indirect pointers — blocks of pointers to blocks of pointers — that extend the same tiny inode to address terabytes, at the cost of one extra disk read per level. Pick a block and watch which pointer path reaches it.</p>
            </header>
            <InodeSection />
          </>
        )}

        {section === 'mesi' && (
          <>
            <header>
              <h1>MESI cache coherence</h1>
              <p className="sub">Several cores, one shared memory line. Press a core's read or write and watch its cache state move through Modified / Exclusive / Shared / Invalid as the snooping bus invalidates and downgrades the others — and see why false sharing is so costly.</p>
            </header>
            <MesiSection />
          </>
        )}

        {section === 'falseshare' && (
          <>
            <header>
              <h1>False sharing</h1>
              <p className="sub">The performance bug where two cores fight over a cache line even though their threads touch different variables. Because caches move memory in 64-byte lines, two counters that happen to share a line ping-pong between cores on every write — no shared data, yet a 10×+ slowdown. Toggle packed vs padded layout and watch the coherence traffic vanish.</p>
            </header>
            <FalseSharingSection />
          </>
        )}

        {section === 'joins' && (
          <>
            <header>
              <h1>Join algorithms</h1>
              <p className="sub">The same two tables joined three ways — nested-loop, hash, and sort-merge. Edit the keys and watch the work each does: the nested-loop grid literally is its |R|·|S| comparisons, hash join builds a table on S, sort-merge sorts both for a single linear sweep. All three return identical rows; the optimizer picks by cost.</p>
            </header>
            <JoinsSection />
          </>
        )}

        {section === 'h2flow' && (
          <>
            <header>
              <h1>HTTP/2 &amp; QUIC flow control</h1>
              <p className="sub">Two levels of credit, not one: every stream has its own window, and they all share a connection window. A DATA frame needs credit on both. Drain the shared connection window and watch a stream starve even while it still holds its own credit — until a MAX_DATA refills the pool.</p>
            </header>
            <FlowCtlSection />
          </>
        )}

        {section === 'tso' && (
          <>
            <header>
              <h1>Memory consistency &amp; store buffers</h1>
              <p className="sub">Why two threads can both read the old value. Run the store-buffer litmus test under Sequential Consistency vs x86-TSO and watch the r0=r1=0 outcome — impossible when memory is strongly ordered — appear the moment store buffers enter the picture, then vanish again when you add a fence.</p>
            </header>
            <TsoSection />
          </>
        )}

        {section === 'ospf' && (
          <>
            <header>
              <h1>OSPF link-state routing</h1>
              <p className="sub">The opposite of distance-vector: every router floods one advertisement about its own links until all of them share an identical map of the network, then each runs Dijkstra over that map. Pick a source to see its shortest-path tree, and drag the link costs to watch the paths recompute.</p>
            </header>
            <LinkStateSection />
          </>
        )}

        {section === 'maxflow' && (
          <>
            <header>
              <h1>Max-flow / min-cut</h1>
              <p className="sub">How much can flow from source to sink through a capacitated network — and the bottleneck that limits it. Step through Edmonds-Karp: each augmenting path pushes its bottleneck along a shortest residual route, until none remains and the minimum cut reveals itself as the saturated edges leaving the reachable set.</p>
            </header>
            <MaxFlowSection />
          </>
        )}

        {section === 'ntt' && (
          <>
            <header>
              <h1>The Number-Theoretic Transform</h1>
              <p className="sub">The FFT done in a finite field — the engine that makes lattice cryptography (Kyber/ML-KEM, Dilithium) fast. Multiply two polynomials by transforming both to the evaluation domain, multiplying pointwise, and transforming back — then watch it match the schoolbook negacyclic product exactly.</p>
            </header>
            <NttSection />
          </>
        )}

        {section === 'bwt' && (
          <>
            <header>
              <h1>Burrows-Wheeler Transform</h1>
              <p className="sub">A reversible permutation that scrambles a string yet makes it far more compressible — the heart of bzip2. Sort every rotation, read the last column, and watch the inverse rebuild the original exactly. The clustering meter shows why it helps the compressor that runs after it.</p>
            </header>
            <BwtSection />
          </>
        )}

        {section === 'taillatency' && (
          <>
            <header>
              <h1>Tail latency &amp; percentiles</h1>
              <p className="sub">Why the average response time is a lie at scale. Watch p99 pull away from the median as the tail grows, then fan one request out to many servers and see a “rare” per-server tail become near-certain — and how hedged requests claw it back.</p>
            </header>
            <TailLatencySection />
          </>
        )}

        {section === 'hdrhist' && (
          <>
            <header>
              <h1>HdrHistogram — measuring the tail</h1>
              <p className="sub">How you record latencies and read back p50/p99/p99.9 without storing every sample. Log-linear buckets give constant relative resolution across microseconds to seconds, in fixed memory no matter how many samples. Generate a heavy-tailed latency stream and watch the percentiles — and the memory footprint stay tiny.</p>
            </header>
            <HdrHistSection />
          </>
        )}

        {section === 'ddsketch' && (
          <>
            <header>
              <h1>DDSketch — relative-error quantiles</h1>
              <p className="sub">A streaming quantile sketch that answers "what's my p99?" with a guaranteed relative error in tiny, mergeable memory. Values are bucketed on a logarithmic scale — edges a constant factor γ=(1+α)/(1−α) apart — so every estimate is within α of the truth at any magnitude, from microseconds to minutes. Drag the accuracy knob and watch the estimate stay inside the guarantee while the bucket count shrinks.</p>
            </header>
            <DdSketchSection />
          </>
        )}

        {section === 'watermark' && (
          <>
            <header>
              <h1>Stream watermarks &amp; late events</h1>
              <p className="sub">How a streaming engine handles events that arrive out of order and late. A watermark — max event-time minus an allowed-lateness slack — is the engine's promise that it has seen everything up to that point; a window fires the moment the watermark passes its end, and anything later is dropped. Step the arrivals and tune the lateness to trade latency against tolerance.</p>
            </header>
            <WatermarkSection />
          </>
        )}

        {section === 'mst' && (
          <>
            <header>
              <h1>Minimum spanning tree</h1>
              <p className="sub">The cheapest set of edges that connects every node. Step through Kruskal (add the cheapest edge that doesn’t close a cycle) or Prim (grow one tree outward) and watch two different greedy strategies land on the same minimum-weight tree.</p>
            </header>
            <MstSection />
          </>
        )}

        {section === 'cfs' && (
          <>
            <header>
              <h1>Linux CFS scheduler</h1>
              <p className="sub">How Linux shared the CPU fairly for ~15 years. Each task carries a virtual runtime; CFS always runs the one that has had the least. Set nice values and run it — watch niced-down tasks fall behind in vruntime and the achieved CPU share converge to the weight-proportional ideal.</p>
            </header>
            <CfsSection />
          </>
        )}

        {section === 'priorityinv' && (
          <>
            <header>
              <h1>Priority inversion — the Mars Pathfinder bug</h1>
              <p className="sub">How a low-priority task can indirectly starve a high-priority one. The low task holds a lock the high task needs; a medium task that needs no lock preempts the low task, so it can't release — and the high task is stuck behind medium work. See it on two Gantt timelines, and watch priority inheritance bound the delay.</p>
            </header>
            <PriorityInvSection />
          </>
        )}

        {section === 'pipeline' && (
          <>
            <header>
              <h1>Pipeline hazards &amp; forwarding</h1>
              <p className="sub">Why a CPU can’t just start one instruction every cycle. Edit an instruction stream and toggle forwarding: watch dependent instructions shift right (that gap is a stall), the ALU chain snap back-to-back once bypassing is on, and the load-use hazard that even forwarding can’t avoid.</p>
            </header>
            <PipelineSection />
          </>
        )}

        {section === 'scc' && (
          <>
            <header>
              <h1>Strongly connected components</h1>
              <p className="sub">The maximal groups of nodes where everyone can reach everyone, found by Kosaraju’s two-pass DFS. Nodes are coloured by their component; collapse each to a point and you get the condensation — always a DAG, the cycle-free skeleton of the graph.</p>
            </header>
            <SccSection />
          </>
        )}

        {section === 'cycledetect' && (
          <>
            <header>
              <h1>Cycle detection — Floyd's tortoise &amp; hare</h1>
              <p className="sub">Find a loop in a chain using O(1) memory. Two pointers walk a ρ-shaped graph — one slow, one twice as fast — until the hare laps the tortoise inside the loop; a second phase then finds exactly where the loop begins. Step through both phases and watch the pointers meet, with the same trick that powers Pollard's rho factorization.</p>
            </header>
            <CycleDetectSection />
          </>
        )}

        {section === 'queryplan' && (
          <>
            <header>
              <h1>Cost-based query planner</h1>
              <p className="sub">Three tables, six join orders, costs that differ by ~100×. Drag a predicate’s selectivity and watch the optimizer’s ranking flip — joining the most selective edge first keeps every intermediate result tiny. Click any plan to see its left-deep tree and the rows it would materialize.</p>
            </header>
            <QueryPlanSection />
          </>
        )}

        {section === 'rum' && (
          <>
            <header>
              <h1>The RUM conjecture</h1>
              <p className="sub">Read, Update, Memory — a storage engine can optimize at most two; the third pays. Drag the dataset size and LSM size ratio and watch the B-tree keep reads cheap, leveled-LSM keep space tight, and tiered-LSM keep writes cheap — each blowing up the dimension it sacrifices.</p>
            </header>
            <RumSection />
          </>
        )}

        {section === 'arith' && (
          <>
            <header>
              <h1>Arithmetic coding</h1>
              <p className="sub">How to beat Huffman’s one-whole-bit-per-symbol floor: encode the entire message as a single number in [0,1) by narrowing an interval symbol by symbol. The coded width is the product of the symbol probabilities, so the bit cost reaches the entropy — and the decode line proves it round-trips.</p>
            </header>
            <ArithSection />
          </>
        )}

        {section === 'swim' && (
          <>
            <header>
              <h1>SWIM failure detection</h1>
              <p className="sub">How a cluster decides a node is dead without false alarms or all-to-all heartbeating. Cut the direct link but leave a helper up and the target stays alive (indirect ping-req); cut everything and it goes suspect, then dead — unless it refutes with a higher incarnation number.</p>
            </header>
            <SwimSection />
          </>
        )}

        {section === 'ahocorasick' && (
          <>
            <header>
              <h1>Aho-Corasick multi-pattern matching</h1>
              <p className="sub">Find every occurrence of many patterns in one pass. The automaton is a trie of the dictionary plus failure links; step through the text and watch the state follow a child edge when it can and jump a failure link when it can’t, lighting up matches as whole patterns complete — the engine behind fgrep and intrusion detection.</p>
            </header>
            <AhoCorasickSection />
          </>
        )}

        {section === 'floyd' && (
          <>
            <header>
              <h1>Floyd-Warshall all-pairs shortest paths</h1>
              <p className="sub">Shortest paths between every pair of vertices in one cubic dynamic program. Step through the intermediate vertices and watch the distance matrix relax — each cell taking the cheaper of what it had and routing through the current waypoint. Handles negative edges, and flags a negative cycle.</p>
            </header>
            <FloydSection />
          </>
        )}

        {section === 'bellmanford' && (
          <>
            <header>
              <h1>Bellman-Ford &amp; arbitrage detection</h1>
              <p className="sub">The shortest-path algorithm that survives negative edges — and detects the negative cycles where "shortest" breaks down. Step the relaxation passes to watch distances settle on a graph Dijkstra would get wrong, then turn the same machinery into a currency-arbitrage detector: model each rate as −ln(rate) and a profitable trading loop becomes a negative cycle.</p>
            </header>
            <BellmanFordSection />
          </>
        )}

        {section === 'leakybucket' && (
          <>
            <header>
              <h1>Leaky bucket traffic shaping</h1>
              <p className="sub">Turn a bursty arrival stream into a perfectly smooth output. Packets pour into a bucket and drain at a fixed rate; bursts are absorbed up to the bucket's capacity and whatever overflows is dropped. The output never rises above the leak rate — the opposite trade-off from the token bucket, which lets saved-up bursts through.</p>
            </header>
            <LeakyBucketSection />
          </>
        )}

        {section === 'gcra' && (
          <>
            <header>
              <h1>GCRA — rate limiting with a single timestamp</h1>
              <p className="sub">The Generic Cell Rate Algorithm: the rate limiter behind Redis-Cell and many API gateways, which does everything a token bucket does with just one number of state per client — a "theoretical arrival time." A request is allowed if it arrives no earlier than TAT − τ; if so the TAT jumps forward by T. Idle time banks burst; sending too fast pushes the TAT past your clock until you're throttled, and the gap is your exact Retry-After. Drag the cadence and watch the one-line state throttle the stream.</p>
            </header>
            <GcraSection />
          </>
        )}

        {section === 'dram' && (
          <>
            <header>
              <h1>How RAM works — DRAM, rows &amp; the row buffer</h1>
              <p className="sub">Main memory is a grid of leaky capacitors that must be refreshed 64 times a second. An access decodes a physical address into (bank, row, column), activates the row into a one-row-wide buffer, then reads a column out. That buffer is a cache — so sequential access hits the open row and flies, while random access keeps conflicting and paying a precharge. Decode an address and run access patterns to see the 3× latency swing.</p>
            </header>
            <DramSection />
          </>
        )}

        {section === 'adder' && (
          <>
            <header>
              <h1>The binary adder — how gates do arithmetic</h1>
              <p className="sub">Every sum a CPU computes is built from one tiny circuit: the full adder (two bits plus a carry in gives a sum bit and a carry out). Chain eight of them and the carry ripples from the low bit up, exactly like carrying in decimal. Drag two numbers and watch the carry propagate, then see why the worst case (255 + 1, a full ripple) is the delay that pushes real ALUs to carry-lookahead.</p>
            </header>
            <AdderSection />
          </>
        )}

        {section === 'latch' && (
          <>
            <header>
              <h1>The flip-flop — how a circuit remembers a bit</h1>
              <p className="sub">The adder forgets; memory needs feedback. Cross-couple two NOR gates and the pair locks into a stable 0 or 1 and holds it. That is an SR latch. Add a clock edge and you get a D flip-flop, the storage element behind CPU registers and SRAM cache. Set, reset, and hold a latch, then clock a flip-flop and watch it capture data only on the rising edge.</p>
            </header>
            <LatchSection />
          </>
        )}

        {section === 'alu' && (
          <>
            <header>
              <h1>The ALU — how a CPU computes</h1>
              <p className="sub">The arithmetic logic unit is the adder plus a few logic gates, with a multiplexer that an opcode uses to pick which result to keep. It computes add, subtract, and, or, xor, shifts, and compare all at once and selects one, raising the Z/N/C/V flags that turn a comparison into a branch. Pick an operation and two operands and watch the result and flags.</p>
            </header>
            <AluSection />
          </>
        )}

        {section === 'membus' && (
          <>
            <header>
              <h1>Address decoding &amp; the memory bus</h1>
              <p className="sub">ROM, RAM, and every I/O device sit on one shared address and data bus. When the CPU puts out an address, exactly one chip must answer — address decoding reads the high bits and asserts a single chip-select line, waking one device and keeping the rest off the bus. This is also why I/O is memory-mapped: a device is just an address range. Type an address and watch the decoder pick the chip.</p>
            </header>
            <MemBusSection />
          </>
        )}

        {section === 'io' && (
          <>
            <header>
              <h1>Polling, interrupts &amp; DMA — how the CPU talks to devices</h1>
              <p className="sub">A disk or network card has bytes for memory. The CPU can poll (spin on a status register and copy each byte — simple but 100% busy), take an interrupt per byte (free between bytes but a fixed overhead each — a fast stream drowns it), or hand off to a DMA controller (program it once, get one interrupt at the end — constant CPU cost no matter the size). Slide the transfer size and watch where the CPU's time goes.</p>
            </header>
            <IoSection />
          </>
        )}

        {section === 'ssd' && (
          <>
            <header>
              <h1>How an SSD works — flash &amp; the FTL</h1>
              <p className="sub">Flash reads and writes a page but can only erase a whole block, and a page can't be overwritten in place. So an SSD never overwrites: the flash translation layer writes a fresh page, remaps it, and marks the old one stale, then garbage-collects blocks to reclaim space. That copying is write amplification, and erases are spread for wear leveling. Write pages and watch the FTL, GC, and wear play out.</p>
            </header>
            <SsdSection />
          </>
        )}

        {section === 'gpu' && (
          <>
            <header>
              <h1>GPU / SIMT — how parallel compute wins or stalls</h1>
              <p className="sub">A GPU runs threads in lockstep groups of 32 (a warp), all executing the same instruction each cycle. That makes it brilliant at data-parallel work and brittle in two ways: a branch that splits a warp serializes both paths (divergence), and scattered memory accesses explode into many transactions instead of one (coalescing). Pick a branch pattern and a memory access pattern and watch efficiency soar or collapse.</p>
            </header>
            <GpuSection />
          </>
        )}

        {section === 'cpucache' && (
          <>
            <header>
              <h1>The CPU cache — sets, ways &amp; the address split</h1>
              <p className="sub">The small fast SRAM that hides main memory's ~100 ns latency behind ~1 ns hits, by exploiting locality. A physical address splits into tag / set-index / byte-offset; the index picks a set, and the tag is compared against every way in it — a hit is fast, a miss fetches the 64-byte line and evicts the least-recently-used way. Change the associativity and run access patterns to watch conflict misses appear on a direct-mapped cache and vanish on a set-associative one.</p>
            </header>
            <CpuCacheSection />
          </>
        )}

        {section === 'oooexec' && (
          <>
            <header>
              <h1>Out-of-order execution</h1>
              <p className="sub">Why a modern CPU runs your instructions in a different order than you wrote them — and still gets the right answer. An in-order core stalls everything behind a cache-missing load; an out-of-order core issues each instruction the moment its inputs are ready, and register renaming removes false dependencies so only true data dependencies constrain it. Results still retire in program order. Edit a program and watch independent work slide under a load stall.</p>
            </header>
            <OooExecSection />
          </>
        )}

        {section === 'rope' && (
          <>
            <header>
              <h1>The rope — how editors edit huge text fast</h1>
              <p className="sub">Inserting a character in the middle of a flat string is O(n) — every later byte shifts. A rope stores the document as the leaves of a balanced tree, where each internal node caches the length of its left subtree, so index, split, insert, and delete are all O(log n). Edits rewrite only one root-to-leaf path, and because nodes are immutable and shared, every past version stays alive for free undo. Edit the text and watch the tree splice.</p>
            </header>
            <RopeSection />
          </>
        )}

        {section === 'gapbuffer' && (
          <>
            <header>
              <h1>The gap buffer — how Emacs edits text</h1>
              <p className="sub">The whole document lives in one array with a run of empty slots — the gap — parked at the cursor. Typing drops a character into the gap in O(1), no shifting. Backspace and delete-forward just grow the gap. The only costly move is relocating the cursor, which slides the gap there by copying the characters it passes over (O(distance)). It bets that edits cluster at one point — and usually wins. Type, delete, and drag the cursor to watch the gap move.</p>
            </header>
            <GapBufferSection />
          </>
        )}

        {section === 'fastinvsqrt' && (
          <>
            <header>
              <h1>The fast inverse square root</h1>
              <p className="sub">The most famous 20 lines in game programming — Quake III's trick for computing 1/√x with no sqrt and no division. A float's raw bits, read as an integer, are almost exactly a scaled log₂(x); so a single integer subtraction from the magic constant 0x5f3759df computes x^(−1/2) in log space, and one Newton step polishes the ~3.4% guess to ~0.17%. Pick x and watch the bits become the answer.</p>
            </header>
            <FastInvSqrtSection />
          </>
        )}

        {section === 'kahan' && (
          <>
            <header>
              <h1>Kahan summation — adding floats without losing accuracy</h1>
              <p className="sub">A float has ~15–16 significant digits, so adding a small number to a large running total drops the small one's low bits — sum a million values and the lost bits become a real error. Kahan summation carries a compensation term that remembers what each addition dropped and folds it back, keeping the error near one rounding unit no matter how many terms. Watch the naive total drift while Kahan stays pinned to the true sum.</p>
            </header>
            <KahanSumSection />
          </>
        )}

        {section === 'karatsuba' && (
          <>
            <header>
              <h1>Karatsuba multiplication — beating n²</h1>
              <p className="sub">Schoolbook multiplication of two n-digit numbers costs n² single-digit multiplies. In 1960 Karatsuba found you only need three half-size products, not four — because the middle term ad+bc equals (a+b)(c+d) − ac − bd. Recurse and n² collapses to n^1.585, which is why every big-integer library (and thus RSA/ECC key math) uses it. Enter two numbers and watch the recursion split into threes.</p>
            </header>
            <KaratsubaSection />
          </>
        )}

        {section === 'simanneal' && (
          <>
            <header>
              <h1>Simulated annealing — escaping local minima</h1>
              <p className="sub">Greedy optimization always moves downhill, so it gets trapped in the first local minimum it finds. Simulated annealing borrows from metallurgy: keep a temperature that starts high and cools, accepting uphill moves with probability exp(−ΔE/T) so the search can climb out of traps early, then settle as it cools. It's the workhorse for rugged combinatorial problems — chip placement, routing, scheduling. Watch greedy get stuck while annealing reaches the deep valley (change the seed — it's probabilistic).</p>
            </header>
            <SimAnnealSection />
          </>
        )}

        {section === 'hamming' && (
          <>
            <header>
              <h1>Hamming(7,4) — error correction that points at the mistake</h1>
              <p className="sub">The first error-correcting code (Hamming, 1950). Four data bits become a seven-bit codeword with parity bits at positions 1, 2, 4. Each parity bit checks the positions whose index has that bit set, so the three checks together read out the binary index of any single flipped bit — the syndrome is the error's address. Toggle the data, corrupt a bit in transit, and watch the code locate and fix it.</p>
            </header>
            <HammingSection />
          </>
        )}

        {section === 'bresenham' && (
          <>
            <header>
              <h1>Bresenham's line algorithm — drawing with integers</h1>
              <p className="sub">How a computer draws a straight line on a grid of pixels (Bresenham, IBM, 1962). The naive way computes y = y0 + slope·(x−x0) and rounds — a floating-point multiply per pixel. Bresenham tracks a single integer error term and decides each step with only additions and comparisons, lighting up the exact same pixels with no multiply, divide, float, or round. Still in every GPU. Click the grid to move the endpoint.</p>
            </header>
            <BresenhamSection />
          </>
        )}

        {section === 'convexhull' && (
          <>
            <header>
              <h1>Convex hull — the rubber band around your points</h1>
              <p className="sub">The smallest convex polygon enclosing a set of points — the shape a rubber band makes snapped around a bed of nails. Andrew's monotone chain sorts the points, then sweeps once for the lower hull and once for the upper, using the cross product (turn left / right / straight — no trig) to pop any point that would make a dent. O(n log n), and that's optimal. Click to add points and watch the hull re-form.</p>
            </header>
            <ConvexHullSection />
          </>
        )}

        {section === 'marchsquares' && (
          <>
            <header>
              <h1>Marching squares — grid of numbers to smooth contour</h1>
              <p className="sub">How you turn a scalar field (elevation, brightness, density) into the contour line where it equals a threshold — the coastline between above and below. Each cell's four corners give one of 16 cases; the contour crosses the edges separating an above corner from a below one, cut at the linear-interpolated crossing for smoothness. Every cell is independent (great for the GPU), and it's the 2-D sibling of marching cubes. Slide the threshold and watch the blobs merge.</p>
            </header>
            <MarchSquaresSection />
          </>
        )}

        {section === 'voronoi' && (
          <>
            <header>
              <h1>Voronoi diagram — the plane split by nearest site</h1>
              <p className="sub">Carve a plane into one cell per site, where every point belongs to whichever site is nearest — the honeycomb you see in cracked mud, giraffe coats, and cell-tower coverage maps. Each boundary is the perpendicular bisector of two sites, so every cell is convex, and the whole diagram is the exact dual of the Delaunay triangulation. Click to add sites; switch the distance metric (Euclidean / Manhattan / Chebyshev) to reshape the cells.</p>
            </header>
            <VoronoiSection />
          </>
        )}

        {section === 'transistor' && (
          <>
            <header>
              <h1>Transistors &rarr; logic gates</h1>
              <p className="sub">The bottom of the stack. A transistor is a voltage-controlled switch: NMOS conducts when its gate is high, PMOS when low. Wire a PMOS pull-up and NMOS pull-down together and you get a CMOS gate — an inverter, a NAND, a NOR. And NAND alone is universal: every other gate is built from it. Toggle inputs to watch the transistors conduct, then build any gate from NAND. Everything above — the adder, the ALU, the flip-flop — is just billions of these.</p>
            </header>
            <TransistorSection />
          </>
        )}

        {section === 'knapsack' && (
          <>
            <header>
              <h1>0/1 Knapsack (dynamic programming)</h1>
              <p className="sub">Pick a subset of items to maximize value within a weight budget — where greedy fails and DP wins. Watch the table fill row by row, read the answer off the bottom-right corner, and follow the highlighted backtrack path to see which items were chosen. The greedy-by-ratio result is shown losing alongside.</p>
            </header>
            <KnapsackSection />
          </>
        )}

        {section === 'deployments' && (
          <>
            <header>
              <h1>Deployment strategies</h1>
              <p className="sub">How you ship v2 without taking the service down — and the risk/speed/cost trade-offs between them. Step through recreate, rolling, blue-green, and canary: watch the fleet flip versions, the router split traffic, and the availability meter reveal who feels the rollout.</p>
            </header>
            <DeployStratSection />
          </>
        )}

        {section === 'healthcheck' && (
          <>
            <header>
              <h1>Liveness vs readiness probes</h1>
              <p className="sub">The Kubernetes distinction that, gotten wrong, causes restart storms. Readiness decides whether a pod gets traffic; liveness decides whether it gets killed and restarted. Step through scenarios — including the anti-pattern where a slow-under-load check on the liveness probe crashloops the whole fleet.</p>
            </header>
            <HealthCheckSection />
          </>
        )}

        {section === 'autoscale' && (
          <>
            <header>
              <h1>Horizontal autoscaling (HPA)</h1>
              <p className="sub">How a service grows and shrinks its replica count to track load, from one simple formula: desired = ceil(replicas × metric / target). Step through a load series and watch replicas chase demand — scaling up instantly, scaling down only after a stabilization window rides out brief dips.</p>
            </header>
            <AutoscaleSection />
          </>
        )}

        {section === 'usl' && (
          <>
            <header>
              <h1>Universal Scalability Law</h1>
              <p className="sub">Why adding workers eventually stops helping — and then starts hurting. Amdahl's law says a serial fraction caps speedup; the USL adds a coherency term for the coordination cost between workers (which grows with the number of pairs, ∝ N²), so throughput peaks at an optimal concurrency and goes retrograde past it. Drag contention α and coherency β and watch the curve bend back down.</p>
            </header>
            <UslSection />
          </>
        )}

        {section === 'pid' && (
          <>
            <header>
              <h1>PID controller</h1>
              <p className="sub">The feedback loop behind cruise control, thermostats, drones — and, increasingly, autoscaling and congestion control. It drives a process to a setpoint from three terms on the error: proportional (fast, but leaves a droop), integral (erases the droop), derivative (damps overshoot). Tune Kp, Ki, Kd and watch a positioning system overshoot, droop, or settle cleanly — the same trade-offs that make aggressive autoscaling oscillate.</p>
            </header>
            <PidSection />
          </>
        )}

        {section === 'slo' && (
          <>
            <header>
              <h1>SLOs &amp; error budgets</h1>
              <p className="sub">The math that turns "be reliable" into a number you can spend. Pick an availability target, see the error budget it buys (downtime allowed per month), and watch the release policy flip from "ship" to "freeze" when it runs out. The burn-rate panel turns a current error rate into how fast you're spending and which alerts page you.</p>
            </header>
            <SloSection />
          </>
        )}

        {section === 'tracing' && (
          <>
            <header>
              <h1>Distributed tracing</h1>
              <p className="sub">Follow one request as it fans out across services, and see where the time actually went. Each span is a bar on the waterfall — positioned by when it started, indented by call depth — and the self-time breakdown points straight at the real bottleneck instead of a guess.</p>
            </header>
            <TracingSection />
          </>
        )}

        {section === 'featureflags' && (
          <>
            <header>
              <h1>Feature flags</h1>
              <p className="sub">Decouple deploy from release: the code already shipped, so turning a feature on is a config change that takes effect in seconds. Drag the rollout and watch users flip on in a stable order, force a cohort on with a targeting rule, or hit the kill switch and everyone goes off instantly — no redeploy.</p>
            </header>
            <FeatureFlagSection />
          </>
        )}

        {section === 'gracefulshutdown' && (
          <>
            <header>
              <h1>Graceful shutdown &amp; connection draining</h1>
              <p className="sub">How to take an instance down without dropping the requests it's already serving. SIGTERM lands; fail readiness so new traffic stops, drain in-flight requests, then exit. Drag the grace period below your longest request and watch the orchestrator force-kill the stragglers into 5xxs — the unglamorous half of every zero-downtime claim.</p>
            </header>
            <GracefulShutdownSection />
          </>
        )}

        {section === 'idempotency' && (
          <>
            <header>
              <h1>Idempotency keys</h1>
              <p className="sub">How an API makes "charge $100" safe to retry. The network only promises at-least-once delivery, so clients retry lost requests — and without protection, the retry charges again. Watch the same scenario run down two paths: without a key it double-charges; with a key the server replays the stored result, exactly once.</p>
            </header>
            <IdempotencySection />
          </>
        )}

        {section === 'loadshed' && (
          <>
            <header>
              <h1>Load shedding &amp; backpressure</h1>
              <p className="sub">Under overload, rejecting work fast beats queuing it. Same demand, two servers: one with a bounded queue that sheds the excess, one that queues everything. Drag the offered load past the service rate and watch the unbounded server's backlog explode into congestion collapse while the shedding one holds steady useful throughput.</p>
            </header>
            <LoadShedSection />
          </>
        )}

        {section === 'bulkhead' && (
          <>
            <header>
              <h1>Bulkhead isolation</h1>
              <p className="sub">Why one slow dependency can take down your whole service — and how per-dependency resource pools contain the damage. From a shared thread pool, a sick dependency's piled-up requests consume every slot, starving healthy calls too. Drag a dependency's latency up and compare a shared pool (total outage) to bulkheads (only the sick one degrades).</p>
            </header>
            <BulkheadSection />
          </>
        )}

        {section === 'chaos' && (
          <>
            <header>
              <h1>Chaos engineering</h1>
              <p className="sub">Deliberately break one thing to discover how far the damage spreads — and prove your resilience contains it. Click a service to kill it and watch the failure cascade; a hard dependency drags its callers down, a resilient one absorbs it. Flip on resilience shields and watch the blast radius shrink.</p>
            </header>
            <ChaosSection />
          </>
        )}

        {section === 'singleflight' && (
          <>
            <header>
              <h1>Request coalescing (singleflight)</h1>
              <p className="sub">Stopping a cache miss from becoming a stampede. When a hot key expires, every concurrent request misses at once and they all hit the backend for the same value. Singleflight lets the first compute it while the rest wait and share the result — N simultaneous misses become one backend call.</p>
            </header>
            <SingleFlightSection />
          </>
        )}

        {section === 'branchpredict' && (
          <>
            <header>
              <h1>Branch prediction</h1>
              <p className="sub">How a CPU guesses which way a branch goes before it knows, so the pipeline doesn't stall. Step a 2-bit saturating counter through a branch-outcome pattern and watch the hysteresis at work — then compare its mispredictions against a 1-bit predictor on the loop-exit pattern, where the extra bit halves the misses.</p>
            </header>
            <BranchPredictSection />
          </>
        )}

        {section === 'spectre' && (
          <>
            <header>
              <h1>Spectre — leaking secrets through speculation</h1>
              <p className="sub">How the 2018 attack reads memory it isn't allowed to, by abusing speculative execution. The CPU runs ahead past a bounds check it mispredicts, speculatively reads a secret byte, and leaves a trace in the cache — which timing (Flush+Reload) then recovers. Step through the leak and watch the secret appear byte by byte, then flip on the lfence barrier and watch it stop.</p>
            </header>
            <SpectreSection />
          </>
        )}

        {section === 'boyermoore' && (
          <>
            <header>
              <h1>Boyer-Moore string search</h1>
              <p className="sub">The matcher that gets faster on longer patterns by skipping ahead. Comparing from the right end, a mismatch slides the pattern forward by the bad-character rule — often leaping several characters, or a whole pattern length when the text character isn't in the pattern at all. Step through it and watch the comparisons stay far below a naive scan.</p>
            </header>
            <BoyerMooreSection />
          </>
        )}

        {section === 'newton' && (
          <>
            <header>
              <h1>Newton's method</h1>
              <p className="sub">Find where a function crosses zero by following its tangent. From a guess, the tangent line's x-intercept becomes the next guess — homing in on the root with quadratic convergence, the correct digits roughly doubling each step. Step through it and watch a handful of iterations reach machine precision.</p>
            </header>
            <NewtonSection />
          </>
        )}

        {section === 'cow' && (
          <>
            <header>
              <h1>Copy-on-write fork</h1>
              <p className="sub">Why fork() is cheap even for a process using gigabytes. Instead of copying memory up front, the child shares the parent's pages read-only; only a write to a shared page faults and copies that one page. Fork, then write pages and watch them diverge — or exec the child and watch nothing get copied at all.</p>
            </header>
            <CowSection />
          </>
        )}

        {section === 'mtf' && (
          <>
            <header>
              <h1>Move-to-front coding</h1>
              <p className="sub">The stage between the Burrows-Wheeler transform and the entropy coder in bzip2. Keep a list of the alphabet; encode each symbol as its current index, then move it to the front — so a run of the same character collapses into a run of zeros, the small-number stream that makes the BWT so compressible.</p>
            </header>
            <MtfSection />
          </>
        )}

        {section === 'cdc' && (
          <>
            <header>
              <h1>Content-defined chunking &amp; dedup</h1>
              <p className="sub">How rsync, restic and ZFS avoid re-sending data that barely changed. Split a file into chunks and store each only once — but cut in the wrong place and a one-byte edit shifts every boundary, so nothing dedupes. Edit the text and watch fixed-size chunking turn entirely "new" while content-defined boundaries, set by a rolling hash, keep almost every chunk reusable.</p>
            </header>
            <CdcSection />
          </>
        )}

        {section === 'rsync' && (
          <>
            <header>
              <h1>rsync — delta file sync</h1>
              <p className="sub">Sync a changed file to a remote copy by sending only the differences — without either side seeing the other's data first. The receiver sends block checksums of its old file; the sender rolls a window over the new file, matching whole blocks by a checksum it updates one byte at a time, and emits a delta of copy-references and literal runs. Because it searches at every offset, an insertion near the start doesn't ruin the rest — the window re-aligns. Edit the files and watch the delta.</p>
            </header>
            <RsyncSection />
          </>
        )}

        {section === 'tlb' && (
          <>
            <header>
              <h1>The TLB (translation lookaside buffer)</h1>
              <p className="sub">The cache that makes virtual memory fast by avoiding the page-table walk. A loop touches a working set of pages; step through it and watch hits resolve in a cycle while misses pay for the walk. Drag the working set past the TLB size and watch the hit rate fall off a cliff — thrashing.</p>
            </header>
            <TlbSection />
          </>
        )}

        {section === 'numa' && (
          <>
            <header>
              <h1>NUMA &amp; first-touch placement</h1>
              <p className="sub">On a multi-socket machine, memory has an address AND a home node — and a core pays extra to reach another node's RAM. Linux places a page on the node of the core that first writes it, so initializing a big array from one thread pins it all to one socket. Switch between serial, parallel, and interleaved init and watch the accesses turn local or cross the interconnect.</p>
            </header>
            <NumaSection />
          </>
        )}

        {section === 'buddyalloc' && (
          <>
            <header>
              <h1>Buddy allocator</h1>
              <p className="sub">How the Linux kernel's page allocator hands out and reclaims memory: every block is a power of two, a request rounds up and splits a larger free block in half until it fits, and freeing a block instantly coalesces with its "buddy" (at offset XOR size) back into a larger block. Allocate and free, and watch splitting, coalescing, and fragmentation happen live.</p>
            </header>
            <BuddyAllocSection />
          </>
        )}

        {section === 'timingwheel' && (
          <>
            <header>
              <h1>Timing wheel</h1>
              <p className="sub">How systems that manage millions of timers (the Linux kernel, Kafka, Netty) schedule them in O(1) instead of a heap's O(log n). A circular array of buckets and a hand that advances one tick at a time; a timer for "d ticks from now" drops straight into bucket (current + d) mod N — no sorting. Schedule timers and tick the hand around to watch them fire, with a rounds counter for delays beyond one revolution.</p>
            </header>
            <TimingWheelSection />
          </>
        )}

        {section === 'epoll' && (
          <>
            <header>
              <h1>epoll &amp; the C10k problem</h1>
              <p className="sub">How one thread watches 10,000 sockets. select/poll re-scan every file descriptor on each call — O(n) even when one is active — the wall that capped servers at ~10k clients. epoll keeps a kernel ready-list and returns only fds with events: O(active). Drag the connection count to see the gap, then meet the edge-triggered gotcha that strands data if you don't drain fully.</p>
            </header>
            <EpollSection />
          </>
        )}

        {section === 'futex' && (
          <>
            <header>
              <h1>futex — the fast userspace mutex</h1>
              <p className="sub">Why a modern mutex is nearly free when uncontended. The lock word lives in userspace, so locking a free mutex or unlocking one with no waiters is a single atomic compare-and-swap — no system call. Only blocking on a held lock or waking a waiter traps into the kernel. Pick a workload and watch which operations stay in userspace and which pay for the kernel.</p>
            </header>
            <FutexSection />
          </>
        )}

        {section === 'rcu' && (
          <>
            <header>
              <h1>RCU — Read-Copy-Update</h1>
              <p className="sub">The Linux kernel's trick for near-free reads of shared data. Readers take no lock and never block; a writer copies the data, modifies the copy, and atomically publishes it — then waits out a grace period before freeing the old version, so no reader is ever left holding a freed pointer. Add readers, run writer updates, and watch old versions linger until their last reader leaves.</p>
            </header>
            <RcuSection />
          </>
        )}

        {section === 'aba' && (
          <>
            <header>
              <h1>The ABA problem</h1>
              <p className="sub">The subtle bug that makes lock-free programming hard. Compare-and-swap checks that a value is the same, not that it never changed — so if another thread cycles it A → B → A while you're preempted, your CAS is fooled into succeeding on a world that moved underneath it, splicing a freed node back into a stack. Toggle a plain CAS versus a versioned (tagged) CAS and watch one corrupt and the other stay safe.</p>
            </header>
            <AbaSection />
          </>
        )}

        {section === 'seqlock' && (
          <>
            <header>
              <h1>The seqlock (sequence lock)</h1>
              <p className="sub">How the kernel lets millions of readers per second read a multi-word value (like the clock) without locking or blocking — while a writer updates it. The writer brackets its update with an odd-then-even counter; a reader snapshots the counter, reads the data, and re-checks — retrying if the counter was odd or changed. Step through an interleaving and watch a naive read tear while the seqlock read retries; proven across all 70 interleavings.</p>
            </header>
            <SeqlockSection />
          </>
        )}

        {section === 'iouring' && (
          <>
            <header>
              <h1>io_uring — async I/O without the syscalls</h1>
              <p className="sub">The modern Linux I/O interface that leaves epoll behind on syscall cost. You fill a shared submission ring with many requests and hand them to the kernel with one io_uring_enter; it does the I/O asynchronously and posts results to a completion ring you read with no syscall. Compare the syscall counts across models, then step the submission/completion ring loop.</p>
            </header>
            <IoUringSection />
          </>
        )}

        {section === 'bakery' && (
          <>
            <header>
              <h1>Lamport's bakery algorithm</h1>
              <p className="sub">Mutual exclusion using only atomic reads and writes — no test-and-set, no hardware lock. Threads take a bakery ticket one higher than anyone waiting and are served lowest-number-first; since taking a number isn't atomic, ties can happen and are broken by thread id, giving a total order with exactly one winner. Choose how the threads arrive and watch who enters the critical section.</p>
            </header>
            <BakerySection />
          </>
        )}

        {section === 'suffixarray' && (
          <>
            <header>
              <h1>Suffix array</h1>
              <p className="sub">A sorted index of every suffix of a string — the workhorse behind fast full-text search. Because the suffixes are sorted, all occurrences of a pattern form one contiguous block; type a pattern and watch that block (and the matching text positions) light up, found by binary search in O(m log n).</p>
            </header>
            <SuffixArraySection />
          </>
        )}

        {section === 'manacher' && (
          <>
            <header>
              <h1>Manacher's algorithm — longest palindrome in O(n)</h1>
              <p className="sub">Find the longest palindromic substring in linear time. The trick: interleave separators so even and odd palindromes look alike, then give every position a radius — and reuse the radii that mirror symmetry already guarantees, so new character comparisons only ever push the frontier right. Type a string and watch the radius bars and the palindrome it picks.</p>
            </header>
            <ManacherSection />
          </>
        )}

        {section === 'zalgo' && (
          <>
            <header>
              <h1>The Z-algorithm — linear-time string matching</h1>
              <p className="sub">One elegant array finds every occurrence of a pattern in a text in linear time. Z[i] measures how much of the string's prefix reappears at position i; run it over "pattern § text" and every spot where Z ≥ |pattern| is a match. Type a pattern and text and watch the Z-values light up the matches — overlaps included.</p>
            </header>
            <ZalgoSection />
          </>
        )}

        {section === 'fft' && (
          <>
            <header>
              <h1>The Fast Fourier Transform</h1>
              <p className="sub">Turn a signal between time (samples) and frequency (how much of each tone it contains), in O(n log n). Build a signal by mixing a few cosine frequencies and watch the FFT pull them back apart — a sharp peak at exactly each frequency you added. The same butterfly as the NTT, but over complex numbers.</p>
            </header>
            <FftSection />
          </>
        )}

        {section === 'ssrf' && (
          <>
            <header>
              <h1>SSRF — server-side request forgery</h1>
              <p className="sub">When an app fetches a URL you control, point it inward. The server sits inside a trusted network, so "fetch this image" becomes "fetch the cloud metadata endpoint" — and out come the IAM credentials (the Capital One breach). Toggle SSRF protection and watch the dangerous fetches get blocked.</p>
            </header>
            <SsrfSection />
          </>
        )}

        {section === 'xxe' && (
          <>
            <header>
              <h1>XXE — XML external entity injection</h1>
              <p className="sub">XML lets a document define entities whose value is pulled from an external file or URL — so a parser that trusts attacker-uploaded XML will read /etc/passwd, fetch internal cloud metadata (SSRF), or blow up on self-referential entities (billion laughs DoS). It hides in SOAP, SAML, SVG, and DOCX uploads. Pick a variant, toggle the parser defenses, and see why disabling DTD processing is the one fix that stops them all.</p>
            </header>
            <XxeSection />
          </>
        )}

        {section === 'dnsrebind' && (
          <>
            <header>
              <h1>DNS rebinding</h1>
              <p className="sub">A browser attack that bypasses the same-origin policy by flipping a domain's DNS from the attacker's IP to 127.0.0.1 after the page loads — so the attacker's JavaScript can read your router admin, cloud metadata, or localhost dev server. The same-origin policy trusts the hostname; packets follow the IP. Toggle the three defenses and watch which layer stops it.</p>
            </header>
            <DnsRebindSection />
          </>
        )}

        {section === 'arpspoof' && (
          <>
            <header>
              <h1>ARP spoofing (LAN MITM)</h1>
              <p className="sub">The oldest man-in-the-middle trick on a local network. ARP has no authentication, so an attacker who announces "the gateway is at my MAC" poisons the victim's cache and reroutes all its traffic through themselves. Toggle static ARP entries, Dynamic ARP Inspection, and TLS, and watch the cache flip and the traffic get intercepted — or the defense that stops it.</p>
            </header>
            <ArpSpoofSection />
          </>
        )}

        {section === 'protopollute' && (
          <>
            <header>
              <h1>Prototype pollution</h1>
              <p className="sub">How attacker JSON with a <code>__proto__</code> key can change the behavior of objects it never touched. A naive deep-merge follows <code>__proto__</code> onto JavaScript's shared prototype, so a brand-new empty object suddenly inherits the attacker's properties — an auth bypass hiding in plain sight. Edit the payload, toggle vulnerable vs safe merge, and watch a fresh <code>{'{}'}</code> become admin. (Sandboxed — never touches the real prototype.)</p>
            </header>
            <ProtoPolluteSection />
          </>
        )}

        {section === 'saga' && (
          <>
            <header>
              <h1>The Saga pattern</h1>
              <p className="sub">How microservices pull off a "transaction" across services with separate databases — without holding distributed locks. A chain of local steps, each with a compensating undo; pick which step fails and watch the compensations fire in reverse for everything already committed, landing back in a consistent state.</p>
            </header>
            <SagaSection />
          </>
        )}

        {section === 'blindsig' && (
          <>
            <header>
              <h1>RSA blind signatures</h1>
              <p className="sub">Getting a valid signature on a message the signer never sees. The client blinds its message with a random factor; the signer signs the random-looking value blindly; the client divides the factor back out and is left with an ordinary signature that verifies — yet can't be linked to the signing session. The engine behind digital cash and Privacy Pass.</p>
            </header>
            <BlindSigSection />
          </>
        )}

        {section === 'vrf' && (
          <>
            <header>
              <h1>Verifiable random function</h1>
              <p className="sub">A coin only the key-holder can flip, yet everyone can verify. A seed becomes a pseudorandom output plus a proof; anyone with the public key confirms the output is the one true result for that seed — unpredictable in advance, impossible to cherry-pick. The primitive behind leaderless blockchain leader election (Algorand, Cardano) and DNSSEC NSEC5.</p>
            </header>
            <VrfSection />
          </>
        )}

        {section === 'ot' && (
          <>
            <header>
              <h1>Oblivious transfer</h1>
              <p className="sub">The strange handshake at the root of secure computation: the sender holds two secrets, you take exactly one, and neither side learns what the other knows — you can't see the message you didn't pick, and the sender can't tell which you took. Choose a message and step the EGL exchange; watch your pick decrypt cleanly while the other branch comes out as garbage.</p>
            </header>
            <OtSection />
          </>
        )}

        {section === 'paillier' && (
          <>
            <header>
              <h1>Paillier homomorphic encryption</h1>
              <p className="sub">Add two encrypted numbers without ever decrypting them. Paillier is additively homomorphic — multiply two ciphertexts and the result decrypts to the sum of the plaintexts. Encrypt two values, multiply the ciphertexts, and watch a server compute your total without learning either input — the primitive behind private e-voting and encrypted aggregation.</p>
            </header>
            <PaillierSection />
          </>
        )}

        {section === 'elgamal' && (
          <>
            <header>
              <h1>ElGamal encryption</h1>
              <p className="sub">Public-key encryption built on Diffie–Hellman: hide a message by multiplying it with a fresh shared secret only the private-key holder can rebuild. Encryption is randomized (the same message encrypts differently every time — semantic security) and multiplicatively homomorphic (multiply ciphertexts to multiply plaintexts). Encrypt, re-roll the randomness, and watch the homomorphism — with real modular arithmetic.</p>
            </header>
            <ElGamalSection />
          </>
        )}

        {section === 'clickjack' && (
          <>
            <header>
              <h1>Clickjacking</h1>
              <p className="sub">Tricking you into clicking something you can't see. A malicious page loads your bank in an invisible iframe and positions its real button under a decoy. Drag the reveal slider to expose the trick, then set the bank's framing policy and watch the browser refuse to load the frame at all.</p>
            </header>
            <ClickjackSection />
          </>
        )}

        {section === 'hsts' && (
          <>
            <header>
              <h1>HSTS &amp; SSL stripping</h1>
              <p className="sub">One header that forces https forever. Without it, a man-in-the-middle keeps you on plaintext and reads everything (sslstrip). With HSTS, the browser rewrites http→https itself before any request leaves — but only after it's seen the header once. Toggle the attacker, the recorded header, and the preload list to see exactly where the connection is safe and where the trust-on-first-use gap bites.</p>
            </header>
            <HstsSection />
          </>
        )}

        {section === 'openredirect' && (
          <>
            <header>
              <h1>Open redirect &amp; URL-parsing tricks</h1>
              <p className="sub">A link that starts on a trusted domain but lands on the attacker's — the engine of phishing and OAuth token theft. Type a redirect target and watch how a browser actually resolves it: a backslash becomes a slash, an @ hides the real host, a leading // is scheme-relative. See exactly which "looks like a path" payloads quietly escape the origin.</p>
            </header>
            <OpenRedirectSection />
          </>
        )}

        {section === 'hashflood' && (
          <>
            <header>
              <h1>Hash flooding &amp; algorithmic-complexity DoS</h1>
              <p className="sub">How an attacker turns a hash table's O(1) into O(n²) with nothing but chosen keys. If the hash is predictable, thousands of distinct keys can be made to collide in one bucket — every insert walks a growing chain and one request pins a CPU (the 2011 hashDoS). Flood the buckets, then switch to a seeded SipHash-style hash and watch the same attack scatter harmlessly.</p>
            </header>
            <HashFloodSection />
          </>
        )}

        {section === 'redos' && (
          <>
            <header>
              <h1>ReDoS — catastrophic regex backtracking</h1>
              <p className="sub">How one regular expression can hang a server. A backtracking engine faced with nested quantifiers like (a+)+ and an almost-matching input tries every way to split the input before failing — exponential work in the input length. Pick a pattern, drag the length, and watch the step count explode for an evil pattern while a safe one stays flat.</p>
            </header>
            <RedosSection />
          </>
        )}

        {section === 'subdomain' && (
          <>
            <header>
              <h1>Subdomain takeover</h1>
              <p className="sub">How a forgotten DNS record hands an attacker a real page on your domain. You point a subdomain at a cloud service, later delete the service, but leave the CNAME dangling — and if the provider lets anyone claim the unused name, an attacker serves their content (and a valid TLS cert) from your subdomain. Toggle each resource live/deleted and watch which ones become takeover-able.</p>
            </header>
            <SubdomainTakeoverSection />
          </>
        )}

        {section === 'bgprr' && (
          <>
            <header>
              <h1>BGP route reflectors</h1>
              <p className="sub">How iBGP scales past a few routers. A full mesh needs n(n-1)/2 sessions — 100 routers is ~5,000. A route reflector collapses that to a hub-and-spoke and relays routes between its clients. Drag the router count to watch the mesh explode, then inject routes to see the RFC 4456 reflection rules.</p>
            </header>
            <BgpRrSection />
          </>
        )}

        {section === 'routeflap' && (
          <>
            <header>
              <h1>BGP route flap damping</h1>
              <p className="sub">How routers protect the internet from an unstable link that keeps flapping (a route repeatedly withdrawn and re-announced). Each route accrues a penalty (+1000 per flap) that decays with a 15-minute half-life; above the suppress threshold the route is withheld, and it returns only after decaying below a lower reuse threshold — a hysteresis gap that stops it oscillating. Pick a route's behaviour and watch the penalty rise, decay, and cross the thresholds.</p>
            </header>
            <RouteFlapSection />
          </>
        )}
        {section !== 'overview' && <CodePanel id={section} />}
      </main>
      {activePath && (
        <JourneyBar
          path={activePath}
          section={section}
          onGoto={(id) => { setSection(id as Section); setOpenMenu(null); setNavQuery(''); }}
          onExit={() => { setJourneyId(null); setSection('overview'); }}
        />
      )}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    {/* Vercel web analytics + Core Web Vitals. No-ops off Vercel (the beacon endpoint just 404s on
        GitHub Pages), so the dual-host setup stays clean. */}
    <Analytics />
    <SpeedInsights />
  </StrictMode>,
);
