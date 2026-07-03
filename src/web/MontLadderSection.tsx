// Guided story: the Montgomery ladder — constant-time modular exponentiation / scalar multiplication that resists timing
// and power side-channels. Computing g^k (RSA/DH) or k·P (ECDSA) bit by bit with plain square-and-multiply does an extra
// multiply only on the 1-bits, so a power/timing trace reveals the secret exponent's bits. The Montgomery ladder keeps
// two registers with the invariant R1 = R0·g and does EXACTLY one multiply + one square per bit regardless of the bit —
// only which register receives which result differs (swapped by the bit). Verified in node: the ladder's result equals
// naive g^k mod p, and its operation count is always 2·(bit length), independent of the key's Hamming weight (whereas
// square-and-multiply's count leaks the weight). Used in X25519, ECDSA, and RSA. Sandboxed/CONCEPTUAL.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const G = 7n, P = 1009n;
type Op = 'sqr' | 'mul';
function ladder(k: bigint): { y: bigint; ops: Op[]; bits: string } { let R0 = 1n, R1 = G % P; const ops: Op[] = []; const bits = k.toString(2);
  for (const c of bits) { if (c === '1') { R0 = R0 * R1 % P; R1 = R1 * R1 % P; } else { R1 = R0 * R1 % P; R0 = R0 * R0 % P; } ops.push('mul', 'sqr'); } return { y: R0, ops, bits }; }
function sqmul(k: bigint): { y: bigint; perBit: Op[][]; bits: string } { let r = 1n; const perBit: Op[][] = []; const bits = k.toString(2);
  for (const c of bits) { const o: Op[] = ['sqr']; r = r * r % P; if (c === '1') { o.push('mul'); r = r * G % P; } perBit.push(o); } return { y: r, perBit, bits }; }

const KEYS = [{ label: 'k=201', k: 201n }, { label: 'k=255 (all 1s)', k: 255n }, { label: 'k=128 (one 1)', k: 128n }, { label: 'k=170 (10101010)', k: 170n }];

type Phase = 'leak' | 'sqmul' | 'ladder' | 'flat' | 'cost' | 'run';
export function MontLadderSection() {
  const [ki, setKi] = useState(0); const k = KEYS[ki].k;
  const L = ladder(k), S = sqmul(k);
  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <ML phase={key} k={201n} /> });

  const scenes: StoryScene[] = [
    scene('leak', 'The secret leaks through timing', 'Computing g^k mod N (RSA, Diffie–Hellman) or k·P on a curve (ECDSA) means walking the secret exponent k bit by bit. The obvious method — square-and-multiply — does an extra multiply only on the 1-bits. So the running time and the power draw depend on the secret: measure them and you read off where the 1-bits are.'),
    scene('sqmul', 'Square-and-multiply is data-dependent', 'One square per bit, plus one multiply per 1-bit. A key that is mostly zeros runs far fewer operations than a dense one; a power trace shows an extra bump exactly at each 1-bit. The sequence of operations is a picture of the secret key — a devastating side channel.'),
    scene('ladder', 'The Montgomery ladder', 'Keep two registers with the invariant R1 = R0·g. For each bit do EXACTLY one multiply and one square: on a 0, set R1 = R0·R1 then R0 = R0²; on a 1, set R0 = R0·R1 then R1 = R1². The only difference between a 0 and a 1 is which register receives which result — same operations, same count, every single bit. (Verified: always 2 ops per bit.)'),
    scene('flat', 'Constant-time by construction', 'Because every bit triggers the identical multiply-then-square, the timing and the power trace are flat — they reveal nothing about k. Paired with a constant-time conditional swap (no data-dependent branch or memory access), the secret exponent is invisible to a side-channel attacker, while the result is exactly g^k. (Verified against naive exponentiation.)'),
    scene('cost', 'The cost of hiding', 'The ladder does 2 operations per bit; square-and-multiply averages about 1.5 (one square always, a multiply half the time). So the ladder is modestly slower — the price of not leaking. Every serious library pays it: X25519, ECDSA nonce multiplication, and RSA private-key operations all use the ladder or an equivalent constant-time routine.'),
    { key: 'run', title: 'Watch the side channel', caption: 'Pick a key and compare the two operation traces computing the same g^k. Square-and-multiply’s trace has gold multiply-spikes exactly at the 1-bits — read them off and you have the key. The Montgomery ladder’s trace is a uniform multiply-square for every bit, identical no matter what the key is. Same answer; one leaks, one doesn’t.', render: () => <ML phase="run" k={k} L={L} S={S} onKey={setKi} ki={ki} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>The <strong>Montgomery ladder</strong> computes g^k (or k·P) without leaking the secret exponent k through timing or power. Plain <strong>square-and-multiply</strong> does an extra multiply only on the 1-bits, so its operation sequence — visible on a power trace — spells out the key. The ladder keeps two registers with the invariant R1 = R0·g and performs <strong>exactly one multiply and one square per bit</strong>, differing only in which register gets which result. Identical operations every bit means a flat, secret-independent trace — constant-time by construction.</>,
        takeaway: <>Modular exponentiation and elliptic-curve scalar multiplication are the core of RSA, Diffie–Hellman, and ECDSA, and they consume a <strong>secret</strong> exponent/scalar. The textbook <strong>square-and-multiply</strong> scans k’s bits doing one squaring each and an extra multiplication on every 1-bit — so its run time, cache footprint, and power consumption are <strong>data-dependent</strong>, and a <strong>side-channel</strong> attacker (timing, SPA/DPA power analysis) recovers the key bit-by-bit; the branch on the bit is the leak. The <strong>Montgomery ladder</strong> removes it. It maintains two accumulators with the invariant <strong>R1 = R0·g</strong> (they always differ by a factor of g), and at each bit performs a fixed pair of operations: bit 0 → R1 ← R0·R1, R0 ← R0²; bit 1 → R0 ← R0·R1, R1 ← R1². Every bit does <strong>one multiply and one square</strong> — the same operations in the same order — so the instruction trace, timing, and power are <strong>independent of the key</strong> (verified here: the ladder’s op-count is always 2·bitlength regardless of Hamming weight, and its result matches naive g^k). To be truly constant-time the bit must select the registers without a data-dependent branch or lookup — a <strong>conditional swap</strong> done with arithmetic masks (cswap). The ladder costs about 2 operations per bit versus square-and-multiply’s ~1.5 average, a modest slowdown that buys side-channel resistance, which is why it is standard in <strong>X25519</strong> (where it also enables x-coordinate-only, y-free curve arithmetic), ECDSA, and hardened RSA. It generalizes the same idea as fast doubling in Lucas sequences and Fibonacci computation. Constant-time discipline — no secret-dependent branches, indices, or early exits — is the same principle behind constant-time string comparison and the fixes for timing attacks throughout cryptographic code.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="mgl-ctl">
          {KEYS.map((kk, i) => <button key={i} type="button" className={`mgl-btn ${ki === i ? 'on' : ''}`} onClick={() => setKi(i)}>{kk.label}</button>)}
          <span className="mgl-read">g^k mod {P.toString()} = {L.y.toString()} · both agree {L.y === S.y ? '✓' : '✗'}</span>
        </div>
      )}
    />
  );
}

function ML({ phase, k, L, S, onKey, ki }: { phase: Phase; k: bigint; L?: ReturnType<typeof ladder>; S?: ReturnType<typeof sqmul>; onKey?: (i: number) => void; ki?: number }) {
  const on = (p: Phase) => phase === p; void onKey; void ki;
  const lad = L || ladder(k); const sq = S || sqmul(k);
  const bits = lad.bits; const OX = 60, CW = Math.min(56, (640) / bits.length), CELL = 10;
  return (
    <svg viewBox="0 0 760 300" className="story-svg">
      <text x="56" y="20" className="mgl-col">g^k mod {P.toString()} · k = {k.toString()} = {bits}₂ · square-and-multiply LEAKS, Montgomery ladder is FLAT</text>

      {/* key bits */}
      <text x={OX - 8} y={54} className="mgl-lbl" textAnchor="end">key k</text>
      {bits.split('').map((b, i) => <text key={i} x={OX + i * CW + CW / 2} y={54} className={`mgl-bit ${b === '1' ? 'one' : ''}`} textAnchor="middle">{b}</text>)}

      {/* square-and-multiply trace: sqr always, +mul (gold spike) on 1-bits */}
      <text x={OX - 8} y={92} className="mgl-lbl" textAnchor="end">square-<tspan className="mgl-warn">&amp;</tspan>-mul</text>
      {sq.perBit.map((ops, i) => <g key={i}>
        {ops.map((o, j) => <rect key={j} x={OX + i * CW + 4 + j * (CELL + 2)} y={o === 'mul' ? 74 : 80} width={CELL} height={o === 'mul' ? 22 : 16} rx="2" className={`mgl-op ${o}`} />)}
        {ops.length > 1 && <text x={OX + i * CW + CW / 2} y={110} className="mgl-leak" textAnchor="middle">↑1</text>}
      </g>)}

      {/* montgomery ladder trace: mul+sqr every bit, uniform */}
      <text x={OX - 8} y={150} className="mgl-lbl" textAnchor="end">ladder</text>
      {bits.split('').map((_b, i) => <g key={i}>
        <rect x={OX + i * CW + 4} y={132} width={CELL} height={22} rx="2" className="mgl-op mul" />
        <rect x={OX + i * CW + 4 + CELL + 2} y={138} width={CELL} height={16} rx="2" className="mgl-op sqr" />
      </g>)}
      <text x={OX} y={176} className="mgl-flat">every bit: 1 multiply + 1 square — identical, key-independent</text>

      {/* legend + result */}
      <rect x={OX} y={196} width={10} height={10} className="mgl-op sqr" /><text x={OX + 16} y={205} className="mgl-lg">square</text>
      <rect x={OX + 74} y={196} width={10} height={10} className="mgl-op mul" /><text x={OX + 90} y={205} className="mgl-lg">multiply</text>
      <text x={OX + 180} y={205} className="mgl-res">square-&amp;-mul: {sq.perBit.flat().length} ops (leaks) · ladder: {lad.ops.length} ops (always 2/bit) · g^k = {lad.y.toString()}</text>

      <text x="380" y="284" className="mgl-foot" textAnchor="middle">
        {on('leak') ? 'the secret exponent leaks through timing / power'
          : on('sqmul') ? 'extra multiply on each 1-bit → the trace spells out the key'
          : on('ladder') ? 'two registers, R1 = R0·g; every bit: 1 multiply + 1 square'
          : on('flat') ? 'identical ops every bit → flat trace, nothing to read'
          : on('cost') ? '2 ops/bit vs ~1.5 — modest cost to not leak the key'
          : `${sq.perBit.flat().length} vs ${lad.ops.length} ops — the ladder hides the ${[...bits].filter((c) => c === '1').length} one-bits`}
      </text>
    </svg>
  );
}
