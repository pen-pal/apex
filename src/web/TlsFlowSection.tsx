// Guided story #3: how HTTPS secures a connection — the TLS 1.3 handshake, on the GuidedStory engine. One stable
// client ↔ server ↔ eavesdropper diagram; each scene sends the phase's real messages across the open channel and
// shows what someone on the path can and cannot read. Honest to the correctness creed: ECDHE yields a shared secret
// that is never transmitted, and application data is opaque ciphertext (record shape, not invented plaintext).
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

type Phase = 'problem' | 'chello' | 'shello' | 'verify' | 'secret' | 'data';

export function TlsFlowSection() {
  const [msg, setMsg] = useState('password: hunter2');

  const narrated = (key: Phase, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: (a) => <Wire phase={key} msg="password: hunter2" active={a} /> });

  const scenes: StoryScene[] = [
    narrated('problem', 'The problem', 'You send a password to your bank across the open internet. Every router, ISP, and wifi access point on the path can read every byte. You need privacy and proof of who you are talking to — over a channel you do not trust.'),
    narrated('chello', 'ClientHello', 'The browser opens in the clear: the TLS versions and cipher suites it supports, a random nonce, and (TLS 1.3) an ephemeral ECDHE public key share. Anyone can read this — that is fine, none of it is secret.'),
    narrated('shello', 'ServerHello + certificate', 'The server picks a cipher, sends its own random and ECDHE key share, and its certificate — its public key, signed by a Certificate Authority.'),
    narrated('verify', 'Verify identity', 'The browser checks the certificate chains to a trusted root CA and matches the domain. This is what stops an impostor: an attacker can copy the certificate, but cannot forge the CA signature or the matching private key.'),
    narrated('secret', 'Shared secret, never sent', 'Each side combines its own private key with the other side’s public share (ECDHE) and derives the identical secret — which was never transmitted. Eve saw both public shares and still cannot compute it.'),
    { key: 'data', title: 'Encrypted application data', caption: 'Keys derived from that secret encrypt everything after. To anyone on the path it is an opaque record: a small header, a length, ciphertext, and an authentication tag. Type something and watch it become bytes Eve cannot read.', render: (a) => <Wire phase="data" msg={msg} active={a} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>You want to send your bank a password across the open internet, where every router, Wi-Fi point, and ISP on the path can read whatever crosses the wire — and you have never met the bank to agree on a secret code first. TLS builds a private, authenticated channel over that untrusted path anyway. The story walks the TLS 1.3 handshake from the eavesdropper’s point of view, so you can see exactly what leaks and what stays safe.</>,
        takeaway: <>It solves three problems at once. <em>Who are you talking to?</em> — the server’s certificate, signed by a Certificate Authority the browser trusts, proves it really owns the domain. <em>How do you share a key over a tapped line?</em> — ECDHE has both sides mix their own private value with the other’s public value to derive the identical secret, while only the public values ever cross the wire, so a listener can’t reconstruct it. <em>How do you stay private?</em> — that secret keys the encryption, turning your data into opaque ciphertext. Defeat any one and the channel is no longer both private and trustworthy.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <>
          <span className="tls-live-lbl">send over the secure channel:</span>
          <input className="tls-input" value={msg} maxLength={32} spellCheck={false} onChange={(e) => setMsg(e.target.value)} />
          <span className="tls-live-note">Eve sees {recordBytes(msg)} bytes of ciphertext + a 16-byte tag — no key, no plaintext.</span>
        </>
      )}
    />
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

function Wire({ phase, msg, active }: { phase: Phase; msg: string; active: boolean }) {
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
      {on('chello') && <MsgPill x={250} dir="r" cls="clear" text="ClientHello · ciphers · random · key share gᵃ" wide />}
      {on('chello') && flow(240, 660, 196, 'clear', true)}
      {on('shello') && <MsgPill x={250} dir="l" cls="clear" text="ServerHello · random · gᵇ · Certificate" wide />}
      {on('shello') && flow(660, 240, 196, 'clear', true)}
      {on('verify') && <text x="120" y="245" className="tls-check" textAnchor="middle">✓ cert chains to a trusted CA</text>}
      {on('verify') && <text x="450" y="150" className="tls-cert" textAnchor="middle">📜 Certificate (CA-signed)</text>}
      {on('secret') && <>
        <text x="120" y="245" className="tls-secret" textAnchor="middle">gᵃᵇ 🔑</text>
        <text x="780" y="245" className="tls-secret" textAnchor="middle">gᵃᵇ 🔑</text>
        <text x="450" y="245" className="tls-eve-cant" textAnchor="middle">saw gᵃ, gᵇ — can't get gᵃᵇ</text>
      </>}
      {on('data') && <>
        <text x="120" y="250" className="tls-plain" textAnchor="middle">"{msg.slice(0, 18)}"</text>
        <MsgPill x={250} dir="r" cls="cipher" text={`🔒 17 03 03 · ${recordBytes(msg)}B · ${fakeCipher(msg)}`} wide />
        {flow(240, 660, 196, 'cipher', true)}
      </>}
      <text x="450" y="470" className="tls-foot" textAnchor="middle">
        {on('problem') ? 'privacy + authenticity over a channel you do not trust'
          : on('chello') ? 'nothing here is secret — the point is what happens next'
          : on('shello') ? 'the certificate proves the server owns bank.com'
          : on('verify') ? 'copy the cert all you like — you still lack the private key'
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
