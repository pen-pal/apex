// Apex UI. A multi-section visual playground for how the internet works:
//   • Network    — build/inspect real frames across 90+ protocols
//   • Cryptography — real hashing/encryption on sandbox values
//   • Encoding   — how data becomes bytes (UTF-8, bases, Base64, floats)
// Everything derives from real bytes; nothing is faked.
import { StrictMode, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
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
import './style.css';

const registry = new ProtocolRegistry();
registerCoreProtocols(registry);

type Section = 'network' | 'crypto' | 'classical' | 'otpad' | 'aesround' | 'aead' | 'chacha' | 'hashint' | 'rsa' | 'ecc' | 'ecdsa' | 'schnorr' | 'dhmitm' | 'bb84' | 'ecbpenguin' | 'lamport' | 'quorum' | 'lz77' | 'cors' | 'tcphand' | 'dnssec' | 'paxos' | 'webinject' | 'dhkex' | 'crc32' | 'snowflake' | 'pmtud' | 'countmin' | 'sack' | 'bully' | 'csp' | 'eddsa' | 'hll' | 'ttlhop' | 'bdp' | 'webauthn' | 'anycast' | 'mailauth' | 'consistency' | 'reedsolomon' | 'cubic' | 'wpa' | 'bbr' | 'btree' | 'lsm' | 'mvcc' | 'wal' | 'skiplist' | 'pedersen' | 'locking' | 'trie' | 'pbft' | 'lzw' | 'hlc' | 'cuckoo' | 'geohash' | 'chord' | 'unionfind' | 'fenwick' | 'kmp' | 'tlsdowngrade' | 'pwhash' | 'pqc' | 'shamir' | 'pow' | 'kerberos' | 'revocation' | 'ssh' | 'feistel' | 'poly1305' | 'hashbreak' | 'ratchet' | 'encoding' | 'huffman' | 'errors' | 'identity' | 'attacks' | 'routing' | 'dns' | 'subnet' | 'bgp' | 'congestion' | 'http2' | 'quic' | 'nat' | 'flow' | 'bufferbloat' | 'cookies' | 'certs' | 'traceroute' | 'dhcp' | 'switch' | 'stptree' | 'slaac' | 'linecode' | 'ratelimit' | 'chash' | 'lb' | 'bloom' | 'cdn' | 'qos' | 'merkle' | 'vclock' | 'crdt' | 'gossip' | 'raft' | 'cap' | 'replication' | 'twopc' | 'fragment' | 'bgphijack' | 'bgpselect' | 'mpls' | 'natpunch' | 'ipcompare' | 'icmp' | 'arp' | 'csma' | 'multicast' | 'vlan' | 'ntp' | 'arq' | 'rto' | 'queueing' | 'distvec' | 'mdns' | 'encdns' | 'http3' | 'grpc' | 'websocket';

type View = 'story' | 'anatomy' | 'journey' | 'state' | 'checksum';
const TABS: { id: View; label: string }[] = [
  { id: 'story', label: 'Packet story' },
  { id: 'anatomy', label: 'Byte anatomy' },
  { id: 'journey', label: 'Journey' },
  { id: 'state', label: 'Connection lifecycle' },
  { id: 'checksum', label: 'Checksum' },
];

function App() {
  const [section, setSection] = useState<Section>('network');
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const activeGroup = groupOf(section);
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
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand"><span className="logo">◆</span> Apex</div>
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
        </div>
      </header>
      {openMenu && <div className="topnav-backdrop" onClick={() => setOpenMenu(null)} />}

      <main className="content">
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
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
