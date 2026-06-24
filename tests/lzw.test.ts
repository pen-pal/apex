import { describe, it, expect } from 'vitest';
import { encode, decode } from '../src/web/lzw';

describe('LZW encoding (hand-worked)', () => {
  it('encodes ABABABA to [65, 66, 256, 258]', () => {
    // A=65,B=66; AB→256, BA→257, ABA→258; output A, B, AB(256), ABA(258)
    expect(encode('ABABABA').codes).toEqual([65, 66, 256, 258]);
  });

  it('adds new multi-char dictionary entries starting at code 256', () => {
    const e = encode('ABABABA');
    const added = e.steps.filter((s) => s.added).map((s) => s.added!);
    expect(added[0]).toEqual({ code: 256, str: 'AB' });
    expect(added[1]).toEqual({ code: 257, str: 'BA' });
    expect(added[2]).toEqual({ code: 258, str: 'ABA' });
  });

  it('a single character emits just its byte code', () => {
    expect(encode('A').codes).toEqual([65]);
    expect(encode('').codes).toEqual([]);
  });
});

describe('LZW round-trips (independent decoder)', () => {
  for (const s of ['ABABABA', 'TOBEORNOTTOBEORTOBEORNOT', 'mississippi', 'aaaaaaaa', 'the quick brown fox', 'a', ''])
    it(`decode(encode(${JSON.stringify(s)})) === original`, () => {
      expect(decode(encode(s).codes)).toBe(s);
    });

  it('handles the tricky cScSc special case (repeating run)', () => {
    // a run like "aaaaaa" exercises the "code refers to the entry being built" path
    const s = 'aaaaaa';
    expect(decode(encode(s).codes)).toBe(s);
  });
});

describe('compression on repetitive input', () => {
  it('emits fewer codes than characters when there is repetition', () => {
    const input = 'ABAB'.repeat(20); // 80 chars
    const e = encode(input);
    expect(e.codes.length).toBeLessThan(input.length / 2);
    expect(decode(e.codes)).toBe(input);
  });
});
