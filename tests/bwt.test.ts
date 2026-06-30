import { describe, it, expect } from 'vitest';
import { forward, inverse, columns, adjacency, SENTINEL } from '../src/web/bwt';

describe('forward BWT — the documented banana example', () => {
  const r = forward('banana');
  it('BWT("banana$") = "annb$aa"', () => {
    expect(r.bwt).toBe('annb$aa');
  });
  it('there are n rotations and the sorted order starts with the sentinel row', () => {
    expect(r.rotations).toHaveLength(7);
    expect(r.sorted[0]).toBe('$banana'); // $ sorts before every letter
  });
  it('the first column is the sorted characters of the string', () => {
    expect(columns(r.sorted).first).toBe('$aaabnn');
    expect(columns(r.sorted).last).toBe('annb$aa');
  });
});

describe('the transform is a bijection (inverse recovers the original)', () => {
  for (const s of ['banana', 'mississippi', 'abracadabra', 'aaaaaa', 'compression', 'a']) {
    it(`inverse(forward("${s}")) == "${s}"`, () => {
      expect(inverse(forward(s).bwt)).toBe(s);
    });
  }
});

describe('clustering — why the BWT helps compressors', () => {
  it('the transform tends to create more adjacent-equal runs than the input', () => {
    // a string with repeated context; the BWT groups the characters that precede equal suffixes
    const src = 'the_quick_the_brown_the_fox';
    const bwt = forward(src).bwt;
    expect(adjacency(bwt)).toBeGreaterThan(adjacency(src));
  });
  it('the sentinel appears exactly once in the output', () => {
    expect([...forward('mississippi').bwt].filter((c) => c === SENTINEL)).toHaveLength(1);
  });
});
