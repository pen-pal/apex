import { describe, it, expect } from 'vitest';
import { caesar, vigenere, crackCaesar, letterFreq, ENGLISH_FREQ } from '../src/web/classical';

describe('Caesar cipher', () => {
  it('shifts by 3 (the classic) and round-trips', () => {
    expect(caesar('HELLO', 3)).toBe('KHOOR');
    expect(caesar('KHOOR', -3)).toBe('HELLO');
    expect(caesar('Attack at dawn!', 1)).toBe('Buubdl bu ebxo!'); // case + punctuation preserved
  });
  it('wraps around Z', () => {
    expect(caesar('XYZ', 3)).toBe('ABC');
  });
});

describe('Vigenère cipher', () => {
  it('matches the canonical vector ATTACKATDAWN / LEMON → LXFOPVEFRNHR', () => {
    expect(vigenere('ATTACKATDAWN', 'LEMON')).toBe('LXFOPVEFRNHR');
  });
  it('decrypt recovers the plaintext', () => {
    expect(vigenere('LXFOPVEFRNHR', 'LEMON', true)).toBe('ATTACKATDAWN');
  });
});

describe('frequency analysis breaks Caesar without brute force', () => {
  const plain = 'the quick brown fox jumps over the lazy dog and then the dog runs away quickly toward the river';
  it('recovers the shift from the ciphertext alone', () => {
    const r = crackCaesar(caesar(plain, 7));
    expect(r.shift).toBe(7);
    expect(r.plaintext.toLowerCase()).toBe(plain);
  });
  it('English frequencies sum to ~100% and E is the most common', () => {
    expect(Object.values(ENGLISH_FREQ).reduce((a, b) => a + b, 0)).toBeGreaterThan(99);
    expect(Math.max(...Object.values(ENGLISH_FREQ))).toBe(ENGLISH_FREQ.E);
  });
  it('letterFreq of a shifted text is the English profile, rotated', () => {
    const f = letterFreq(caesar('eeeee', 3)); // all E → all H
    expect(f.H).toBe(100);
  });
});
