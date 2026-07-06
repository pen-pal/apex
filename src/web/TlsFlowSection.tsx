// Guided story #3: how HTTPS secures a connection — the TLS 1.3 handshake, on the GuidedStory engine.
// DEEPENED so the two hinge insights are PRODUCED and BROKEN, not just read:
//  · "Verify identity" — forge the certificate and watch the CA-signature check bounce (you can copy the
//    cert, but not re-sign it), so you feel why the signature is what stops an impostor.
//  · "Shared secret" — scrub Alice's and Bob's private exponents and watch real ECDHE (dh.ts, tested) land
//    both on the identical secret, while Eve, who has both public shares, must solve the discrete log —
//    brute-forced live to show it's only feasible here because the demo prime is tiny.
// Honest to the correctness creed: real BigInt Diffie–Hellman; application data stays opaque ciphertext
// (the record SHAPE, not invented plaintext — the hex is a clearly-labelled stand-in, no real key).
import { useMemo, useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';
import { dhExchange, dhBruteForce } from './dh';

type Phase = 'problem' | 'chello' | 'shello' | 'verify' | 'secret' | 'data';
// A tiny demo group so the discrete log is crackable on screen. Real TLS 1.3 uses a 256-bit curve (X25519).
const P = 23n, G = 5n;

export function TlsFlowSection() {
  const [msg, setMsg] = useState('password: hunter2');
  const [a, setA] = useState(6);   // client (Alice) private ECDHE exponent
  const [b, setB] = useState(15);  // server (Bob) private ECDHE exponent
  const [forge, setForge] = useState(false); // attacker tries to pass off a copied certificate
  const [eve, setEve] = useState(false);     // Eve attempts the discrete log

  const dh = useMemo(() => dhExchange(P, G, BigInt(a), BigInt(b)), [a, b]);
  const crack = useMemo(() => (eve ? dhBruteForce(P, G, dh.A) : null), [eve, dh.A]);

  const narrated = (key: Phase, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: (act) => <Wire phase={key} msg={msg} active={act} dh={dh} forge={forge} /> });

  const scenes: StoryScene[] = [
    narrated('problem', 'The problem', 'You send a password to your bank across the open internet. Every router, ISP, and Wi-Fi access point on the path can read every byte. You need privacy and proof of who you are talking to — over a channel you do not trust.'),
    narrated('chello', 'ClientHello', 'The browser opens in the clear: the TLS versions and cipher suites it supports, a random nonce, and (TLS 1.3) an ephemeral public key share A = gᵃ. Anyone can read this — none of it is secret. That cleartext cipher list is exactly where a downgrade attack cuts in: an attacker on the path strips the strong options to force a weak cipher — which is why TLS 1.3 binds the whole handshake with a transcript hash, so any such tampering is caught.'),
    narrated('shello', 'ServerHello + certificate', 'The server picks a cipher, sends its own random and public share B = gᵇ, and its certificate — its public key, signed by a Certificate Authority.'),
    narrated('verify', 'Verify identity — try to forge it', 'The browser checks the certificate chains to a trusted root CA and matches the domain. Be the attacker below: copy the real certificate and try to pass it off. The CA’s signature is the one thing you can’t reproduce.'),
    narrated('secret', 'Shared secret, never sent — build it', 'ECDHE: each side raises the other’s public share to its own private exponent and lands on the identical secret gᵃᵇ, which never crossed the wire. Scrub the private exponents below and watch both secrets track together while Eve, who saw A and B, stays stuck.'),
    { key: 'data', title: 'Encrypted application data', caption: 'Keys derived from that secret encrypt everything after. To anyone on the path it is an opaque record: a small header, a length, ciphertext, and an authentication tag. Type something and watch it become bytes Eve cannot read.', render: (act) => <Wire phase="data" msg={msg} active={act} dh={dh} forge={forge} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>You want to send your bank a password across the open internet, where every router, Wi-Fi point, and ISP on the path can read whatever crosses the wire — and you have never met the bank to agree on a secret code first. TLS builds a private, authenticated channel over that untrusted path anyway. This story walks the TLS 1.3 handshake from the eavesdropper’s point of view — and lets you attack the two steps that make it work, so you can see for yourself what leaks and what stays safe.</>,
        takeaway: <>It solves three problems at once. <em>Who are you talking to?</em> — the server’s certificate, signed by a Certificate Authority the browser trusts, proves it owns the domain; forge the cert and the signature check rejects it, because copying a certificate is easy but re-signing it is not. <em>How do you share a key over a tapped line?</em> — ECDHE has both sides mix their own private value with the other’s public value to derive the identical secret, while only the public values cross the wire; an eavesdropper with both public shares still faces the discrete-log problem, which is trivial at the demo prime here and ~2¹²⁸ work at real sizes. <em>How do you stay private?</em> — that secret keys the encryption, turning your data into opaque ciphertext. Defeat any one and the channel is no longer both private and trustworthy.</>,
      }}
      controls={(s) => {
        if (s === 3) return <ForgeControls forge={forge} setForge={setForge} />;
        if (s === 4) return <DhControls a={a} b={b} setA={setA} setB={setB} dh={dh} eve={eve} setEve={setEve} crack={crack} />;
        if (s === 5) return (
          <>
            <span className="tls-live-lbl">send over the secure channel:</span>
            <input className="tls-input" value={msg} maxLength={32} spellCheck={false} onChange={(e) => setMsg(e.target.value)} />
            <span className="tls-live-note">Eve sees {recordBytes(msg)} bytes of ciphertext + a 16-byte tag — no key, no plaintext.</span>
          </>
        );
        return null;
      }}
    />
  );
}

// ── interactive controls ─────────────────────────────────────────────────────
function ForgeControls({ forge, setForge }: { forge: boolean; setForge: (f: boolean) => void }) {
  return (
    <div className="tls-attack">
      <button type="button" className={`tls-attack-btn ${forge ? 'on' : ''}`} onClick={() => setForge(!forge)}>
        {forge ? '↩ use the real certificate' : '🎭 forge bank.com’s certificate'}
      </button>
      <span className="tls-attack-note">
        {forge
          ? <><b className="tls-bad">Rejected.</b> You copied the certificate byte-for-byte, but it binds the CA’s signature to <em>bank.com’s</em> public key — and you don’t have bank.com’s private key. Swap in your own key and the CA signature no longer matches; you can’t re-sign it without the CA’s private key either. The browser bounces it.</>
          : <>The certificate is a CA-signed statement: “this public key belongs to bank.com.” Try to forge it →</>}
      </span>
    </div>
  );
}

function DhControls({ a, b, setA, setB, dh, eve, setEve, crack }: {
  a: number; b: number; setA: (n: number) => void; setB: (n: number) => void;
  dh: ReturnType<typeof dhExchange>; eve: boolean; setEve: (e: boolean) => void;
  crack: { priv: bigint | null; tries: number } | null;
}) {
  return (
    <div className="tls-dh">
      <div className="tls-dh-row">
        <label className="tls-dh-knob">client private <b>a</b>
          <input type="range" min={2} max={21} value={a} onChange={(e) => setA(+e.target.value)} /><b>{a}</b></label>
        <label className="tls-dh-knob">server private <b>b</b>
          <input type="range" min={2} max={21} value={b} onChange={(e) => setB(+e.target.value)} /><b>{b}</b></label>
      </div>
      <div className="tls-dh-out">
        public shares on the wire: <code>A = 5<sup>{a}</sup> mod 23 = {String(dh.A)}</code>, <code>B = 5<sup>{b}</sup> mod 23 = {String(dh.B)}</code> ·
        both derive <code className="tls-dh-secret">secret = {String(dh.sharedAlice)}</code>{dh.agree ? ' ✓ identical, never sent' : ' — mismatch (bug)'}
      </div>
      <div className="tls-dh-eve">
        <button type="button" className={`tls-attack-btn ${eve ? 'on' : ''}`} onClick={() => setEve(!eve)}>
          {eve ? 'hide Eve’s attack' : '👁 let Eve solve the discrete log'}
        </button>
        {crack && crack.priv !== null && (
          <span className="tls-attack-note">
            Eve has <code>A = {String(dh.A)}</code>, <code>B = {String(dh.B)}</code>. She brute-forces the discrete log of A:
            after <b>{crack.tries}</b> tries she recovers <code>a = {String(crack.priv)}</code>, then computes the secret <code>{String(dh.sharedAlice)}</code>.
            <b className="tls-bad"> That only worked because the prime is 23.</b> Real TLS uses a 256-bit group where this search is ~2<sup>128</sup> steps — more than there are atoms in reach. That gap is the whole security.
          </span>
        )}
      </div>
    </div>
  );
}

const recordBytes = (m: string) => new TextEncoder().encode(m).length;
// a deterministic, clearly-fake hex stand-in for ciphertext (the SHAPE of a TLS record, not real encryption)
const fakeCipher = (m: string) => {
  const n = recordBytes(m);
  let h = '';
  for (let i = 0; i < Math.min(n, 8); i++) h += ((m.charCodeAt(i) * 167 + 41) & 0xff).toString(16).padStart(2, '0') + ' ';
  return h.trim() + (n > 8 ? ' …' : '');
};

function Wire({ phase, msg, active, dh, forge }: { phase: Phase; msg: string; active: boolean; dh: ReturnType<typeof dhExchange>; forge: boolean }) {
  const on = (p: Phase) => phase === p;
  const secure = on('secret') || on('data');
  const flow = (x1: number, x2: number, y: number, cls: string, show: boolean) =>
    show && active ? <line className={`tls-flow ${cls}`} x1={x1} y1={y} x2={x2} y2={y} pathLength={100} /> : null;
  return (
    <svg viewBox="0 0 900 480" className="story-svg">
      {/* client + server */}
      <rect x="30" y="120" width="180" height="150" rx="10" className="tls-node" />
      <text x="120" y="150" className="tls-node-lbl" textAnchor="middle">you (browser)</text>
      <text x="120" y="205" className="tls-ico" textAnchor="middle">💻</text>
      <rect x="690" y="120" width="180" height="150" rx="10" className="tls-node" />
      <text x="780" y="150" className="tls-node-lbl" textAnchor="middle">bank.com</text>
      <text x="780" y="205" className="tls-ico" textAnchor="middle">🏦</text>
      {/* the open channel */}
      <rect x="210" y="175" width="480" height="42" rx="6" className={`tls-wire ${secure ? 'secure' : ''}`} />
      <text x="450" y="201" className={`tls-wire-lbl ${secure ? 'secure' : ''}`} textAnchor="middle">{secure ? '🔒 encrypted channel' : 'open channel'}</text>
      {/* Eve */}
      <text x="450" y="300" className="tls-eve-ico" textAnchor="middle">👁</text>
      <text x="450" y="326" className={`tls-eve-lbl ${secure ? 'safe' : 'danger'}`} textAnchor="middle">
        {phase === 'problem' ? 'Eve (ISP · wifi · router) reads everything' : secure ? 'Eve sees only ciphertext — cannot read it' : 'Eve on the path — reads the clear messages'}
      </text>

      {/* per-phase messages on the wire */}
      {on('problem') && <MsgPill x={260} dir="r" cls="danger" text={msg} />}
      {on('problem') && flow(240, 660, 196, 'danger', true)}
      {on('chello') && <MsgPill x={250} dir="r" cls="clear" text={`ClientHello · ciphers · random · A = ${String(dh.A)}`} wide />}
      {on('chello') && flow(240, 660, 196, 'clear', true)}
      {on('shello') && <MsgPill x={250} dir="l" cls="clear" text={`ServerHello · random · B = ${String(dh.B)} · 📜 Certificate`} wide />}
      {on('shello') && flow(660, 240, 196, 'clear', true)}
      {on('verify') && (forge ? <>
        <text x="120" y="245" className="tls-check bad" textAnchor="middle">✗ signature invalid — rejected</text>
        <text x="450" y="150" className="tls-cert forged" textAnchor="middle">🎭 forged cert (CA sig doesn’t match)</text>
      </> : <>
        <text x="120" y="245" className="tls-check" textAnchor="middle">✓ cert chains to a trusted CA</text>
        <text x="450" y="150" className="tls-cert" textAnchor="middle">📜 Certificate (CA-signed)</text>
      </>)}
      {on('secret') && <>
        <text x="120" y="245" className="tls-secret" textAnchor="middle">Bᵃ = {String(dh.sharedAlice)} 🔑</text>
        <text x="780" y="245" className="tls-secret" textAnchor="middle">Aᵇ = {String(dh.sharedBob)} 🔑</text>
        <text x="450" y="243" className="tls-eve-cant" textAnchor="middle">saw A={String(dh.A)}, B={String(dh.B)}</text>
        <text x="450" y="261" className="tls-eve-cant" textAnchor="middle">— can't get {String(dh.sharedAlice)}</text>
      </>}
      {on('data') && <>
        <text x="120" y="250" className="tls-plain" textAnchor="middle">"{msg.slice(0, 18)}"</text>
        <MsgPill x={250} dir="r" cls="cipher" text={`🔒 17 03 03 · ${recordBytes(msg)}B · ${fakeCipher(msg)}`} wide />
        {flow(240, 660, 196, 'cipher', true)}
      </>}
      <text x="450" y="470" className="tls-foot" textAnchor="middle">
        {on('problem') ? 'privacy + authenticity over a channel you do not trust'
          : on('chello') ? 'the public share A is not secret — the secret is what both sides derive from it'
          : on('shello') ? 'the certificate proves the server owns bank.com'
          : on('verify') ? (forge ? 'copying the cert is trivial — re-signing it for your own key is not' : 'copy the cert all you like — you still lack the private key')
          : on('secret') ? 'Diffie–Hellman: a shared secret both compute but neither sends'
          : 'the record shape is real; the ciphertext here is a stand-in (no real key)'}
      </text>
    </svg>
  );
}

function MsgPill({ x, dir, cls, text, wide }: { x: number; dir: 'l' | 'r'; cls: string; text: string; wide?: boolean }) {
  const w = wide ? 400 : 300;
  const px = dir === 'r' ? x : 900 - x - w;
  return (
    <g>
      <rect x={px} y="152" width={w} height="30" rx="15" className={`tls-pill ${cls}`} />
      <text x={px + w / 2} y="172" className="tls-pill-txt" textAnchor="middle">{text}</text>
      <text x={dir === 'r' ? px + w + 6 : px - 6} y="172" className="tls-arrow" textAnchor={dir === 'r' ? 'start' : 'end'}>{dir === 'r' ? '→' : '←'}</text>
    </g>
  );
}
