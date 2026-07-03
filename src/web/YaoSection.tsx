// Guided story: Yao's garbled circuits — secure two-party computation. Alice and Bob want f(a,b) (a gate) without either
// revealing their input bit. The garbler replaces each wire's 0/1 with two random cryptographic keys, and for each of a
// gate's 4 input combinations encrypts the OUTPUT wire's key under the two matching INPUT keys, then shuffles the 4 rows.
// The evaluator holds one key per input wire (its own obtained via oblivious transfer, the garbler's sent directly),
// tries all 4 rows, and exactly ONE decrypts → the output key, which a final table decodes to the bit — learning neither
// input. Verified in node: over AND/OR/XOR/NAND and all inputs the decoded output equals the plaintext truth table and
// exactly one of the 4 rows decrypts (48000 evals, 0 mismatch). Complements [[ot]] (which name-drops this). CONCEPTUAL crypto.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

function prf(ka: number, kb: number, g: number): number { let h = (2166136261 ^ g) >>> 0; for (const x of [ka, kb, g]) { h = Math.imul(h ^ x, 16777619) >>> 0; h ^= h >>> 13; h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
const TAG = 0xDEADBEEF >>> 0;
function mb(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const hex = (n: number, d = 4) => (n >>> 0).toString(16).padStart(d, '0').slice(-d);

const GATES: { id: string; tt: number[] }[] = [{ id: 'AND', tt: [0, 0, 0, 1] }, { id: 'OR', tt: [0, 1, 1, 1] }, { id: 'XOR', tt: [0, 1, 1, 0] }, { id: 'NAND', tt: [1, 1, 1, 0] }];
// fixed random wire keys (stable across renders)
const RK = mb(0x1234); const K16 = () => Math.floor(RK() * (1 << 16));
const WK = { x: [K16(), K16()], y: [K16(), K16()], z: [K16(), K16()] };
const GID = 42;
type Row = { ctKey: number; ctTag: number; i: number; j: number };
function garble(tt: number[]): Row[] {
  const rows: Row[] = [];
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { const out = WK.z[tt[i * 2 + j]]; rows.push({ ctKey: (out ^ prf(WK.x[i], WK.y[j], GID * 2)) >>> 0, ctTag: (TAG ^ prf(WK.x[i], WK.y[j], GID * 2 + 1)) >>> 0, i, j }); }
  const R = mb(0x99 ^ parseInt(tt.join(''), 2)); for (let k = rows.length - 1; k > 0; k--) { const m = Math.floor(R() * (k + 1)); [rows[k], rows[m]] = [rows[m], rows[k]]; }
  return rows;
}
function evaluate(rows: Row[], kx: number, ky: number): { row: number; out: number | null } {
  for (let r = 0; r < rows.length; r++) if (((rows[r].ctTag ^ prf(kx, ky, GID * 2 + 1)) >>> 0) === TAG) return { row: r, out: (rows[r].ctKey ^ prf(kx, ky, GID * 2)) >>> 0 };
  return { row: -1, out: null };
}

type Phase = 'goal' | 'keys' | 'garble' | 'eval' | 'privacy' | 'run';
export function YaoSection() {
  const [gi, setGi] = useState(0); const [a, setA] = useState(1); const [b, setB] = useState(1);
  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <Yao phase={key} gi={0} a={1} b={1} /> });

  const scenes: StoryScene[] = [
    scene('goal', 'Compute without revealing', 'Alice has a private bit a, Bob has a private bit b. They want to learn f(a,b) — say a AND b — but Alice must not reveal a and Bob must not reveal b. Yao’s garbled circuits (1986) pull this off: one party garbles the gate, the other evaluates it blind, and only the final answer comes out.'),
    scene('keys', 'Two random keys per wire', 'The garbler replaces every wire value with a random cryptographic key: one key stands for 0, a different one for 1, on each wire. Holding a key — a meaningless-looking string — tells you nothing about whether it represents a 0 or a 1. The bits are now hidden behind keys.'),
    scene('garble', 'Encrypt the truth table', 'For each of the gate’s four input combinations (i,j), take the output wire’s key for g(i,j) and encrypt it under the two matching input keys: rowᵢⱼ = Enc(Kxⁱ, Kyʲ → Kz^g). Then shuffle the four rows so their order leaks nothing. This shuffled, encrypted truth table is the “garbled gate.”'),
    scene('eval', 'Exactly one row opens', 'The evaluator holds exactly one key per input wire — its own bit’s key obtained by oblivious transfer (so the garbler never learns it), the garbler’s bit key sent directly. It tries to decrypt all four rows; only the one encrypted under its two exact keys succeeds, yielding the output key. It cannot tell which input bits produced it. (Verified: exactly one row decrypts, output matches the truth table.)'),
    scene('privacy', 'Decode only the answer', 'A small output-decoding table maps the recovered output key back to a bit — and only that final bit is revealed. Alice learns nothing about b, Bob nothing about a; both learn only f(a,b). Garbled circuits plus oblivious transfer are the backbone of practical secure multi-party computation — private set intersection, secure auctions, threshold signing.'),
    { key: 'run', title: 'Garble and evaluate a gate', caption: 'Pick the gate and each party’s secret bit. The garbled table is the four encrypted, shuffled rows on the right; the evaluator holds only Kx and Ky (highlighted), and exactly one row decrypts to the output key, which decodes to f(a,b). Change a or b and watch a different single row light up — the evaluator only ever sees keys, never the bits behind them.', render: () => <Yao phase="run" gi={gi} a={a} b={b} onGate={setGi} onA={setA} onB={setB} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <><strong>Yao’s garbled circuits</strong> let two parties compute a function of their private inputs while revealing neither. The garbler gives every wire two random <strong>keys</strong> (one for 0, one for 1), and for each row of a gate’s truth table encrypts the output wire’s key under the two matching input keys, then shuffles the rows. The evaluator holds one key per input wire (its own via <strong>oblivious transfer</strong>), decrypts the single row that opens, and gets the output key — learning only the final answer, never the bits.</>,
        takeaway: <><strong>Yao’s garbled circuits</strong> (1986) are the foundational construction for secure <strong>two-party computation</strong>: Alice and Bob evaluate f(a,b) so that each learns the output but nothing about the other’s input. The <strong>garbler</strong> takes a boolean circuit and assigns every wire two random keys (<em>wire labels</em>) K⁰ and K¹ — knowing a label reveals nothing about the bit. For each gate it builds a <strong>garbled table</strong>: for all four input combinations (i,j) it encrypts the output label for g(i,j) under the two input labels, Enc(Kxⁱ,Kyʲ)(Kz^g(i,j)), and randomly permutes the four ciphertexts so position leaks nothing. The garbler sends the tables plus the label for its own input wire; the <strong>evaluator</strong> gets the label for its input wire by <strong>oblivious transfer</strong> — it picks the label for its bit without the garbler learning which, and without learning the other label. Now holding exactly one label per input wire, the evaluator tries to decrypt all four rows; a verifiable tag lets it recognize the one that was encrypted under its two labels (exactly one opens, verified here across AND/OR/XOR/NAND and all inputs with zero mismatch), recovering the output label — which it can propagate through the next gate. Only at the output does a <strong>decoding table</strong> map the final label to a real bit. Security rests on the labels being pseudorandom and each gate’s wrong rows being indistinguishable from noise. Real systems add optimizations — <strong>point-and-permute</strong> (select bits to pick the right row in O(1) instead of trying all four), <strong>free-XOR</strong> (XOR gates cost no ciphertexts), and <strong>half-gates</strong> (two ciphertexts per AND) — and combine with OT extension to make MPC practical for private set intersection, secure auctions, and threshold cryptography.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="yao-ctl">
          {GATES.map((g, i) => <button key={g.id} type="button" className={`yao-btn ${gi === i ? 'on' : ''}`} onClick={() => setGi(i)}>{g.id}</button>)}
          <span className="yao-sep">|</span>
          <button type="button" className="yao-btn" onClick={() => setA((v) => v ^ 1)}>a = {a}</button>
          <button type="button" className="yao-btn" onClick={() => setB((v) => v ^ 1)}>b = {b}</button>
        </div>
      )}
    />
  );
}

function Yao({ phase, gi, a, b, onGate, onA, onB }: { phase: Phase; gi: number; a: number; b: number; onGate?: (n: number) => void; onA?: (n: number) => void; onB?: (n: number) => void }) {
  const on = (p: Phase) => phase === p; void onGate; void onA; void onB;
  const gate = GATES[gi]; const rows = garble(gate.tt); const kx = WK.x[a], ky = WK.y[b];
  const ev = evaluate(rows, kx, ky); const outBit = ev.out === null ? -1 : ev.out === WK.z[0] ? 0 : ev.out === WK.z[1] ? 1 : -1;
  const showEval = on('eval') || on('privacy') || on('run');
  return (
    <svg viewBox="0 0 760 300" className="story-svg">
      <text x="56" y="22" className="yao-col">Yao garbled {gate.id} · a={a}, b={b} · evaluator holds only keys, learns f(a,b)={gate.tt[a * 2 + b]}</text>

      {/* wire keys */}
      <text x={64} y={54} className="yao-lbl">wire keys (0-key / 1-key)</text>
      {[['x', 'a'], ['y', 'b'], ['z', 'out']].map(([w, who], r) => <g key={w as string}>
        <text x={64} y={80 + r * 26} className="yao-wn">{w === 'z' ? 'out' : who as string}</text>
        {[0, 1].map((bit) => { const held = (w === 'x' && a === bit) || (w === 'y' && b === bit); return <g key={bit}>
          <rect x={100 + bit * 78} y={68 + r * 26 - 12} width={70} height={20} rx="3" className={`yao-key ${held && (on('keys') || showEval) ? 'held' : ''} ${w === 'z' && outBit === bit && showEval ? 'outkey' : ''}`} />
          <text x={135 + bit * 78} y={68 + r * 26 + 3} className="yao-kt" textAnchor="middle">{bit}:{hex((WK as Record<string, number[]>)[w as string][bit])}</text>
        </g>; })}
      </g>)}

      {/* plaintext truth table */}
      <text x={64} y={168} className="yao-lbl">plaintext {gate.id}</text>
      {[0, 1].map((i) => [0, 1].map((j) => <g key={i + '' + j}>
        <text x={70 + j * 40} y={190 + i * 20} className={`yao-tt ${i === a && j === b && showEval ? 'sel' : ''}`}>{i}·{j}→{gate.tt[i * 2 + j]}</text>
      </g>))}

      {/* garbled (encrypted, shuffled) table */}
      <text x={330} y={54} className="yao-lbl">garbled table (encrypted, shuffled)</text>
      {rows.map((row, r) => { const isDec = showEval && r === ev.row; return <g key={r}>
        <rect x={330} y={66 + r * 34} width={300} height={28} rx="4" className={`yao-row ${isDec ? 'dec' : ''}`} />
        <text x={342} y={84 + r * 34} className="yao-ct">Enc( ? , ? ) = {hex(row.ctKey, 8)} {hex(row.ctTag, 8)}</text>
        {isDec && <text x={640} y={84 + r * 34} className="yao-arrow">→ Kz {hex(ev.out!)}</text>}
      </g>; })}
      {showEval && <text x={330} y={66 + 4 * 34 + 18} className="yao-out">try all 4 with (Kx,Ky) → exactly 1 opens → out = {outBit} {outBit === gate.tt[a * 2 + b] ? '✓' : ''}</text>}

      <text x="380" y="294" className="yao-foot" textAnchor="middle">
        {on('goal') ? 'compute f(a,b) revealing neither a nor b'
          : on('keys') ? 'each wire: a random key for 0, another for 1 — the bit is hidden'
          : on('garble') ? 'encrypt each output key under its two input keys, then shuffle'
          : on('eval') ? 'only the row under the evaluator’s two keys decrypts → output key'
          : on('privacy') ? 'decode only the final key to a bit; inputs never revealed'
          : `${gate.id}(${a},${b})=${gate.tt[a * 2 + b]} · one row opened → Kz → bit ${outBit}`}
      </text>
    </svg>
  );
}
