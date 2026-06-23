// Attacks, made visible — defensive/educational. Each tool shows the MECHANISM
// (and the fix) with real numbers: a sourced amplification calculator, a genuine
// hash length-extension forgery, the SYN-flood half-open table, and ARP poisoning.
import { useMemo, useState } from 'react';
import { REFLECTORS, floodGbps, synFlood } from './attacks';
import { sha256, sha256LengthExtend, hex, concatBytes } from './sha256';

type Tool = 'amp' | 'lenext' | 'syn' | 'arp';
const TOOLS: { id: Tool; label: string }[] = [
  { id: 'amp', label: 'DDoS amplification' },
  { id: 'lenext', label: 'Hash length-extension' },
  { id: 'syn', label: 'SYN flood' },
  { id: 'arp', label: 'ARP spoofing' },
];

export function AttacksSection() {
  const [tool, setTool] = useState<Tool>('amp');
  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Attacks, made visible</h2></div>
        <p className="jsec-sub">
          The fastest way to understand a defence is to see the attack it stops. These are real mechanisms with real
          numbers — shown for understanding, with the mitigation called out each time. Nothing here targets anyone.
        </p>
        <nav className="subtabs">
          {TOOLS.map((t) => <button key={t.id} className={tool === t.id ? 'on' : ''} onClick={() => setTool(t.id)}>{t.label}</button>)}
        </nav>
        {tool === 'amp' && <AmpTool />}
        {tool === 'lenext' && <LenExtTool />}
        {tool === 'syn' && <SynTool />}
        {tool === 'arp' && <ArpTool />}
      </section>
    </div>
  );
}

function AmpTool() {
  const [uplink, setUplink] = useState(100);
  const [rid, setRid] = useState('ntp');
  const r = REFLECTORS.find((x) => x.id === rid)!;
  const gbps = floodGbps(uplink, r.baf);
  const maxBaf = REFLECTORS[0].baf;
  return (
    <>
      <p className="jsec-sub">
        UDP has no handshake, so an attacker spoofs the victim’s IP as the source and sends tiny queries to public
        servers; each server replies to the <em>victim</em> with a far larger response. A small uplink becomes a flood.
      </p>
      <div className="hash-perturb">
        <span className="hp-label">attacker uplink: {uplink} Mbps</span>
        <input type="range" min={1} max={1000} value={uplink} onChange={(e) => setUplink(+e.target.value)} className="amp-range" />
      </div>
      <div className="seg amp-seg">
        {REFLECTORS.map((x) => <button key={x.id} className={rid === x.id ? 'on' : ''} onClick={() => setRid(x.id)}>{x.name.split(' (')[0]}</button>)}
      </div>
      <div className="amp-readout">
        <div className="amp-big">{gbps >= 1000 ? `${(gbps / 1000).toFixed(2)} Tbps` : `${gbps.toFixed(1)} Gbps`}</div>
        <div className="amp-sub">hits the victim · {r.baf.toLocaleString()}× amplification · <em>{r.source}</em></div>
      </div>
      <div className="amp-table">
        {REFLECTORS.map((x) => (
          <div key={x.id} className={`amp-row ${x.id === rid ? 'on' : ''}`} onClick={() => setRid(x.id)}>
            <span className="amp-name">{x.name}</span>
            <div className="amp-bar"><div className="amp-fill" style={{ width: `${(Math.log10(x.baf) / Math.log10(maxBaf)) * 100}%` }} /></div>
            <span className="amp-x">{x.baf.toLocaleString()}×</span>
          </div>
        ))}
      </div>
      <p className="enc-note"><strong>Defence:</strong> source-address validation (BCP 38 / uRPF) so spoofed packets never
        leave the origin network, and disabling/limiting the amplifying services (e.g. NTP <code>monlist</code>).</p>
    </>
  );
}

// The "secret" the attacker never sees. The whole point: they don't need it.
const SECRET = new TextEncoder().encode('s3rv3r-s1de-k3y');
const ORIG_MSG = 'user=guest&role=viewer';

function LenExtTool() {
  const [ext, setExt] = useState('&role=admin');
  const [secretLenGuess, setSecretLenGuess] = useState(SECRET.length);

  const result = useMemo(() => {
    const enc = new TextEncoder();
    const message = enc.encode(ORIG_MSG);
    const origMac = sha256(concatBytes(SECRET, message)); // server published this
    const extension = enc.encode(ext);
    const { glue, forgedMac } = sha256LengthExtend(origMac, secretLenGuess + message.length, extension);
    const forgedMessage = concatBytes(message, glue, extension);
    const serverCheck = sha256(concatBytes(SECRET, forgedMessage)); // server validates with real secret
    const accepted = hex(serverCheck) === hex(forgedMac);
    return { origMac, glue, forgedMac, forgedMessage, accepted };
  }, [ext, secretLenGuess]);

  return (
    <>
      <p className="jsec-sub">
        A naïve MAC of <code>SHA-256(secret ‖ message)</code> is forgeable. Because SHA-256 just keeps hashing from its
        internal state, an attacker who has the digest can <strong>continue</strong> it — appending data and producing a
        valid MAC <strong>without ever knowing the secret</strong>. This is the real attack; the secret below stays hidden.
      </p>
      <div className="enc-grid">
        <Row k="server publishes message" val={ORIG_MSG} />
        <Row k="server publishes MAC" val={hex(result.origMac)} />
        <Row k="secret" val={'•'.repeat(SECRET.length) + '  (attacker cannot see this)'} />
      </div>
      <div className="lx-controls">
        <label className="crypto-input"><span>attacker appends</span>
          <input value={ext} onChange={(e) => setExt(e.target.value)} spellCheck={false} /></label>
        <label className="crypto-input"><span>guessed secret length: {secretLenGuess}</span>
          <input type="range" min={1} max={32} value={secretLenGuess} onChange={(e) => setSecretLenGuess(+e.target.value)} /></label>
      </div>
      <div className="enc-grid">
        <Row k="forged message (msg ‖ glue-padding ‖ ext)" val={previewBytes(result.forgedMessage)} />
        <Row k="forged MAC (no secret used)" val={hex(result.forgedMac)} />
      </div>
      <p className={result.accepted ? 'ed-ok' : 'ed-bad'}>
        {result.accepted
          ? '✓ server ACCEPTS the forged message — the attacker escalated to role=admin without the key.'
          : `✗ rejected — secret-length guess (${secretLenGuess}) is wrong; an attacker just tries every length until one works.`}
      </p>
      <p className="enc-note"><strong>Defence:</strong> never use <code>H(secret ‖ msg)</code> — use <strong>HMAC</strong>
        (the Cryptography section), whose nested construction is immune to length extension.</p>
    </>
  );
}

function SynTool() {
  const [backlog, setBacklog] = useState(128);
  const [rate, setRate] = useState(500);
  const hold = 31; // typical SYN-ACK retransmit window (seconds)
  const m = useMemo(() => synFlood(backlog, rate, hold), [backlog, rate]);
  const slots = Math.min(backlog, 256);
  return (
    <>
      <p className="jsec-sub">
        The TCP handshake reserves a “half-open” slot the moment a SYN arrives, held until the SYN-ACK retransmissions
        time out (~{hold}s). Flood spoofed SYNs faster than they expire and the backlog fills — real clients get refused.
      </p>
      <div className="syn-controls">
        <label>backlog (slots): {backlog}<input type="range" min={16} max={256} step={16} value={backlog} onChange={(e) => setBacklog(+e.target.value)} /></label>
        <label>attacker SYN/s: {rate}<input type="range" min={1} max={2000} step={1} value={rate} onChange={(e) => setRate(+e.target.value)} /></label>
      </div>
      <div className="syn-grid">
        {Array.from({ length: slots }, (_, i) => <span key={i} className={`syn-slot ${i < (m.filledSlots / backlog) * slots ? 'half' : 'free'}`} />)}
      </div>
      <p className={m.saturated ? 'ed-bad' : 'ed-ok'}>
        {m.saturated
          ? `✗ backlog SATURATED — ${rate} SYN/s × ${hold}s ≫ ${backlog} slots. Legitimate connections are dropped.`
          : `✓ backlog holding — flood (${Math.round(rate * hold)} would-be half-opens) is below ${backlog} slots.`}
      </p>
      <p className="enc-note"><strong>Defence:</strong> <strong>SYN cookies</strong> — the server encodes the connection
        state into the SYN-ACK sequence number and keeps <em>no</em> slot until the final ACK returns, so there’s nothing to fill.</p>
    </>
  );
}

function ArpTool() {
  const [poisoned, setPoisoned] = useState(false);
  return (
    <>
      <p className="jsec-sub">
        On a LAN, hosts find each other’s MAC by shouting “who has 192.168.1.1?” over ARP — which has <strong>no
        authentication</strong>. An attacker simply answers first (and repeatedly), claiming the gateway’s IP. Now the
        victim sends all its “internet” traffic to the attacker: a man-in-the-middle.
      </p>
      <div className="arp-tables">
        <div className="arp-card">
          <div className="arp-title">victim’s ARP cache</div>
          <div className="arp-line"><span>192.168.1.1 (gateway)</span><code className={poisoned ? 'bad' : ''}>{poisoned ? 'aa:bb:cc:00:13:37 (attacker)' : '00:11:22:gateway'}</code></div>
          <div className="arp-line"><span>192.168.1.50 (peer)</span><code>00:11:22:peer-nic</code></div>
        </div>
        <div className={`arp-flow ${poisoned ? 'mitm' : ''}`}>
          {poisoned ? 'victim → 👁 attacker → gateway → internet' : 'victim → gateway → internet'}
        </div>
      </div>
      <button className="ghost" onClick={() => setPoisoned(!poisoned)}>{poisoned ? '↺ restore the real gateway' : '☠ send spoofed ARP reply'}</button>
      <p className="enc-note"><strong>Defence:</strong> Dynamic ARP Inspection + DHCP snooping on switches, static ARP for
        critical hosts, and end-to-end encryption (TLS) so a MITM sees only ciphertext even if it captures the traffic.</p>
    </>
  );
}

function previewBytes(b: Uint8Array): string {
  // printable chars as-is, non-printable as ·, capped for display
  const s = [...b.slice(0, 48)].map((x) => (x >= 0x20 && x < 0x7f ? String.fromCharCode(x) : '·')).join('');
  return s + (b.length > 48 ? ` … (${b.length} bytes)` : '');
}

function Row({ k, val }: { k: string; val: string }) {
  return <div className="enc-line"><span className="k">{k}</span><code>{val}</code></div>;
}
