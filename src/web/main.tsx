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
import { StoryView } from './StoryView';
import { EncodingSection } from './EncodingSection';
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
import './style.css';

const registry = new ProtocolRegistry();
registerCoreProtocols(registry);

type Section = 'network' | 'crypto' | 'encoding' | 'errors' | 'identity' | 'attacks' | 'routing' | 'dns' | 'subnet' | 'bgp' | 'congestion' | 'http2' | 'quic' | 'nat' | 'flow' | 'bufferbloat' | 'cookies' | 'certs' | 'traceroute' | 'dhcp' | 'switch' | 'ratelimit' | 'chash' | 'lb' | 'bloom' | 'cdn' | 'qos' | 'merkle';
const SECTIONS: { id: Section; label: string; icon: string }[] = [
  { id: 'network', label: 'Network', icon: '🌐' },
  { id: 'routing', label: 'Routing & paths', icon: '🧭' },
  { id: 'bgp', label: 'BGP paths', icon: '🛣️' },
  { id: 'congestion', label: 'TCP congestion', icon: '📈' },
  { id: 'http2', label: 'HTTP/2 multiplexing', icon: '🧵' },
  { id: 'quic', label: 'QUIC vs TCP', icon: '🚀' },
  { id: 'nat', label: 'NAT / PAT', icon: '🔀' },
  { id: 'flow', label: 'Flow control', icon: '🪟' },
  { id: 'bufferbloat', label: 'Bufferbloat', icon: '🚰' },
  { id: 'subnet', label: 'Subnetting', icon: '🧮' },
  { id: 'dns', label: 'DNS journey', icon: '🔎' },
  { id: 'traceroute', label: 'Traceroute', icon: '🛰️' },
  { id: 'dhcp', label: 'DHCP (DORA)', icon: '📨' },
  { id: 'switch', label: 'L2 switch', icon: '🔌' },
  { id: 'ratelimit', label: 'Rate limiting', icon: '🪣' },
  { id: 'chash', label: 'Consistent hashing', icon: '⭕' },
  { id: 'lb', label: 'Load balancing', icon: '⚖️' },
  { id: 'bloom', label: 'Bloom filter', icon: '🌸' },
  { id: 'cdn', label: 'CDN & caching', icon: '⚡' },
  { id: 'qos', label: 'QoS scheduling', icon: '🚦' },
  { id: 'crypto', label: 'Cryptography', icon: '🔒' },
  { id: 'certs', label: 'Certificates (PKI)', icon: '📜' },
  { id: 'merkle', label: 'Merkle tree', icon: '🌳' },
  { id: 'identity', label: 'Identity & Auth', icon: '🪪' },
  { id: 'cookies', label: 'Cookies & sessions', icon: '🍪' },
  { id: 'attacks', label: 'Attacks', icon: '⚔️' },
  { id: 'encoding', label: 'Encoding', icon: '🔤' },
  { id: 'errors', label: 'Error control', icon: '🛡️' },
];

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
      <aside className="sidebar">
        <div className="brand"><span className="logo">◆</span> Apex</div>
        <nav className="sections">
          {SECTIONS.map((s) => (
            <button key={s.id} className={section === s.id ? 'on' : ''} onClick={() => setSection(s.id)}>
              <span className="sec-icon">{s.icon}</span> {s.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">See how the internet works — one real byte at a time.</div>
      </aside>

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

        {section === 'encoding' && (
          <>
            <header>
              <h1>Encoding</h1>
              <p className="sub">How data is represented as bytes — type and watch it transform, for real.</p>
            </header>
            <EncodingSection />
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
            <CertChainSection />
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
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
