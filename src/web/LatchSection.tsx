// The flip-flop, made visible. Set and reset an SR latch and watch Q hold its value after you release the input
// (that held value is the stored bit). Then clock a D flip-flop: it captures D only on the rising edge and
// ignores changes in between. Real logic from latch.ts.
import { useState } from 'react';
import { srLatch, dFlipFlop, type Bit } from './latch';

export function LatchSection() {
  const [sr, setSr] = useState({ q: 0 as Bit, qbar: 1 as Bit, state: 'hold' as string });
  const [d, setD] = useState<Bit>(1);
  const [clk, setClk] = useState<Bit>(0);
  const [ffq, setFfq] = useState<Bit>(0);
  const [captured, setCaptured] = useState(false);

  const pulse = (s: Bit, r: Bit) => { const res = srLatch(s, r, sr.q, sr.qbar); setSr({ q: res.q, qbar: res.qbar, state: res.state }); };
  const tick = () => { const nc: Bit = clk === 0 ? 1 : 0; const nq = dFlipFlop(d, clk, nc, ffq); setCaptured(clk === 0 && nc === 1); setFfq(nq); setClk(nc); };

  return (
    <div className="ltc">
      <p className="ltc-intro">
        The adder forgets: its output depends only on its inputs right now. Memory needs <strong>feedback</strong>.
        Cross-couple two NOR gates so each drives the other and the pair locks into a stable 0 or 1. That is an
        <strong> SR latch</strong> — pulse Set and Q locks to 1, pulse Reset and it locks to 0, and with both
        inputs low it <strong>holds</strong>. The held value is one stored bit.
      </p>

      <div className="ltc-panel">
        <div className="ltc-ph">SR latch</div>
        <div className="ltc-latch">
          <div className={`ltc-gate ${sr.q ? 'hi' : ''}`}>NOR<span className="ltc-out">Q = <b>{sr.q}</b></span></div>
          <div className="ltc-cross">⇄</div>
          <div className={`ltc-gate ${sr.qbar ? 'hi' : ''}`}>NOR<span className="ltc-out">Q̄ = <b>{sr.qbar}</b></span></div>
        </div>
        <div className="ltc-controls">
          <button type="button" className="ltc-btn set" onClick={() => pulse(1, 0)}>Set (S=1)</button>
          <button type="button" className="ltc-btn reset" onClick={() => pulse(0, 1)}>Reset (R=1)</button>
          <button type="button" className="ltc-btn bad" onClick={() => pulse(1, 1)}>Both (invalid)</button>
        </div>
        <div className={`ltc-state ${sr.state}`}>
          {sr.state === 'invalid'
            ? <>S=R=1 forces Q and Q̄ both to 0 — illegal, and releasing it races. Real designs never allow it.</>
            : <>state: <b>{sr.state}</b> — inputs are low now, and the latch is <b>holding {sr.q}</b>. That's the stored bit.</>}
        </div>
      </div>

      <div className="ltc-panel">
        <div className="ltc-ph">D flip-flop (edge-triggered)</div>
        <div className="ltc-ff">
          <button type="button" className={`ltc-din ${d ? 'hi' : ''}`} onClick={() => setD((x) => (x ? 0 : 1) as Bit)}>D = <b>{d}</b><span className="ltc-hint">(click to flip)</span></button>
          <button type="button" className="ltc-clk" onClick={tick}>{clk === 0 ? '▲ tick clock (0→1)' : '▼ clock (1→0)'}</button>
          <div className={`ltc-q ${captured ? 'flash' : ''}`}>Q = <b>{ffq}</b></div>
        </div>
        <div className="ltc-state hold">
          Q captured <b>{ffq}</b> on the last rising edge. Flip D now and nothing happens — the flip-flop only
          samples D at the <b>instant</b> the clock goes 0→1. That edge-triggering is what keeps a whole register
          of them in lockstep.
        </div>
      </div>

      <p className="ltc-foot">
        A gated D latch is the middle ground: while its enable is high, Q tracks D; while low, it holds. That is
        timing-fragile, since Q follows D the entire time enable is high, so a flip-flop chains two latches on
        opposite clock phases (master then slave) and the output can only change on the clock edge. Chain n of them
        and you have an n-bit <strong>register</strong>: the program counter, the general-purpose registers, and
        the pipeline latches between stages are all rows of flip-flops. Shrink the cell to six transistors (four
        cross-coupled inverters, two to access it) and it is <strong>SRAM</strong>, your L1/L2/L3 cache. That 6:1
        transistor cost against DRAM's one-capacitor cell is why cache is megabytes and main memory gigabytes. The
        whole storage hierarchy is two answers to one question, how to hold a bit: latch it in feedback (fast, big)
        or park charge on a capacitor and refresh it (dense, slow). (Harris &amp; Harris.)
      </p>
    </div>
  );
}
