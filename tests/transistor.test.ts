import { describe, it, expect } from 'vitest';
import { nmos, pmos, inverter, nand, nor, notN, andN, orN, xorN, NAND_COST, truthTable, type Bit } from '../src/web/transistor';

const bits: Bit[] = [0, 1];
const tt2 = (fn: (a: Bit, b: Bit) => Bit) => bits.flatMap((a) => bits.map((b) => fn(a, b)));

describe('transistors as switches', () => {
  it('NMOS conducts high, PMOS conducts low', () => {
    expect(nmos(1)).toBe(true); expect(nmos(0)).toBe(false);
    expect(pmos(0)).toBe(true); expect(pmos(1)).toBe(false);
  });
});

describe('CMOS gates from pull-up / pull-down networks', () => {
  it('inverter = NOT', () => { expect(inverter(0)).toBe(1); expect(inverter(1)).toBe(0); });
  it('NAND = !(a & b)', () => { expect(tt2(nand)).toEqual([1, 1, 1, 0]); });
  it('NOR = !(a | b)', () => { expect(tt2(nor)).toEqual([1, 0, 0, 0]); });
});

describe('NAND universality — every gate from NAND alone', () => {
  it('NOT / AND / OR / XOR built from NAND match their truth tables', () => {
    expect(bits.map((a) => notN(a))).toEqual([1, 0]);
    expect(tt2(andN)).toEqual([0, 0, 0, 1]);   // a & b
    expect(tt2(orN)).toEqual([0, 1, 1, 1]);    // a | b
    expect(tt2(xorN)).toEqual([0, 1, 1, 0]);   // a ^ b
  });
  it('the NAND gate counts are 1 / 2 / 3 / 4', () => {
    expect(NAND_COST).toEqual({ NOT: 1, AND: 2, OR: 3, XOR: 4 });
  });
  it('agrees with native boolean operators exhaustively', () => {
    for (const a of bits) for (const b of bits) {
      expect(andN(a, b)).toBe((a & b) as Bit);
      expect(orN(a, b)).toBe((a | b) as Bit);
      expect(xorN(a, b)).toBe((a ^ b) as Bit);
    }
  });
});

describe('truthTable helper', () => {
  it('enumerates the 4 two-input rows', () => {
    expect(truthTable(nand)).toEqual([
      { a: 0, b: 0, out: 1 }, { a: 0, b: 1, out: 1 }, { a: 1, b: 0, out: 1 }, { a: 1, b: 1, out: 0 },
    ]);
  });
});
