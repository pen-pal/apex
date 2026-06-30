import { describe, it, expect } from 'vitest';
import { modelOf, spans, encode, decode, entropyBits, huffmanFloorBits, type Model } from '../src/web/arith';

describe('the model and its [0,1) partition', () => {
  it('splits [0,1) by cumulative frequency', () => {
    const m: Model = { order: ['A', 'B'], freq: { A: 1, B: 1 } };
    expect(spans(m)).toEqual([{ sym: 'A', lo: 0, hi: 0.5 }, { sym: 'B', lo: 0.5, hi: 1 }]);
  });
});

describe('encoding narrows the interval exactly (power-of-two model is exact in doubles)', () => {
  const m: Model = { order: ['A', 'B'], freq: { A: 1, B: 1 } }; // p = 1/2 each
  it('"AB" lands in [0.25, 0.5)', () => {
    const e = encode('AB', m);
    expect(e.low).toBe(0.25);
    expect(e.high).toBe(0.5);
    expect(e.bits).toBe(2);        // −log2(1/4)
  });
  it('"BA" lands in [0.5, 0.75)', () => {
    const e = encode('BA', m);
    expect(e.low).toBe(0.5);
    expect(e.high).toBe(0.75);
  });
});

describe('encode/decode round-trips', () => {
  for (const msg of ['AB', 'BANANA', 'MISSISSIPPI', 'ABRACADABRA', 'AAAAAAA']) {
    it(`decode(encode("${msg}")) === "${msg}"`, () => {
      const m = modelOf(msg);
      const e = encode(msg, m);
      expect(decode(e.code, m, msg.length)).toBe(msg);
    });
  }
});

describe('it reaches entropy — beating Huffman’s whole-bit floor', () => {
  it('a skewed message costs far fewer than 1 bit/symbol', () => {
    const msg = 'AAAAAAAAAB'; // 9 A's, 1 B → very skewed
    const m = modelOf(msg);
    const e = encode(msg, m);
    // entropy is well under the 10-bit Huffman floor
    expect(entropyBits(msg, m)).toBeLessThan(6);
    expect(e.bits).toBeLessThan(huffmanFloorBits(msg)); // arithmetic < Huffman lower bound
  });
  it('the coded width matches the product of symbol probabilities (≈ entropy)', () => {
    const msg = 'ABAB';
    const m = modelOf(msg); // p=1/2 each → width (1/2)^4 = 1/16 → exactly 4 bits
    const e = encode(msg, m);
    expect(e.high - e.low).toBeCloseTo(1 / 16, 12);
    expect(e.bits).toBe(4);
    expect(entropyBits(msg, m)).toBeCloseTo(4, 9);
  });
});
