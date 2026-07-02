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
        Watch <code>255 + 1</code>: the carry out of bit 0 forces bit 1, then bit 2, all the way up — the answer
        isn't final until a signal has rippled through all eight stages in order. That serial delay is the ripple
        adder's flaw: a 64-bit version is 64 gate-delays deep, deep enough to throttle the clock. Real ALUs cut the
        chain with <strong>carry-lookahead</strong> — each bit exposes whether it <em>generates</em> a carry (a AND
        b) or merely <em>propagates</em> an incoming one (a XOR b), and a tree combines those to know every carry in
        O(log n) depth instead of O(n). The same circuit subtracts for free: invert B and feed carry-in = 1 (two's
        complement), and the carry-out doubles as the unsigned-overflow flag. Bolt on a few logic gates and an
        output multiplexer, and that adder becomes the <strong>ALU</strong> at the heart of every CPU.
      </p>
    </div>
  );
}
