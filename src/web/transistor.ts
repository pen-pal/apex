// From transistors to logic — the very bottom of the stack. A MOSFET transistor is an electrically-controlled
// switch: a voltage on its gate terminal decides whether current can flow between the other two. There are two
// flavors. An NMOS conducts when its gate is HIGH (1) and blocks when low; a PMOS is the mirror image, conducting
// when its gate is LOW (0). CMOS logic pairs them: every gate has a PULL-UP network of PMOS transistors connecting
// the output to power (1) and a complementary PULL-DOWN network of NMOS connecting it to ground (0), wired so that
// for any input exactly one network conducts — the output is never left floating and, in steady state, no current
// flows straight through (which is why CMOS sips power). An inverter is one PMOS over one NMOS. A NAND puts the
// two PMOS in PARALLEL (output goes high if EITHER input is low) and the two NMOS in SERIES (output goes low only
// if BOTH are high) — which is exactly NOT(a AND b). Swap series for parallel and you get NOR. The punchline is
// UNIVERSALITY: NAND alone can build every boolean function — NOT is a NAND with tied inputs, AND is NAND then
// NOT, OR is NAND of two inverted inputs, XOR is four NANDs — so a chip fab really only needs to perfect one gate.
// Stack these into the adder, the flip-flop, and the ALU, and you have a computer. This models the two
// transistor types, the CMOS pull-up/pull-down networks for NOT/NAND/NOR, and NAND universality with gate counts.
// Reference: any digital-logic text (Harris & Harris; Weste & Harris, CMOS VLSI Design).

export type Bit = 0 | 1;

/** A transistor as a switch: does it conduct for this gate voltage? */
export const nmos = (gate: Bit): boolean => gate === 1; // conducts when gate is HIGH
export const pmos = (gate: Bit): boolean => gate === 0; // conducts when gate is LOW

// CMOS gates built from pull-up (PMOS→power) and pull-down (NMOS→ground) networks.
// Output is HIGH when the pull-up conducts, LOW when the pull-down conducts (complementary by construction).
export const inverter = (a: Bit): Bit => (pmos(a) && !nmos(a) ? 1 : 0);
export const nand = (a: Bit, b: Bit): Bit => ((pmos(a) || pmos(b)) && !(nmos(a) && nmos(b)) ? 1 : 0); // PMOS ‖, NMOS series
export const nor = (a: Bit, b: Bit): Bit => (pmos(a) && pmos(b) && !(nmos(a) || nmos(b)) ? 1 : 0);     // PMOS series, NMOS ‖

// NAND universality — every gate from NAND alone.
export const notN = (a: Bit): Bit => nand(a, a);
export const andN = (a: Bit, b: Bit): Bit => nand(nand(a, b), nand(a, b));
export const orN = (a: Bit, b: Bit): Bit => nand(nand(a, a), nand(b, b));
export const xorN = (a: Bit, b: Bit): Bit => { const c = nand(a, b); return nand(nand(a, c), nand(b, c)); };

/** How many NAND gates each function costs. */
export const NAND_COST: Record<'NOT' | 'AND' | 'OR' | 'XOR', number> = { NOT: 1, AND: 2, OR: 3, XOR: 4 };

/** The two-input truth table of a gate function, for display. */
export const truthTable = (fn: (a: Bit, b: Bit) => Bit): { a: Bit; b: Bit; out: Bit }[] =>
  [[0, 0], [0, 1], [1, 0], [1, 1]].map(([a, b]) => ({ a: a as Bit, b: b as Bit, out: fn(a as Bit, b as Bit) }));
