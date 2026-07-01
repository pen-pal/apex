import { describe, it, expect } from 'vitest';
import { makeMemory, gadget, flushReload, probe, recoverSecret, HIT_CYCLES, MISS_CYCLES } from '../src/web/spectre';

const mem = makeMemory([10, 20, 30, 40, 50, 60, 70, 80], 'PWD=hunter2');

describe('the vulnerable gadget', () => {
  it('in-bounds reads public data', () => {
    expect(gadget(mem, 3, false)).toBe(40);
  });
  it('out-of-bounds speculatively leaks the secret (unless mitigated)', () => {
    expect(gadget(mem, 8, false)).toBe('P'.charCodeAt(0)); // first secret byte
    expect(gadget(mem, 8, true)).toBeNull();               // a barrier stops the speculative load
  });
});

describe('Flush+Reload turns a cache line into a byte', () => {
  it('the cached line is a fast HIT; every other line is a slow MISS', () => {
    const fr = flushReload(72);
    expect(fr.times[72]).toBe(HIT_CYCLES);
    expect(fr.times[0]).toBe(MISS_CYCLES);
    expect(fr.recovered).toBe(72);
    expect(Math.min(...fr.times)).toBe(HIT_CYCLES); // argmin picks the leaked byte
  });
  it('with nothing cached (mitigated), there is no hit and nothing is recovered', () => {
    const fr = flushReload(null);
    expect(fr.recovered).toBeNull();
    expect(fr.times.every((t) => t === MISS_CYCLES)).toBe(true);
  });
});

describe('the attack reads memory it is not allowed to', () => {
  it('unmitigated: recovers the entire secret past the array', () => {
    const rec = recoverSecret(mem, false);
    const str = rec.map((b) => (b === null ? '?' : String.fromCharCode(b))).join('');
    expect(str).toBe('PWD=hunter2');
    for (let i = 0; i < rec.length; i++) expect(rec[i]).toBe(mem.bytes[mem.array1Size + i]);
  });
  it('mitigated (lfence / index masking): leaks nothing', () => {
    const rec = recoverSecret(mem, true);
    expect(rec.every((b) => b === null)).toBe(true);
    expect(probe(mem, 8, true).recovered).toBeNull();
  });
});
