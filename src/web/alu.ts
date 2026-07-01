// The ALU (Arithmetic Logic Unit) — the part of a CPU that actually computes. It's the adder plus a handful of
// logic gates, with a MULTIPLEXER on the output that an opcode uses to pick which result to keep. One circuit
// computes a+b, a-b, a&b, a|b, a^b, shifts, and comparisons all at once; the opcode selects one. Subtraction
// reuses the adder: a - b is a + (~b) + 1 in two's complement, so feeding the adder an inverted b and a carry-in
// of 1 turns the same hardware into a subtractor. Alongside the result the ALU raises FLAGS that branches read:
// Zero (result is 0), Negative (top bit set), Carry (carry out of the top bit — unsigned overflow / borrow), and
// oVerflow (signed overflow: two same-sign inputs produced a different-sign result). Those four bits are how
// `if (a > b)` becomes a compare-then-branch. This models the operations and the flags, reusing the ripple adder.
// Reference: Harris & Harris, Digital Design and Computer Architecture; Patterson & Hennessy, MIPS ALU.

export type Op = 'ADD' | 'SUB' | 'AND' | 'OR' | 'XOR' | 'SHL' | 'SHR' | 'SLT';
export const OPS: Op[] = ['ADD', 'SUB', 'AND', 'OR', 'XOR', 'SHL', 'SHR', 'SLT'];

export interface Flags { zero: number; negative: number; carry: number; overflow: number }
export interface AluResult extends Flags { result: number; op: Op }

/** Add with flags (also the subtractor when fed ~b and cin=1). */
function addWithFlags(a: number, b: number, cin: number, bits: number): { result: number; carry: number; overflow: number } {
  const mask = (1 << bits) - 1, msb = 1 << (bits - 1);
  const raw = a + b + cin;
  const result = raw & mask;
  const carry = (raw >>> bits) & 1;
  const sa = a & msb, sb = b & msb, sr = result & msb;
  const overflow = sa === sb && sr !== sa ? 1 : 0; // same-sign inputs, different-sign result
  return { result, carry, overflow };
}

/** Run one ALU operation over `bits`-wide inputs, producing the result and the Z/N/C/V flags. */
export function alu(a: number, b: number, op: Op, bits = 8): AluResult {
  const mask = (1 << bits) - 1, msb = 1 << (bits - 1);
  a &= mask; b &= mask;
  let result = 0, carry = 0, overflow = 0;
  switch (op) {
    case 'ADD': ({ result, carry, overflow } = addWithFlags(a, b, 0, bits)); break;
    case 'SUB': ({ result, carry, overflow } = addWithFlags(a, ~b & mask, 1, bits)); break; // a + (~b) + 1
    case 'AND': result = a & b; break;
    case 'OR': result = a | b; break;
    case 'XOR': result = a ^ b; break;
    case 'SHL': result = (a << (b & (bits - 1))) & mask; break;
    case 'SHR': result = a >>> (b & (bits - 1)); break;
    case 'SLT': result = ((a & msb ? a - (1 << bits) : a) < (b & msb ? b - (1 << bits) : b)) ? 1 : 0; break; // signed set-less-than
  }
  return { result, op, zero: result === 0 ? 1 : 0, negative: (result & msb) ? 1 : 0, carry, overflow };
}
