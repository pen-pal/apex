// The binary adder — how a pile of logic gates does arithmetic. Everything a CPU computes is built up from one
// tiny circuit, the FULL ADDER: it takes two bits plus a carry-in and produces a sum bit and a carry-out. Its
// logic is just three gates' worth of boolean algebra — sum = a XOR b XOR carryIn, and carryOut = (a AND b) OR
// (carryIn AND (a XOR b)) — i.e. "carry out if at least two of the three inputs are 1." Chain n of them, feeding
// each carry-out into the next stage's carry-in, and you get an n-bit RIPPLE-CARRY ADDER that adds two n-bit
// numbers exactly the way you add decimal digits on paper: right to left, carrying as you go. The catch that
// shapes real CPUs is right there in the name: the carry has to RIPPLE. Bit 31's correct value can't be known
// until bit 30's carry is known, which needs bit 29's, all the way down — so the worst-case delay grows linearly
// with the width (a 64-bit ripple adder is 64 gate-delays deep), and that critical path would cap your clock
// speed. That single problem is why real ALUs use carry-LOOKAHEAD (or carry-select/prefix) adders that compute
// the carries in parallel from "generate" (a AND b) and "propagate" (a XOR b) signals in O(log n) depth instead
// of O(n). This models the full-adder truth table, the ripple, overflow, and the carry-chain depth that motivates
// lookahead. Reference: any digital-logic text (Harris & Harris, "Digital Design and Computer Architecture").

export interface BitStep { i: number; a: number; b: number; cin: number; sum: number; cout: number }
export interface AddResult { steps: BitStep[]; sum: number; carryOut: number; rippleDepth: number }

/** One full adder: two input bits + carry-in → sum bit + carry-out. */
export function fullAdder(a: number, b: number, cin: number): { sum: number; cout: number } {
  const sum = a ^ b ^ cin;
  const cout = (a & b) | (cin & (a ^ b)); // carry if ≥2 of the three inputs are 1
  return { sum, cout };
}

/** n-bit ripple-carry addition, LSB→MSB, recording every stage. */
export function rippleAdd(a: number, b: number, bits: number): AddResult {
  const steps: BitStep[] = [];
  let carry = 0, sum = 0, depth = 0, chain = 0;
  for (let i = 0; i < bits; i++) {
    const ai = (a >>> i) & 1, bi = (b >>> i) & 1, cin = carry;
    const { sum: s, cout } = fullAdder(ai, bi, cin);
    steps.push({ i, a: ai, b: bi, cin, sum: s, cout });
    sum |= s << i;
    chain = cout ? chain + 1 : 0;          // length of the current run of propagated carries
    depth = Math.max(depth, chain);
    carry = cout;
  }
  return { steps, sum: sum >>> 0, carryOut: carry, rippleDepth: depth };
}
