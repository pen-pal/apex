// Apex UI. Type a message (or a number) and watch it become a real
// Ethernet/IPv4/TCP frame, then inspect it four ways — byte anatomy, the
// encapsulation journey, the connection lifecycle, and the checksum walkthrough.
// All rendering derives from the engine's dissection.
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
import './style.css';

const registry = new ProtocolRegistry();
registerCoreProtocols(registry);

type View = 'story' | 'anatomy' | 'journey' | 'state' | 'checksum' | 'crypto';

const TABS: { id: View; label: string }[] = [
  { id: 'story', label: 'Packet story' },
  { id: 'anatomy', label: 'Byte anatomy' },
  { id: 'journey', label: 'Journey' },
  { id: 'state', label: 'Connection lifecycle' },
  { id: 'checksum', label: 'Checksum' },
  { id: 'crypto', label: 'Crypto sandbox' },
];

function App() {
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
  // A loaded pcap packet looks just like a built-in example to the rest of the app.
  const pcapPkt = pcap
    ? {
        id: `pcap-${pcapIdx}`,
        label: `pcap packet #${pcapIdx + 1}`,
        startId: pcap.startId,
        bytes: pcap.packets[pcapIdx].bytes,
        note: `Captured frame ${pcapIdx + 1} of ${pcap.packets.length} (${pcap.packets[pcapIdx].bytes.length} bytes on the wire).`,
      }
    : null;
  const capture = pcapPkt ?? builtIn; // a real capture overrides the text frame

  // The active dissection drives EVERY view: a loaded/example capture, or the
  // frame built from your text + connection settings. Each view adapts to
  // whatever protocols are present.
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
      setPcap(pc);
      setPcapIdx(0);
      setExampleId(null);
      setPcapError(null);
      setView('anatomy');
    } catch (e) {
      setPcap(null);
      setPcapError(e instanceof Error ? e.message : String(e));
    }
  };

  const payloadHex = payload.map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');

  return (
    <div className="wrap">
      <header>
        <h1>Apex</h1>
        <p className="sub">
          A live look at how a network frame is built. Type something — it becomes real bytes,
          wrapped in TCP, IPv4, and Ethernet, with real checksums and a real CRC-32 FCS.
        </p>
      </header>

      <div className="controls">
        <div className="mode">
          <button className={mode === 'text' ? 'on' : ''} onClick={() => setMode('text')}>Text</button>
          <button className={mode === 'number' ? 'on' : ''} onClick={() => setMode('number')}>Number</button>
        </div>
        <input
          className="msg"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={mode === 'text' ? 'Type a message…' : 'Type an integer, e.g. 443 or -200'}
          spellCheck={false}
        />
        <div className="payload-readout">
          {error ? (
            <span className="err">{error}</span>
          ) : (
            <>
              <span className="k">payload</span>
              <code>{payloadHex || '—'}</code>
              <span className="cnt">{payload.length} byte{payload.length === 1 ? '' : 's'}</span>
            </>
          )}
        </div>
        <select className="examples" value={exampleId ?? ''} onChange={(e) => pickExample(e.target.value || null)}>
          <option value="">Examples: real captures…</option>
          {EXAMPLES.map((e) => (
            <option key={e.id} value={e.id}>{e.label}</option>
          ))}
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
              <button
                key={p.index}
                className={p.index === pcapIdx ? 'on' : ''}
                onClick={() => { setPcapIdx(p.index); setView('anatomy'); }}
              >
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
            {(
              [
                ['srcIp', 'Source IP'],
                ['dstIp', 'Dest IP'],
                ['srcPort', 'Source port'],
                ['dstPort', 'Dest port'],
                ['ttl', 'TTL'],
                ['window', 'Window'],
              ] as [keyof ConnForm, string][]
            ).map(([key, label]) => (
              <label key={key} className="adv-field">
                <span>{label}</span>
                <input
                  className={connErrors[key] ? 'bad' : ''}
                  value={form[key] as string}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  spellCheck={false}
                />
                {connErrors[key] && <em className="adv-err">{connErrors[key]}</em>}
              </label>
            ))}
            <div className="adv-flags">
              <span>TCP flags</span>
              <div className="adv-flagrow">
                {(['SYN', 'ACK', 'PSH', 'RST', 'FIN'] as (keyof FlagSet)[]).map((fl) => (
                  <label key={fl}>
                    <input
                      type="checkbox"
                      checked={form.flags[fl]}
                      onChange={() => setForm((f) => ({ ...f, flags: { ...f.flags, [fl]: !f.flags[fl] } }))}
                    />
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
        <StoryView
          tree={activeTree}
          model={anatomyModel}
          journey={journey}
          built={!capture}
          caption={capture ? `${capture.label} — ${capture.note}` : undefined}
        />
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
      {view === 'crypto' && <CryptoView />}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
