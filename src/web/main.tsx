// Apex UI. A multi-section visual playground for how the internet works:
//   • Network    — build/inspect real frames across 90+ protocols
//   • Cryptography — real hashing/encryption on sandbox values
//   • Encoding   — how data becomes bytes (UTF-8, bases, Base64, floats)
// Everything derives from real bytes; nothing is faked.
import { StrictMode, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
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
import { DnssecSection } from './DnssecSection';
import { PaxosSection } from './PaxosSection';
import { WebInjectSection } from './WebInjectSection';
import { DhKexSection } from './DhKexSection';
import { CrcWalkSection } from './CrcWalkSection';
import { SnowflakeSection } from './SnowflakeSection';
import { PmtudSection } from './PmtudSection';
import { CountMinSection } from './CountMinSection';
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
import { PbftSection } from './PbftSection';
import { LzwSection } from './LzwSection';
import { HlcSection } from './HlcSection';
import { CuckooSection } from './CuckooSection';
import { GeohashSection } from './GeohashSection';
import { ChordSection } from './ChordSection';
import { UnionFindSection } from './UnionFindSection';
import { FenwickSection } from './FenwickSection';
import { KmpSection } from './KmpSection';
import { RabinKarpSection } from './RabinKarpSection';
import { HashTableSection } from './HashTableSection';
import { EditDistanceSection } from './EditDistanceSection';
import { TopoSortSection } from './TopoSortSection';
import { AstarSection } from './AstarSection';
import { HeapSection } from './HeapSection';
import { SortingSection } from './SortingSection';
import { MajoritySection } from './MajoritySection';
import { SegTreeSection } from './SegTreeSection';
import { ReservoirSection } from './ReservoirSection';
import { DfaSection } from './DfaSection';
import { FencingSection } from './FencingSection';
import { HashChainSection } from './HashChainSection';
import { HappyEyeballsSection } from './HappyEyeballsSection';
import { NagleSection } from './NagleSection';
import { ChandySection } from './ChandySection';
import { VitSection } from './VitSection';
import { SctpSection } from './SctpSection';
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
import { RaftLogSection } from './RaftLogSection';
import { AvlSection } from './AvlSection';
import { StoryView } from './StoryView';
import { EncodingSection } from './EncodingSection';
import { HuffmanSection } from './HuffmanSection';
import { ErrorDetectSection } from './ErrorDetectSection';
import { IdentitySection } from './IdentitySection';
import { AttacksSection } from './AttacksSection';
import { RoutingSection } from './RoutingSection';
import { DnsJourneySection } from './DnsJourneySection';
import { SubnetSection } from './SubnetSection';
import { BgpPathSection } from './BgpPathSection';
import { CongestionSection } from './CongestionSection';
import { Http2Section } from './Http2Section';
import { QuicSection } from './QuicSection';
import { NatSection } from './NatSection';
import { SlidingWindowSection } from './SlidingWindowSection';
import { BufferbloatSection } from './BufferbloatSection';
import { CookiesSection } from './CookiesSection';
import { CertChainSection } from './CertChainSection';
import { TracerouteSection } from './TracerouteSection';
import { DhcpSection } from './DhcpSection';
import { SwitchSection } from './SwitchSection';
import { TokenBucketSection } from './TokenBucketSection';
import { ConsistentHashSection } from './ConsistentHashSection';
import { LoadBalanceSection } from './LoadBalanceSection';
import { BloomSection } from './BloomSection';
import { CacheHierarchySection } from './CacheHierarchySection';
import { QosSection } from './QosSection';
import { MerkleSection } from './MerkleSection';
import { VectorClockSection } from './VectorClockSection';
import { CrdtSection } from './CrdtSection';
import { GossipSection } from './GossipSection';
import { RaftSection } from './RaftSection';
import { CapSection } from './CapSection';
import { ReplicationSection } from './ReplicationSection';
import { TwoPcSection } from './TwoPcSection';
import { FragmentSection } from './FragmentSection';
import { BgpHijackSection } from './BgpHijackSection';
import { BgpSelectSection } from './BgpSelectSection';
import { MplsSection } from './MplsSection';
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
import { MesiSection } from './MesiSection';
import { JoinsSection } from './JoinsSection';
import { FlowCtlSection } from './FlowCtlSection';
import { TsoSection } from './TsoSection';
import { LinkStateSection } from './LinkStateSection';
import { MaxFlowSection } from './MaxFlowSection';
import { NttSection } from './NttSection';
import { BwtSection } from './BwtSection';
import { TailLatencySection } from './TailLatencySection';
import { MstSection } from './MstSection';
import { CfsSection } from './CfsSection';
import { PipelineSection } from './PipelineSection';
import { SccSection } from './SccSection';
import { QueryPlanSection } from './QueryPlanSection';
import { RumSection } from './RumSection';
import { ArithSection } from './ArithSection';
import { SwimSection } from './SwimSection';
import { AhoCorasickSection } from './AhoCorasickSection';
import { FloydSection } from './FloydSection';
import { LeakyBucketSection } from './LeakyBucketSection';
import { KnapsackSection } from './KnapsackSection';
import { DeployStratSection } from './DeployStratSection';
import { HealthCheckSection } from './HealthCheckSection';
import { AutoscaleSection } from './AutoscaleSection';
import { SloSection } from './SloSection';
import { TracingSection } from './TracingSection';
import { FeatureFlagSection } from './FeatureFlagSection';
import { GracefulShutdownSection } from './GracefulShutdownSection';
import { IdempotencySection } from './IdempotencySection';
import { LoadShedSection } from './LoadShedSection';
import { ChaosSection } from './ChaosSection';
import { SingleFlightSection } from './SingleFlightSection';
import { BranchPredictSection } from './BranchPredictSection';
import { BoyerMooreSection } from './BoyerMooreSection';
import { NewtonSection } from './NewtonSection';
import { CowSection } from './CowSection';
import { MtfSection } from './MtfSection';
import { TlbSection } from './TlbSection';
import { SuffixArraySection } from './SuffixArraySection';
import { FftSection } from './FftSection';
import { SsrfSection } from './SsrfSection';
import { SagaSection } from './SagaSection';
import { BlindSigSection } from './BlindSigSection';
import { VrfSection } from './VrfSection';
import { ClickjackSection } from './ClickjackSection';
import { BgpRrSection } from './BgpRrSection';
import './style.css';

const registry = new ProtocolRegistry();
registerCoreProtocols(registry);

type Section = 'network' | 'crypto' | 'classical' | 'otpad' | 'aesround' | 'aead' | 'chacha' | 'hashint' | 'rsa' | 'ecc' | 'ecdsa' | 'schnorr' | 'dhmitm' | 'bb84' | 'ecbpenguin' | 'lamport' | 'quorum' | 'lz77' | 'cors' | 'tcphand' | 'dnssec' | 'paxos' | 'webinject' | 'dhkex' | 'crc32' | 'snowflake' | 'pmtud' | 'countmin' | 'sack' | 'bully' | 'csp' | 'eddsa' | 'hll' | 'ttlhop' | 'bdp' | 'webauthn' | 'anycast' | 'mailauth' | 'consistency' | 'reedsolomon' | 'cubic' | 'wpa' | 'bbr' | 'btree' | 'lsm' | 'mvcc' | 'wal' | 'skiplist' | 'pedersen' | 'locking' | 'trie' | 'pbft' | 'lzw' | 'hlc' | 'cuckoo' | 'geohash' | 'chord' | 'unionfind' | 'fenwick' | 'kmp' | 'rabinkarp' | 'hashtable' | 'editdist' | 'toposort' | 'astar' | 'heap' | 'sorting' | 'majority' | 'segtree' | 'avl' | 'reservoir' | 'dfa' | 'fencing' | 'hashchain' | 'happyeyeballs' | 'nagle' | 'chandy' | 'viterbi' | 'sctp' | 'pagereplace' | 'retry' | 'smuggle' | 'phiaccrual' | 'consttime' | 'conditional' | 'siteisolation' | 'vxlan' | 'sri' | 'antientropy' | 'vrrp' | 'truetime' | 'ecn' | 'dot1x' | 'ipsec' | 'causalbcast' | 'ecmp' | 'realtime' | 'x3dh' | 'tfo' | 'threshsig' | 'raftlog' | 'tlsdowngrade' | 'pwhash' | 'pqc' | 'shamir' | 'pow' | 'kerberos' | 'revocation' | 'ssh' | 'feistel' | 'poly1305' | 'hashbreak' | 'ratchet' | 'encoding' | 'huffman' | 'errors' | 'identity' | 'attacks' | 'routing' | 'dns' | 'subnet' | 'bgp' | 'congestion' | 'http2' | 'quic' | 'nat' | 'flow' | 'bufferbloat' | 'cookies' | 'certs' | 'traceroute' | 'dhcp' | 'switch' | 'stptree' | 'slaac' | 'linecode' | 'ratelimit' | 'chash' | 'lb' | 'bloom' | 'cdn' | 'qos' | 'merkle' | 'vclock' | 'crdt' | 'gossip' | 'raft' | 'cap' | 'replication' | 'twopc' | 'fragment' | 'bgphijack' | 'bgpselect' | 'mpls' | 'natpunch' | 'ipcompare' | 'icmp' | 'arp' | 'csma' | 'multicast' | 'vlan' | 'ntp' | 'arq' | 'rto' | 'queueing' | 'distvec' | 'mdns' | 'encdns' | 'http3' | 'grpc' | 'websocket' | 'cpusched' | 'pagewalk' | 'mesi' | 'joins' | 'h2flow' | 'tso' | 'ospf' | 'maxflow' | 'ntt' | 'bwt' | 'taillatency' | 'mst' | 'cfs' | 'pipeline' | 'scc' | 'queryplan' | 'rum' | 'arith' | 'swim' | 'ahocorasick' | 'floyd' | 'leakybucket' | 'knapsack' | 'deployments' | 'healthcheck' | 'autoscale' | 'slo' | 'tracing' | 'featureflags' | 'gracefulshutdown' | 'idempotency' | 'loadshed' | 'chaos' | 'singleflight' | 'branchpredict' | 'boyermoore' | 'newton' | 'cow' | 'mtf' | 'tlb' | 'suffixarray' | 'fft' | 'ssrf' | 'saga' | 'blindsig' | 'clickjack' | 'bgprr' | 'vrf' | 'overview';

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
          <button type="button" className="brand" onClick={() => setSection('overview')} title="Overview"><span className="logo">◆</span> Apex</button>
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

        {section === 'dnssec' && (
          <>
            <header>
              <h1>DNSSEC chain of trust</h1>
              <p className="sub">How DNS answers become trustworthy: a chain of signatures from the root anchor down to the record. Validate it, then corrupt a DS hash or an RRSIG and watch it turn bogus at exactly the broken link.</p>
            </header>
            <DnssecSection />
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

        {section === 'geohash' && (
          <>
            <header>
              <h1>Geohashing</h1>
              <p className="sub">Turn a latitude/longitude into a short, sortable string where nearby points share a prefix. Watch the geohash grow as the bounding box shrinks, and compare two places to see proximity become a shared prefix.</p>
            </header>
            <GeohashSection />
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

        {section === 'sorting' && (
          <>
            <header>
              <h1>Sorting algorithms</h1>
              <p className="sub">The same array, five ways. Step or play through bubble, insertion, selection, merge, and quicksort on a bar chart, and compare their comparison/swap counts to feel the O(n²) vs O(n log n) gap.</p>
            </header>
            <SortingSection />
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

        {section === 'encoding' && (
          <>
            <header>
              <h1>Encoding</h1>
              <p className="sub">How data is represented as bytes — type and watch it transform, for real.</p>
            </header>
            <EncodingSection />
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

        {section === 'lb' && (
          <>
            <header>
              <h1>Load balancing</h1>
              <p className="sub">Round-robin, least-connections, weighted, sticky — watch each strategy spread requests differently.</p>
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

        {section === 'twopc' && (
          <>
            <header>
              <h1>Two-phase commit</h1>
              <p className="sub">Atomic commit across databases — vote, decide, and watch the coordinator-crash blocking problem.</p>
            </header>
            <TwoPcSection />
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

        {section === 'bgpselect' && (
          <>
            <header>
              <h1>BGP best-path selection</h1>
              <p className="sub">When a router hears many routes to one prefix, it runs a fixed tiebreaker cascade — adjust each route's local-pref and watch which rule decides the winner.</p>
            </header>
            <BgpSelectSection />
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

        {section === 'mesi' && (
          <>
            <header>
              <h1>MESI cache coherence</h1>
              <p className="sub">Several cores, one shared memory line. Press a core's read or write and watch its cache state move through Modified / Exclusive / Shared / Invalid as the snooping bus invalidates and downgrades the others — and see why false sharing is so costly.</p>
            </header>
            <MesiSection />
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

        {section === 'leakybucket' && (
          <>
            <header>
              <h1>Leaky bucket traffic shaping</h1>
              <p className="sub">Turn a bursty arrival stream into a perfectly smooth output. Packets pour into a bucket and drain at a fixed rate; bursts are absorbed up to the bucket's capacity and whatever overflows is dropped. The output never rises above the leak rate — the opposite trade-off from the token bucket, which lets saved-up bursts through.</p>
            </header>
            <LeakyBucketSection />
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

        {section === 'tlb' && (
          <>
            <header>
              <h1>The TLB (translation lookaside buffer)</h1>
              <p className="sub">The cache that makes virtual memory fast by avoiding the page-table walk. A loop touches a working set of pages; step through it and watch hits resolve in a cycle while misses pay for the walk. Drag the working set past the TLB size and watch the hit rate fall off a cliff — thrashing.</p>
            </header>
            <TlbSection />
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

        {section === 'clickjack' && (
          <>
            <header>
              <h1>Clickjacking</h1>
              <p className="sub">Tricking you into clicking something you can't see. A malicious page loads your bank in an invisible iframe and positions its real button under a decoy. Drag the reveal slider to expose the trick, then set the bank's framing policy and watch the browser refuse to load the frame at all.</p>
            </header>
            <ClickjackSection />
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
