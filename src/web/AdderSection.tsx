// The binary adder, made visible. Set two numbers and watch a chain of full adders add them bit by bit, LSB to
// MSB, with the carry rippling left exactly like carrying in decimal. The carry path lights up; the ripple depth
// shows the worst-case gate delay that motivates carry-lookahead. Real logic from adder.ts.
import { useMemo, useState } from 'react';
import { rippleAdd } from './adder';

const BITS = 8;

export function AdderSection() {
  const [a, setA] = useState(213);
  const [b, setB] = useState(93);
  const r = useMemo(() => rippleAdd(a, b, BITS), [a, b]);
  const steps = [...r.steps].reverse(); // show MSB..LSB left to right

  return (
    <div className="rca">
      <p className="rca-intro">
        Arithmetic is just gates. A <strong>full adder</strong> takes two bits and a carry-in and outputs a sum
        bit and a carry-out (<code>sum = a ⊕ b ⊕ cin</code>, <code>carry = majority(a,b,cin)</code>). Chain eight
        of them and the carry <strong>ripples</strong> from the low bit up, carrying just like decimal addition on
        paper. Drag the inputs:
      </p>

      <div className="rca-inputs">
        <label>A = <b>{a}</b><input type="range" min={0} max={255} value={a} onChange={(e) => setA(+e.target.value)} /></label>
        <label>B = <b>{b}</b><input type="range" min={0} max={255} value={b} onChange={(e) => setB(+e.target.value)} /></label>
      </div>

      <div className="rca-grid">
        <div className="rca-row"><span className="rca-lbl">carry</span>{steps.map((s) => <span key={s.i} className={`rca-c ${s.cin ? 'on' : ''}`}>{s.cin}</span>)}<span className="rca-lbl2" /></div>
        <div className="rca-row"><span className="rca-lbl">A</span>{steps.map((s) => <span key={s.i} className="rca-b a">{s.a}</span>)}<span className="rca-lbl2">{a}</span></div>
        <div className="rca-row plus"><span className="rca-lbl">+ B</span>{steps.map((s) => <span key={s.i} className="rca-b b">{s.b}</span>)}<span className="rca-lbl2">{b}</span></div>
        <div className="rca-row sum"><span className="rca-lbl">{r.carryOut ? '1' : '='}</span>{steps.map((s) => <span key={s.i} className={`rca-b s ${s.sum ? 'one' : ''}`}>{s.sum}</span>)}<span className="rca-lbl2">{r.sum}</span></div>
      </div>

      <div className={`rca-verdict ${r.carryOut ? 'ovf' : ''}`}>
        {a} + {b} = <b>{r.carryOut ? 256 + r.sum : r.sum}</b>
        {r.carryOut ? <> — but 8 bits hold only 0–255, so it <strong>overflows</strong> to {r.sum} with carry-out 1.</> : <>, fits in 8 bits.</>}
      </div>

      <div className="rca-stats">
        <div className="rca-stat"><span>carry ripple depth</span><b>{r.rippleDepth} / {BITS}</b></div>
        <div className="rca-stat"><span>worst-case gate delay</span><b>~{BITS} stages</b></div>
      </div>

      <p className="rca-foot">
        Watch <code>255 + 1</code>: the carry out of bit 0 forces bit 1, which forces bit 2, all the way up — one
        addition, but its answer isn't settled until a signal has rippled through all eight stages in sequence.
        That serial dependency is the whole problem with the ripple adder: worst-case delay grows with the bit
        width, so a 64-bit version is 64 gate-delays deep and would throttle the clock. Real ALUs break the chain
        by computing carries in parallel: each bit exposes a <em>generate</em> (a AND b — makes a carry no matter
        what) and a <em>propagate</em> (a XOR b — passes an incoming carry along) signal, and a
        <strong> carry-lookahead</strong> tree combines them to know every carry in O(log n) depth instead of
        O(n). Subtraction reuses this exact circuit — negate B (two's complement: invert and add 1, done by
        feeding carry-in = 1 and XOR-ing B) — which is why one adder does both, and why the carry-out doubles as
        the unsigned overflow flag. Stack a few more gates for AND/OR/XOR/shift, put a multiplexer on the output
        selected by an opcode, and you have an <strong>ALU</strong> — the arithmetic core of every CPU, all of it
        still just XOR, AND, and OR. (Harris &amp; Harris, Digital Design and Computer Architecture.)
      </p>
    </div>
  );
}
