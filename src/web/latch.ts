// How a circuit remembers one bit. Combinational logic like the adder is memoryless: its outputs depend only on
// the inputs present right now. Storage needs FEEDBACK. Cross-couple two NOR gates so each one's output feeds the
// other's input, and the pair snaps into one of two stable states and holds it with no clock and no power beyond
// leakage. That is an SR (set/reset) latch: Q = NOR(R, Qbar), Qbar = NOR(S, Q). Raise S and Q latches to 1;
// raise R and it latches to 0; drop both and it HOLDS the last value — that hold state is the stored bit. Driving
// S and R both high is illegal: it forces Q and Qbar both to 0 (they should be complements), and releasing it
// races. Real designs never expose S/R raw. A gated D latch adds one data input D and an enable: while enable is
// high Q follows D, while it is low Q holds — so you write on demand. The problem with a level-triggered latch is
// that Q tracks D the whole time the enable is high, which makes timing fragile. A D FLIP-FLOP fixes that by
// being EDGE-triggered: it samples D only at the instant the clock rises and ignores it otherwise, built as two
// gated latches in series (master then slave) on opposite clock phases. Wire n flip-flops to one clock and you
// have an n-bit REGISTER — the CPU's fastest storage, and the same 6-transistor SRAM cell that makes your cache.
// This models the SR latch (as a truth table and by settling the gate feedback), the D flip-flop's edge capture,
// and a register. Reference: any digital-logic text (Harris & Harris, Digital Design and Computer Architecture).

export type Bit = 0 | 1;
const NOR = (a: Bit, b: Bit): Bit => (a === 0 && b === 0 ? 1 : 0);

export type SrState = 'set' | 'reset' | 'hold' | 'invalid';
export interface SrResult { q: Bit; qbar: Bit; state: SrState; stable: boolean }

/** Settle the cross-coupled NOR SR latch from a starting (q,qbar) under inputs S,R. */
export function srLatch(s: Bit, r: Bit, q0: Bit = 0, qbar0: Bit = 1): SrResult {
  let q = q0, qbar = qbar0, stable = false;
  for (let i = 0; i < 8; i++) {
    const nq = NOR(r, qbar), nqbar = NOR(s, q);   // each gate drives the other
    if (nq === q && nqbar === qbar) { stable = true; break; }
    q = nq; qbar = nqbar;
  }
  const state: SrState = s === 1 && r === 1 ? 'invalid' : s === 1 ? 'set' : r === 1 ? 'reset' : 'hold';
  return { q, qbar, state, stable };
}

/** Gated D latch: while enable is high, Q follows D; while low, Q holds `prev`. */
export function dLatch(d: Bit, enable: Bit, prev: Bit): Bit {
  return enable === 1 ? d : prev;
}

/** Edge-triggered D flip-flop: Q captures D only on a rising clock edge (0→1); otherwise holds. */
export function dFlipFlop(d: Bit, clkPrev: Bit, clkNow: Bit, q: Bit): Bit {
  const risingEdge = clkPrev === 0 && clkNow === 1;
  return risingEdge ? d : q;
}

/** An n-bit register: latches the whole input word on a rising clock edge. */
export function register(input: number, bits: number, clkPrev: Bit, clkNow: Bit, q: number): number {
  return clkPrev === 0 && clkNow === 1 ? input & ((1 << bits) - 1) : q;
}
