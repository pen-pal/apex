import { describe, it, expect } from 'vitest';
import { encode, decode, overhead } from '../src/web/cobs';

describe('the published COBS vectors', () => {
  const vectors: [number[], number[]][] = [
    [[0x00], [0x01, 0x01]],
    [[0x00, 0x00], [0x01, 0x01, 0x01]],
    [[0x11, 0x22, 0x00, 0x33], [0x03, 0x11, 0x22, 0x02, 0x33]],
    [[0x11, 0x22, 0x33, 0x44], [0x05, 0x11, 0x22, 0x33, 0x44]],
    [[0x11, 0x00, 0x00, 0x00], [0x02, 0x11, 0x01, 0x01, 0x01]],
    [[], [0x01]],
  ];
  it('encode matches the paper exactly', () => {
    for (const [input, expected] of vectors) expect(encode(input)).toEqual(expected);
  });
  it('decode is the exact inverse', () => {
    for (const [input] of vectors) expect(decode(encode(input))).toEqual(input);
  });
});

describe('the whole point: no zero bytes survive in the output', () => {
  it('a payload that is all zeros still encodes with no zeros', () => {
    const zeros = new Array(50).fill(0);
    const e = encode(zeros);
    expect(e).not.toContain(0);
    expect(decode(e)).toEqual(zeros);
  });
  it('handles the 254-byte run boundary with a 0xFF code', () => {
    const run = Array.from({ length: 254 }, (_, i) => (i % 255) + 1); // 254 non-zero bytes
    const e = encode(run);
    expect(e[0]).toBe(0xff);          // full run → code 0xFF, no implied zero
    expect(e).not.toContain(0);
    expect(decode(e)).toEqual(run);
    // one more byte crosses into a second block
    const run255 = [...run, 0x99];
    expect(decode(encode(run255))).toEqual(run255);
  });
});

describe('bounded overhead — never worse than 1 byte per 254', () => {
  it('overhead(n) = floor(n/254)+1 and the encoder respects it', () => {
    expect(overhead(0)).toBe(1);
    expect(overhead(253)).toBe(1);
    expect(overhead(254)).toBe(2);   // a full 254-byte non-zero run needs a 0xFF code block
    expect(overhead(255)).toBe(2);
    expect(overhead(600)).toBe(3);
  });
});

describe('round-trips any data (fuzz)', () => {
  it('20k random payloads: no zeros in output, exact round-trip, overhead within bound', () => {
    let s = 1; const rnd = (n: number) => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s % n; };
    for (let t = 0; t < 20000; t++) {
      const n = rnd(600);
      const data = Array.from({ length: n }, () => rnd(256));
      const e = encode(data);
      expect(e).not.toContain(0);
      expect(decode(e)).toEqual(data);
      expect(e.length - n).toBeLessThanOrEqual(overhead(n)); // overhead never exceeds the bound
    }
  });
});
