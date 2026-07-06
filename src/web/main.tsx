// Apex UI. A multi-section visual playground for how the internet works:
//   • Network    — build/inspect real frames across 90+ protocols
//   • Cryptography — real hashing/encryption on sandbox values
//   • Encoding   — how data becomes bytes (UTF-8, bases, Base64, floats)
// Everything derives from real bytes; nothing is faked.
import { StrictMode, useEffect, useMemo, useRef, useState } from 'react';
import { SectionHost } from './sections/SectionHost';
import { SECTIONS } from './sections/registry';
import { createRoot } from 'react-dom/client';
import { initAnalytics, trackSection, trackDwell, trackInteraction } from './analytics';
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
import { AesRoundSection } from './AesRoundSection';
import { HashInternalsSection } from './HashInternalsSection';
import { StoryView } from './StoryView';
import { CertChainSection } from './CertChainSection';
import { IcmpSection } from './IcmpSection';
import { DhMitmSection } from './DhMitmSection';
import { GROUPS, metaById, groupOf } from './sections';
import { OverviewSection } from './OverviewSection';
import { JourneyBar } from './JourneyBar';
import { pathById } from './paths';
import { CodePanel } from './CodePanel';
import './style.css';

const registry = new ProtocolRegistry();
registerCoreProtocols(registry);

type Section = 'network' | 'crypto' | 'classical' | 'otpad' | 'aesround' | 'aead' | 'chacha' | 'hashint' | 'rsa' | 'ecc' | 'ecdsa' | 'schnorr' | 'dhmitm' | 'bb84' | 'ecbpenguin' | 'lamport' | 'quorum' | 'lz77' | 'cors' | 'tcphand' | 'dnssec' | 'paxos' | 'webinject' | 'dhkex' | 'crc32' | 'snowflake' | 'pmtud' | 'countmin' | 'sack' | 'bully' | 'csp' | 'eddsa' | 'hll' | 'ttlhop' | 'bdp' | 'webauthn' | 'anycast' | 'mailauth' | 'consistency' | 'reedsolomon' | 'cubic' | 'wpa' | 'bbr' | 'btree' | 'lsm' | 'mvcc' | 'wal' | 'skiplist' | 'pedersen' | 'locking' | 'trie' | 'pbft' | 'lzw' | 'hlc' | 'cuckoo' | 'geohash' | 'chord' | 'unionfind' | 'fenwick' | 'kmp' | 'rabinkarp' | 'hashtable' | 'editdist' | 'toposort' | 'astar' | 'heap' | 'sorting' | 'majority' | 'segtree' | 'avl' | 'reservoir' | 'dfa' | 'fencing' | 'hashchain' | 'happyeyeballs' | 'nagle' | 'chandy' | 'viterbi' | 'sctp' | 'pagereplace' | 'retry' | 'smuggle' | 'phiaccrual' | 'consttime' | 'conditional' | 'siteisolation' | 'vxlan' | 'sri' | 'antientropy' | 'vrrp' | 'truetime' | 'ecn' | 'dot1x' | 'ipsec' | 'causalbcast' | 'ecmp' | 'realtime' | 'x3dh' | 'tfo' | 'threshsig' | 'raftlog' | 'tlsdowngrade' | 'pwhash' | 'pqc' | 'shamir' | 'pow' | 'kerberos' | 'revocation' | 'ssh' | 'feistel' | 'poly1305' | 'hashbreak' | 'ratchet' | 'encoding' | 'huffman' | 'errors' | 'identity' | 'attacks' | 'routing' | 'dns' | 'subnet' | 'bgp' | 'congestion' | 'http2' | 'quic' | 'nat' | 'flow' | 'bufferbloat' | 'cookies' | 'certs' | 'traceroute' | 'dhcp' | 'switch' | 'stptree' | 'slaac' | 'linecode' | 'ratelimit' | 'chash' | 'lb' | 'bloom' | 'cdn' | 'qos' | 'merkle' | 'vclock' | 'crdt' | 'gossip' | 'raft' | 'cap' | 'replication' | 'twopc' | 'fragment' | 'bgphijack' | 'mpls' | 'natpunch' | 'ipcompare' | 'icmp' | 'arp' | 'csma' | 'multicast' | 'vlan' | 'ntp' | 'arq' | 'rto' | 'queueing' | 'distvec' | 'mdns' | 'encdns' | 'http3' | 'grpc' | 'websocket' | 'cpusched' | 'pagewalk' | 'mesi' | 'joins' | 'h2flow' | 'tso' | 'ospf' | 'maxflow' | 'ntt' | 'bwt' | 'taillatency' | 'mst' | 'cfs' | 'pipeline' | 'scc' | 'queryplan' | 'rum' | 'arith' | 'swim' | 'ahocorasick' | 'floyd' | 'leakybucket' | 'knapsack' | 'deployments' | 'healthcheck' | 'autoscale' | 'slo' | 'tracing' | 'featureflags' | 'gracefulshutdown' | 'idempotency' | 'loadshed' | 'chaos' | 'singleflight' | 'branchpredict' | 'boyermoore' | 'newton' | 'cow' | 'mtf' | 'tlb' | 'suffixarray' | 'fft' | 'ssrf' | 'saga' | 'blindsig' | 'clickjack' | 'bgprr' | 'vrf' | 'hsts' | 'numa' | 'ot' | 'bellmanford' | 'cdc' | 'watermark' | 'openredirect' | 'paillier' | 'manacher' | 'epoll' | 'varint' | 'hintedhandoff' | 'futex' | 'quicmig' | 'quickselect' | 'feldman' | 'chainrep' | 'iouring' | 'golombrice' | 'hashflood' | 'hdrhist' | 'aliasmethod' | 'bakery' | 'zerortt' | 'redos' | 'splaytree' | 'kaminsky' | 'threepc' | 'kdtree' | 'subdomain' | 'zalgo' | 'rcu' | 'lenext' | 'roaring' | 'priorityinv' | 'leases' | 'timewait' | 'paddingoracle' | 'bulkhead' | 'hamt' | 'shuffle' | 'optransform' | 'spectre' | 'jumphash' | 'cycledetect' | 'gorilla' | 'protopollute' | 'mptcp' | 'envelope' | 'falseshare' | 'intervaltree' | 'treap' | 'kadane' | 'readrepair' | 'dnsrebind' | 'cobs' | 'piecetable' | 'rendezvous' | 'buddyalloc' | 'timingwheel' | 'usl' | 'segrouting' | 'eliascode' | 'arpspoof' | 'sparsetable' | 'elgamal' | 'dnf' | 'sws' | 'ddsketch' | 'lamportsig' | 'minhash' | 'pid' | 'xxe' | 'aba' | 'bitmapindex' | 'rsync' | 'kademlia' | 'inode' | 'medianofmedians' | 'robinhood' | 'hmac' | 'routeflap' | 'seqlock' | 'cartesian' | 'jwt' | 'pairingheap' | 'base58' | 'lis' | 'gcra' | 'dram' | 'adder' | 'latch' | 'alu' | 'membus' | 'io' | 'ssd' | 'transistor' | 'gpu' | 'cpucache' | 'oooexec' | 'rope' | 'gapbuffer' | 'fastinvsqrt' | 'kahan' | 'karatsuba' | 'simanneal' | 'hamming' | 'bresenham' | 'convexhull' | 'marchsquares' | 'voronoi' | 'perlin' | 'poisson' | 'delaunay' | 'montgomery' | 'twosat' | 'overview';

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
                Your computer never sends your message alone: it wraps it in nested <strong>envelopes</strong>, one per
                layer — TCP for a reliable connection, IP for an address across the internet, Ethernet for the local wire —
                each adding a header. Type a message and watch the envelopes get built byte by byte, cross the wire, and get
                unwrapped at the far end — real frames, real checksums (or load a real protocol capture). Every network
                attack, later, is a forged or tampered envelope somewhere in this stack.
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

        {SECTIONS[section] && <SectionHost id={section} />}

        {section === 'aesround' && (
          <>
            <header>
              <h1>AES internals</h1>
              <p className="sub">Step inside the block cipher — watch 10 rounds of SubBytes, ShiftRows, MixColumns and AddRoundKey transform the 4×4 state.</p>
            </header>
            <AesRoundSection onOpen={(id) => setSection(id as Section)} />
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

        {section === 'certs' && (
          <>
            <header>
              <h1>Certificates &amp; PKI</h1>
              <p className="sub">Walk the certificate chain leaf → root — and watch validation fail at the exact link you break.</p>
            </header>
            <CertChainSection onOpen={(id) => setSection(id as Section)} />
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

        {section === 'dhmitm' && (
          <>
            <header>
              <h1>DH man-in-the-middle</h1>
              <p className="sub">Diffie–Hellman resists a passive eavesdropper but not an active one — watch Eve run DH with each side and relay, then authenticate the public values to catch her.</p>
            </header>
            <DhMitmSection onOpen={(id) => setSection(id as Section)} />
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
  </StrictMode>,
);
