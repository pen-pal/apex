// Guided story #5: how public-key crypto works — sharing a secret with someone you've never met, over a tapped
// line. The concept RSA/ECC/the TLS handshake all rest on. Scenes: the chicken-and-egg problem, the padlock idea,
// the one-way (trapdoor) function, a REAL tiny RSA encrypt then decrypt, signatures (the same trick backwards), and
// a live box you encrypt/decrypt in. All numbers are real: p=61 q=53 → n=3233, e=17, d=2753 (e·d ≡ 1 mod φ), so
// 65^17 mod 3233 = 2790 and 2790^2753 mod 3233 = 65. This is the intuition; the RSA section is the mechanics.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const N = 3233n, E = 17n, D = 2753n;
const modpow = (b: bigint, e: bigint, n: bigint) => { let r = 1n; b %= n; while (e > 0n) { if (e & 1n) r = r * b % n; b = b * b % n; e >>= 1n; } return r; };

type Phase = 'problem' | 'padlock' | 'trapdoor' | 'encrypt' | 'decrypt' | 'run';

export function PubKeySection() {
  const [m, setM] = useState(65);
  const mm = BigInt(Math.max(0, Math.min(3232, m)));
  const c = modpow(mm, E, N);
  const back = modpow(c, D, N);

  const narrated = (key: Phase, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: (a) => <Board phase={key} m={65} c={2790n} back={65n} active={a} /> });

  const scenes: StoryScene[] = [
    narrated('problem', 'Sharing a secret with a stranger', 'You want to send your bank a secret, but you have never met and everyone on the line is listening. A single shared key would work — except you would have to agree on it first, over this same tapped line. Chicken and egg.'),
    narrated('padlock', 'The padlock idea', 'What if the bank hands out open padlocks anyone can snap shut, but keeps the only key that opens them? You lock your message in their padlock and send it. Eve can grab the padlock too — but a padlock does not help you open one. Public to lock, private to unlock.'),
    narrated('trapdoor', 'A one-way door', 'The padlock is a function that is easy forward and hard backward. Multiplying two primes is easy: 61 × 53 = 3233. Factoring the product back into 61 and 53 is hard — and for 600-digit numbers, harder than all the computers on Earth can manage. The product is public; the two factors are the private secret.'),
    narrated('encrypt', 'Encrypt — the public way', 'The public key is (n = 3233, e = 17). To send the number 65, anyone computes 65^17 mod 3233 = 2790 and sends that. Eve sees 2790 and the public key — and is stuck, because undoing it needs the factors.'),
    narrated('decrypt', 'Decrypt — the private way', 'The bank derived a private exponent d = 2753 from the two factors. 2790^2753 mod 3233 = 65. Only the holder of d can walk back through the door. The maths works because e and d are inverses modulo (p−1)(q−1).'),
    { key: 'run', title: 'Signatures, and try it yourself', caption: 'Run it backwards and you get signatures: the bank encrypts a hash with its PRIVATE key; anyone verifies with the PUBLIC key, proving it came from the bank. That is exactly how a TLS certificate is signed. Pick a number and watch it go out with the public key and come back with the private one.', render: (a) => <Board phase="run" m={Number(mm)} c={c} back={back} active={a} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <>
          <span className="pk-live-lbl">encrypt a number (0–3232):</span>
          <input className="pk-input" type="number" min={0} max={3232} value={m} onChange={(e) => setM(Number(e.target.value) || 0)} />
          <span className="pk-live-note">{m}^17 mod 3233 = <b>{String(c)}</b> → decrypt → <b>{String(back)}</b> {back === mm ? '✓' : ''}</span>
        </>
      )}
    />
  );
}

function Board({ phase, m, c, back, active }: { phase: Phase; m: number; c: bigint; back: bigint; active: boolean }) {
  const on = (p: Phase) => phase === p;
  const secure = on('encrypt') || on('decrypt') || on('run');
  const flow = (x1: number, x2: number, cls: string, show: boolean) =>
    show && active ? <line className={`pk-flow ${cls}`} x1={x1} y1={196} x2={x2} y2={196} pathLength={100} /> : null;
  return (
    <svg viewBox="0 0 900 480" className="story-svg">
      {/* You + Bank */}
      <rect x="30" y="120" width="160" height="150" rx="10" className="pk-node" />
      <text x="110" y="150" className="pk-node-lbl" textAnchor="middle">you</text>
      <text x="110" y="205" className="pk-ico" textAnchor="middle">🙂</text>
      <rect x="710" y="120" width="160" height="150" rx="10" className="pk-node" />
      <text x="790" y="150" className="pk-node-lbl" textAnchor="middle">bank</text>
      <text x="790" y="205" className="pk-ico" textAnchor="middle">🏦</text>
      {/* Eve */}
      <text x="450" y="330" className="pk-eve-ico" textAnchor="middle">👁</text>
      <text x="450" y="356" className={`pk-eve-lbl ${secure ? 'safe' : 'danger'}`} textAnchor="middle">
        {on('problem') ? 'Eve reads the line' : secure ? 'Eve has n, e, and the ciphertext — and cannot invert it' : 'Eve is on the line'}
      </text>

      {on('problem') && <>
        <rect x="250" y="180" width="400" height="32" rx="16" className="pk-pill danger" />
        <text x="450" y="201" className="pk-pill-txt" textAnchor="middle">secret →</text>
        {flow(200, 700, 'danger', true)}
        <text x="450" y="250" className="pk-mid" textAnchor="middle">…but to use one shared key, you must first share it — here</text>
      </>}
      {on('padlock') && <>
        <text x="300" y="200" className="pk-lock" textAnchor="middle">🔓</text>
        <text x="300" y="235" className="pk-mid" textAnchor="middle">public padlock ← bank</text>
        <text x="600" y="200" className="pk-lock" textAnchor="middle">🔑</text>
        <text x="600" y="235" className="pk-mid" textAnchor="middle">private key (bank only)</text>
      </>}
      {on('trapdoor') && <>
        <text x="450" y="175" className="pk-easy" textAnchor="middle">61 × 53 = 3233   (easy →)</text>
        <text x="450" y="220" className="pk-hard" textAnchor="middle">3233 = ? × ?   (hard ✗)</text>
        <text x="450" y="262" className="pk-mid" textAnchor="middle">public key = the product · private key = the two factors</text>
      </>}
      {(on('encrypt') || on('decrypt') || on('run')) && <>
        <text x="110" y="245" className="pk-keytag pub" textAnchor="middle">public: n=3233, e=17</text>
        <text x="790" y="245" className="pk-keytag priv" textAnchor="middle">private: d=2753</text>
      </>}
      {on('encrypt') && <>
        <text x="450" y="180" className="pk-math" textAnchor="middle">{m}^17 mod 3233 = {String(c)}</text>
        <rect x="330" y="182" width="240" height="30" rx="15" className="pk-pill cipher" />
        <text x="450" y="203" className="pk-pill-txt" textAnchor="middle">🔒 {String(c)} →</text>
        {flow(200, 700, 'cipher', true)}
      </>}
      {on('decrypt') && <>
        <text x="450" y="180" className="pk-math" textAnchor="middle">{String(c)}^2753 mod 3233 = {String(back)}</text>
        <text x="450" y="230" className="pk-recovered" textAnchor="middle">recovered the original: {String(back)}</text>
      </>}
      {on('run') && <>
        <rect x="330" y="182" width="240" height="30" rx="15" className="pk-pill cipher" />
        <text x="450" y="203" className="pk-pill-txt" textAnchor="middle">🔒 {String(c)} →</text>
        {flow(200, 700, 'cipher', true)}
        <text x="450" y="250" className="pk-mid" textAnchor="middle">sign = encrypt a hash with the private key; verify with the public key</text>
      </>}
      <text x="450" y="440" className="pk-foot" textAnchor="middle">
        {on('problem') ? 'symmetric crypto needs a shared key first — public-key crypto does not'
          : on('padlock') ? 'the lock is public, the unlock is private — that asymmetry is the whole idea'
          : on('trapdoor') ? 'easy one way, infeasible the other, unless you know the trapdoor (the factors)'
          : on('encrypt') ? 'everyone can encrypt to the bank; only the bank can read it'
          : on('decrypt') ? 'e and d are inverses mod (p−1)(q−1), so d undoes e — real numbers, verified'
          : 'the same asymmetry gives both secrecy and signatures'}
      </text>
    </svg>
  );
}
