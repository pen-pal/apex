// The padding-oracle attack, deep-taught on the GuidedStory engine (offensive arc, phase 2). The server holds a secret
// block you can't see; all it ever tells you is "valid padding" or "invalid padding." That one bit, plus CBC's
// P = Decrypt(C) XOR prev, lets an attacker peel the plaintext off a byte at a time — no key. Narrated scenes walk the
// mechanism; the interactive runs the REAL byte-by-byte recovery from the tested paddingoracle.ts module. Sandboxed
// (a toy block cipher in the module), defenses-forward. Verified against the module's own oracle, not restated here.
import { useMemo, useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';
import { attackTraced, padBlock, B } from './paddingoracle';

const chr = (b: number) => (b >= 32 && b < 127 ? String.fromCharCode(b) : '·');
const hex = (b: number) => b.toString(16).padStart(2, '0');
const IV = [0x9f, 0x1a, 0x2b, 0x3c, 0x4d, 0x5e, 0x6f, 0x70];

type Phase = 'oracle' | 'cbc' | 'last' | 'shift' | 'whole' | 'run';

export function PaddingOracleSection() {
  const [secret, setSecret] = useState('cash=10');
  const [revealed, setRevealed] = useState(0); // bytes recovered so far (steps go pos B-1 → 0)

  const run = useMemo(() => attackTraced(padBlock(secret), IV), [secret]);

  const sceneReveal: Record<Exclude<Phase, 'run'>, number> = { oracle: 0, cbc: 0, last: 1, shift: 3, whole: B };

  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <Pad phase={key} revealed={sceneReveal[key]} run={run} /> });

  const scenes: StoryScene[] = [
    scene('oracle', 'A one-bit oracle', 'The server decrypts your ciphertext and, before it looks at anything else, checks whether the PKCS#7 padding is well-formed — then tells you only “valid” or “invalid.” One bit. It seems harmless: you haven’t learned any plaintext. But you are about to learn all of it.'),
    scene('cbc', 'CBC leaks through the padding', 'In CBC mode the plaintext is P = Decrypt(C) XOR prev, where prev is the previous ciphertext block (or the IV). You can’t compute Decrypt(C) — that needs the key — but you completely control prev. Change a byte of prev and you change the same byte of the decrypted plaintext, which changes whether the padding is valid.'),
    scene('last', 'Recover the last byte', 'Brute-force the last byte of prev, 0–255, until the server says “valid.” Valid padding of length 1 means the last plaintext byte is 0x01 — so Decrypt(C)’s last byte = your forged byte XOR 0x01. XOR that with the real prev byte and you have the real plaintext byte. One byte, in ~128 queries on average, with no key.'),
    scene('shift', 'March right to left', 'For the next byte, aim for padding 0x02 0x02: use the intermediate value you just learned to set the last byte to 0x02, then brute the second-to-last until “valid.” Each recovered byte lets you forge a longer valid pad and attack the next one — the plaintext falls from right to left.'),
    scene('whole', 'The whole block, no key', 'Repeat across the block and every byte is recovered in about a thousand oracle queries. The block cipher was never broken and the key was never touched; the server simply answered one yes/no question too many times.'),
    { key: 'run', title: 'Run the real attack', caption: 'Recover the block one byte at a time (or all at once). This runs the actual attack from the tested crypto module against a toy CBC cipher — watch the plaintext fall from the right and the oracle-query count climb. Type your own secret to attack a different block.', render: () => <Pad phase="run" revealed={revealed} run={run} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>A server decrypts your ciphertext and, before doing anything else, checks whether the PKCS#7 <strong>padding</strong> is well-formed — then tells you only “valid” or “invalid.” That single bit looks harmless. But CBC mode has the property <code>P = Decrypt(C) XOR prev</code>, and the attacker fully controls <code>prev</code>. By forging the previous block one byte at a time and watching whether the padding comes out valid, they peel the plaintext off — about one byte per ~128 queries — without ever learning the key.</>,
        takeaway: <>Forcing valid padding of length 1 means the last plaintext byte is <code>0x01</code>, which pins down <code>Decrypt(C)</code>’s last byte (<code>forged_prev XOR 0x01</code>); XOR with the real <code>prev</code> gives the real plaintext byte. Then fake a padding of <code>0x02 0x02</code> to march to the next byte, right to left, until the whole block is recovered in about a thousand queries. The bug isn’t the padding — it’s that the server distinguished a <em>padding</em> error from other errors (the classic version even leaked it through <strong>timing</strong>: valid padding ran longer because it went on to check the MAC — Lucky Thirteen). The fix is authenticated encryption (AES-GCM, ChaCha20-Poly1305) or encrypt-then-MAC with the MAC verified in constant time <em>before</em> the padding is examined, so a forged ciphertext fails the MAC and there is no oracle. This is exactly why modern TLS dropped CBC-mode ciphersuites. (Vaudenay 2002; ASP.NET 2010; Lucky Thirteen 2013.)</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <>
          <label className="pdo-field2">secret block<input value={secret} onChange={(e) => { setSecret(e.target.value); setRevealed(0); }} maxLength={B} spellCheck={false} /></label>
          <button type="button" className="pdo-btn" disabled={revealed >= B} onClick={() => setRevealed((r) => Math.min(B, r + 1))}>recover next byte →</button>
          <button type="button" className="pdo-btn strong" disabled={revealed >= B} onClick={() => setRevealed(B)}>run full attack</button>
          <button type="button" className="pdo-btn ghost" onClick={() => setRevealed(0)}>reset</button>
        </>
      )}
    />
  );
}

function Pad({ phase, revealed, run }: { phase: Phase; revealed: number; run: ReturnType<typeof attackTraced> }) {
  const done = new Map<number, number>();
  let queries = 0;
  for (let i = 0; i < revealed; i++) { const st = run.steps[i]; done.set(st.pos, st.plaintextByte); queries += st.queries; }
  const focus = revealed < B ? run.steps[revealed]?.pos : -1; // the byte currently being brute-forced
  const W = 92, X0 = 82, padLen = done.get(B - 1);
  return (
    <svg viewBox="0 0 900 480" className="story-svg">
      <text x="450" y="70" className="pdo-s-oracle" textAnchor="middle">server checks PKCS#7 padding → answers only “valid” or “invalid” (1 bit)</text>
      <text x="450" y="150" className="pdo-s-eq" textAnchor="middle">P = Decrypt(C) ⊕ prev — you can’t compute Decrypt(C), but you fully control prev</text>

      <text x={X0 - 4} y="228" className="pdo-s-rowlbl" textAnchor="end">plaintext</text>
      {Array.from({ length: B }, (_, i) => {
        const got = done.has(i);
        const isFocus = i === focus;
        const pad = got && padLen !== undefined && i >= B - padLen;
        return (
          <g key={i}>
            <rect x={X0 + i * W} y={200} width={W - 10} height="52" rx="6" className={`pdo-s-pt ${got ? (pad ? 'pad' : 'got') : isFocus ? 'focus' : 'hidden'}`} />
            <text x={X0 + i * W + (W - 10) / 2} y={226} className="pdo-s-char" textAnchor="middle">{got ? chr(done.get(i)!) : (isFocus ? '?' : '·')}</text>
            <text x={X0 + i * W + (W - 10) / 2} y={244} className="pdo-s-hex" textAnchor="middle">{got ? hex(done.get(i)!) : '··'}</text>
          </g>
        );
      })}
      {focus >= 0 && <text x={X0 + focus * W + (W - 10) / 2} y={190} className="pdo-s-focus" textAnchor="middle">brute-forcing ↓</text>}

      <text x="450" y="308" className="pdo-s-note" textAnchor="middle">
        {phase === 'oracle' ? 'one yes/no bit per query — and the attacker can ask as many as it likes'
          : phase === 'cbc' ? 'flip a byte of prev → flips the same byte of P → changes whether the padding is valid'
          : phase === 'last' ? 'forced pad 0x01 → Decrypt(C)[last] = forged ⊕ 0x01 → plaintext = that ⊕ real prev'
          : phase === 'shift' ? 'set the known tail to 0x02 0x02… then brute the next byte, leftward'
          : phase === 'whole' ? 'every byte recovered — the block cipher was never broken'
          : `${queries} oracle queries · ${revealed}/${B} bytes recovered`}
      </text>

      {(phase === 'whole' || (phase === 'run' && revealed >= B)) && (
        <text x="450" y="352" className="pdo-s-win" textAnchor="middle">☠ recovered “{run.recovered.map(chr).join('')}” in {run.totalQueries} queries — full plaintext, no key</text>
      )}
    </svg>
  );
}
