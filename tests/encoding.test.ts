import { describe, it, expect } from 'vitest';
import { utf8Breakdown, toBases, base64Steps, float32Bits } from '../src/web/encoding';

describe('utf8Breakdown', () => {
  it('shows multi-byte UTF-8 honestly (café and an emoji)', () => {
    const b = utf8Breakdown('café');
    expect(b.map((c) => c.char)).toEqual(['c', 'a', 'f', 'é']);
    expect(b[3].bytes).toEqual([0xc3, 0xa9]); // é = U+00E9 = C3 A9
    const emoji = utf8Breakdown('🎉');
    expect(emoji).toHaveLength(1); // one code point, not two surrogates
    expect(emoji[0].bytes).toEqual([0xf0, 0x9f, 0x8e, 0x89]); // 4-byte UTF-8
    expect(emoji[0].codepoint).toBe(0x1f389);
  });
});

describe('toBases', () => {
  it('converts a positive number across bases', () => {
    const v = toBases('200', 8);
    expect(v.hex).toBe('0xC8');
    expect(v.binary).toBe('1100 1000');
    expect(v.octal).toBe('0o310');
    expect(v.bits).toEqual([1, 1, 0, 0, 1, 0, 0, 0]);
  });
  it('uses two’s complement for negatives', () => {
    expect(toBases('-1', 8).hex).toBe('0xFF');
    expect(toBases('-128', 8).hex).toBe('0x80');
    expect(toBases('-200', 16).hex).toBe('0xFF38');
  });
  it('rejects non-integers', () => {
    expect(toBases('4.5').ok).toBe(false);
  });
});

describe('base64Steps', () => {
  it('encodes "Man" -> "TWFu" (the canonical example)', () => {
    const r = base64Steps([...new TextEncoder().encode('Man')]);
    expect(r.output).toBe('TWFu');
    expect(r.groups[0].indices).toEqual([19, 22, 5, 46]);
  });
  it('pads correctly', () => {
    expect(base64Steps([...new TextEncoder().encode('M')]).output).toBe('TQ==');
    expect(base64Steps([...new TextEncoder().encode('Ma')]).output).toBe('TWE=');
  });
});

describe('float32Bits', () => {
  it('decomposes 1.0 into IEEE-754 single precision', () => {
    const f = float32Bits('1');
    expect(f.hex).toBe('0x3F800000');
    expect(f.sign).toBe(0);
    expect(f.exponentRaw).toBe(127);
    expect(f.exponentUnbiased).toBe(0);
    expect(f.reconstructed).toBe(1);
  });
  it('handles a negative fraction', () => {
    const f = float32Bits('-0.5');
    expect(f.sign).toBe(1);
    expect(f.reconstructed).toBe(-0.5);
  });
});
