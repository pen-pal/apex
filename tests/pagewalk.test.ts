import { describe, it, expect } from 'vitest';
import { decompose, vaBinary, PageTable, hex } from '../src/web/pagewalk';

// A virtual address built from known indices so the bit split is hand-checkable:
//   pml4=1, pdpt=2, pd=3, pt=4, offset=0xABC  →  va = 1·2³⁹ + 2·2³⁰ + 3·2²¹ + 4·2¹² + 0xABC
const VA = 1 * 2 ** 39 + 2 * 2 ** 30 + 3 * 2 ** 21 + 4 * 2 ** 12 + 0xabc;
const VA_PAGE = VA - 0xabc; // page-aligned base

describe('virtual-address decomposition (Intel SDM §4.5: 9/9/9/9/12)', () => {
  it('splits into the four table indices and the page offset exactly', () => {
    expect(decompose(VA)).toEqual({ pml4: 1, pdpt: 2, pd: 3, pt: 4, offset: 0xabc });
  });
  it('the offset is the low 12 bits and indices are 9 bits each', () => {
    expect(decompose(0xfff).offset).toBe(0xfff);
    expect(decompose(0x1000).offset).toBe(0);   // next page → offset wraps
    expect(decompose(0x1000).pt).toBe(1);
    // an all-ones index field reads as 511 (2⁹−1), never bleeding into the neighbour
    expect(decompose(511 * 2 ** 12).pt).toBe(511);
    expect(decompose(511 * 2 ** 12).pd).toBe(0);
  });
  it('the binary view is 48 bits, grouped 9/9/9/9/12', () => {
    const groups = vaBinary(VA);
    expect(groups.map((g) => g.length)).toEqual([9, 9, 9, 9, 12]);
    expect(groups.join('').length).toBe(48);
  });
});

describe('the 4-level walk', () => {
  const pt = new PageTable([{ va: VA_PAGE, frame: 0x5 }]);

  it('chases all four levels to a frame and forms the physical address', () => {
    const r = pt.translate(VA);
    expect(r.hit).toBe(true);
    expect(r.frame).toBe(0x5);
    expect(r.phys).toBe(0x5 * 4096 + 0xabc); // frame<<12 | offset
    expect(hex(r.phys!)).toBe('0x5ABC');
    expect(r.steps.map((s) => [s.level, s.present])).toEqual([
      ['PML4', true], ['PDPT', true], ['PD', true], ['PT', true],
    ]);
  });

  it('any address on the same page maps to the same frame (offset just rides along)', () => {
    expect(pt.translate(VA_PAGE + 0x10).phys).toBe(0x5 * 4096 + 0x10);
  });

  it('an unmapped top-level index faults at PML4 (walk stops immediately)', () => {
    const r = pt.translate(7 * 2 ** 39); // pml4=7, never mapped
    expect(r.hit).toBe(false);
    expect(r.faultLevel).toBe('PML4');
    expect(r.steps).toHaveLength(1);
  });

  it('a shared prefix but unmapped leaf faults at PT (deepest level)', () => {
    const r = pt.translate(VA_PAGE + 5 * 2 ** 12); // same PML4/PDPT/PD, pt=4+5=9 unmapped
    expect(r.hit).toBe(false);
    expect(r.faultLevel).toBe('PT');
    expect(r.steps.map((s) => s.present)).toEqual([true, true, true, false]);
  });

  it('a large physical frame number (>= 2^32) is stored exactly, not 32-bit-truncated', () => {
    const big = new PageTable([{ va: 0, frame: 2 ** 32 }]);
    expect(big.translate(0x10).frame).toBe(2 ** 32);            // not 0
    expect(big.translate(0x10).phys).toBe(2 ** 32 * 4096 + 0x10);
  });

  it('demand paging: map the faulting page, then the retry succeeds', () => {
    const faulting = 9 * 2 ** 39 + 0x123;
    expect(pt.isMapped(faulting)).toBe(false);
    pt.map(faulting - 0x123, 0x7);
    const r = pt.translate(faulting);
    expect(r.hit).toBe(true);
    expect(r.phys).toBe(0x7 * 4096 + 0x123);
  });
});
