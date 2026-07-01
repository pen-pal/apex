import { describe, it, expect } from 'vitest';
import { encode, decode, ratio } from '../src/web/gorilla';

const BASE = 1600000000;
function prng(seed: number) { let s = seed; return () => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s / 0x80000000; }; }

describe('lossless round-trip', () => {
  it('recovers a regular, slowly-varying series exactly', () => {
    const r = prng(5); let v = 22.5; const s: { t: number; v: number }[] = [];
    for (let i = 0; i < 200; i++) { s.push({ t: BASE + i * 60, v: Math.round(v * 100) / 100 }); v += (r() - 0.5) * 0.2; }
    expect(decode(encode(s), s.length)).toEqual(s);
  });
  it('recovers an irregular, jumpy series exactly (times drift, values leap)', () => {
    const r = prng(9); const s: { t: number; v: number }[] = [];
    for (let i = 0; i < 100; i++) s.push({ t: BASE + i * 60 + (r() < 0.3 ? Math.floor(r() * 30) : 0), v: r() * 1000 });
    expect(decode(encode(s), s.length)).toEqual(s);
  });
  it('handles a flat series, negative and integer values, and a single sample', () => {
    const flat = Array.from({ length: 50 }, (_, i) => ({ t: BASE + i * 60, v: 42 }));
    expect(decode(encode(flat), flat.length)).toEqual(flat);
    const mixed = [{ t: 0, v: -3.5 }, { t: 10, v: 0 }, { t: 25, v: 1000000 }, { t: 25, v: -0.001 }];
    expect(decode(encode(mixed), mixed.length)).toEqual(mixed);
    expect(decode(encode([{ t: 7, v: 9.9 }]), 1)).toEqual([{ t: 7, v: 9.9 }]);
    expect(decode(encode([]), 0)).toEqual([]);
  });
});

describe('it actually compresses', () => {
  it('a flat, regular series costs only a few bits per sample', () => {
    const flat = Array.from({ length: 500 }, (_, i) => ({ t: BASE + i * 60, v: 42 }));
    const r = ratio(flat);
    expect(r.perSample).toBeLessThan(6);    // vs 128 naive
    expect(r.factor).toBeGreaterThan(20);   // >20x smaller
  });
  it('regular timestamps ride on delta-of-delta ≈ 0 (1 bit each)', () => {
    // constant value isolates the timestamp cost; 500 regular points → tiny
    const s = Array.from({ length: 500 }, (_, i) => ({ t: BASE + i * 60, v: 1 }));
    expect(encode(s).count / s.length).toBeLessThan(6);
  });
  it('even a noisy series beats the naive 128 bits/sample', () => {
    const r = prng(3); const s = Array.from({ length: 300 }, (_, i) => ({ t: BASE + i * 60, v: Math.round(r() * 10000) / 100 }));
    expect(ratio(s).factor).toBeGreaterThan(1);
  });
});
