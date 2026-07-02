// The ALU, made visible. Pick an operation and two operands; the ALU computes all operations at once and a mux
// keeps the one the opcode selects. The result and the Z/N/C/V flags update live. Real logic from alu.ts.
import { useState } from 'react';
import { alu, OPS, type Op } from './alu';

const BITS = 8;
const bin = (n: number) => (n >>> 0).toString(2).padStart(BITS, '0');
const OP_LABEL: Record<Op, string> = { ADD: 'a + b', SUB: 'a − b', AND: 'a & b', OR: 'a | b', XOR: 'a ^ b', SHL: 'a << b', SHR: 'a >> b', SLT: 'a < b' };

export function AluSection() {
  const [a, setA] = useState(100);
  const [b, setB] = useState(50);
  const [op, setOp] = useState<Op>('ADD');
  const r = alu(a, b, op, BITS);
  const flags: [string, number, string][] = [
    ['Z', r.zero, 'zero — result is 0'],
    ['N', r.negative, 'negative — top bit set'],
    ['C', r.carry, 'carry — unsigned overflow / borrow'],
    ['V', r.overflow, 'signed overflow'],
  ];

  return (
    <div className="alu">
      <p className="alu-intro">
        An ALU is the adder plus a few logic gates, with a <strong>multiplexer</strong> that an opcode uses to
        pick which result to keep. It computes every operation at once; the opcode selects one. Subtraction reuses
        the adder — <code>a − b = a + (~b) + 1</code> — and four <strong>flags</strong> (Z/N/C/V) let a branch act
        on the result.
      </p>

      <div className="alu-inputs">
        <label>a = <b>{a}</b><input type="range" min={0} max={255} value={a} onChange={(e) => setA(+e.target.value)} /></label>
        <label>b = <b>{b}</b><input type="range" min={0} max={255} value={b} onChange={(e) => setB(+e.target.value)} /></label>
      </div>

      <div className="alu-ops">
        {OPS.map((o) => <button key={o} type="button" className={`alu-op ${op === o ? 'on' : ''}`} onClick={() => setOp(o)}>{OP_LABEL[o]}</button>)}
      </div>

      <div className="alu-box">
        <div className="alu-operand"><span className="alu-lbl">a</span><code>{bin(a)}</code></div>
        <div className="alu-operand"><span className="alu-lbl">{op === 'SUB' ? '−' : OP_LABEL[op].split(' ')[1] ?? op} b</span><code>{bin(b)}</code></div>
        <div className="alu-result"><span className="alu-lbl">{op}</span><code>{bin(r.result)}</code><span className="alu-dec">= {r.result}{op === 'SUB' && r.result > 127 ? ` (signed ${r.result - 256})` : ''}</span></div>
      </div>

      <div className="alu-flags">
        {flags.map(([f, on, desc]) => (
          <div key={f} className={`alu-flag ${on ? 'on' : ''}`} title={desc}><span className="alu-fn">{f}</span><span className="alu-fv">{on}</span></div>
        ))}
        <span className="alu-fdesc">{flags.filter((f) => f[1]).map((f) => f[2]).join(' · ') || 'no flags set'}</span>
      </div>

      <p className="alu-foot">
        Those four flags are how a comparison becomes a branch. <code>if (a &gt; b)</code> compiles to a SUB that
        discards the result and keeps only the flags; the branch then reads them — signed <code>a ≥ b</code> is
        <code>N == V</code>, unsigned is <code>C set</code>, and a strict <code>&gt;</code> also wants <code>Z</code>
        clear. The ALU has no clock and no memory: outputs settle a few gate-delays after the inputs move. State
        lives outside it, in the register file that feeds operands in and latches the result on the clock edge.
        Widen it to 64 bits, add a multiplier, a shifter, and a floating-point unit, and duplicate it so a
        superscalar core runs several ops per cycle — but the core is always this: an adder, some gates, a mux, and
        four flags.
      </p>
    </div>
  );
}
