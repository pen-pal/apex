import { describe, it, expect } from 'vitest';
import { srLatch, dLatch, dFlipFlop, register } from '../src/web/latch';

describe('SR latch (cross-coupled NOR)', () => {
  it('set / reset / hold / invalid behave correctly and settle', () => {
    expect(srLatch(1, 0)).toMatchObject({ q: 1, state: 'set', stable: true });
    expect(srLatch(0, 1)).toMatchObject({ q: 0, state: 'reset', stable: true });
    expect(srLatch(0, 0, 1, 0)).toMatchObject({ q: 1, state: 'hold', stable: true });
    expect(srLatch(0, 0, 0, 1)).toMatchObject({ q: 0, state: 'hold', stable: true });
    expect(srLatch(1, 1)).toMatchObject({ q: 0, qbar: 0, state: 'invalid' }); // both outputs forced low
  });
  it('is bistable — it holds either stored value indefinitely (this is the memory)', () => {
    expect(srLatch(0, 0, 1, 0).q).toBe(1);
    expect(srLatch(0, 0, 0, 1).q).toBe(0);
  });
  it('set then release remembers the 1', () => {
    const set = srLatch(1, 0);
    expect(srLatch(0, 0, set.q, set.qbar).q).toBe(1);
  });
});

describe('gated D latch', () => {
  it('is transparent when enabled and holds when disabled', () => {
    expect(dLatch(1, 1, 0)).toBe(1);   // enable high → Q follows D
    expect(dLatch(0, 1, 1)).toBe(0);
    expect(dLatch(0, 0, 1)).toBe(1);   // enable low → holds prev
    expect(dLatch(1, 0, 0)).toBe(0);
  });
});

describe('edge-triggered D flip-flop', () => {
  it('captures D only on a rising clock edge, holds otherwise', () => {
    expect(dFlipFlop(1, 0, 1, 0)).toBe(1); // 0→1 rising: capture D=1
    expect(dFlipFlop(0, 0, 1, 1)).toBe(0); // rising: capture D=0
    expect(dFlipFlop(0, 1, 1, 1)).toBe(1); // no edge (high held): hold q
    expect(dFlipFlop(1, 1, 0, 0)).toBe(0); // falling edge: hold q
    expect(dFlipFlop(1, 0, 0, 0)).toBe(0); // clock low: hold q
  });
});

describe('n-bit register', () => {
  it('latches the whole word on a rising edge, masked to width', () => {
    expect(register(0xab, 8, 0, 1, 0)).toBe(0xab);
    expect(register(0x1ff, 8, 0, 1, 0)).toBe(0xff); // masked to 8 bits
    expect(register(0xff, 8, 1, 1, 0x12)).toBe(0x12); // no edge → holds
  });
});
