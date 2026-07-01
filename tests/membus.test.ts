import { describe, it, expect } from 'vitest';
import { decode, MAP, pageRange, PAGE_SIZE } from '../src/web/membus';

describe('address decoding', () => {
  it('maps each 16 KB page to its device by the top two address bits', () => {
    expect(decode(0x0000).region.kind).toBe('ROM');
    expect(decode(0x3fff).region.kind).toBe('ROM'); // last ROM byte
    expect(decode(0x4000).region.kind).toBe('RAM'); // first work-RAM byte
    expect(decode(0x8000).region.name).toBe('RAM (video)');
    expect(decode(0xc000).region.kind).toBe('I/O');
    expect(decode(0xffff).region.kind).toBe('I/O');
  });
  it('asserts exactly one chip-select line for every address (one-hot decoder)', () => {
    for (let a = 0; a <= 0xffff; a += 7) {
      const d = decode(a);
      expect(d.selects.filter(Boolean).length).toBe(1);
      expect(d.selects[d.page]).toBe(true);
    }
  });
  it('splits the address into page (high 2 bits) and offset (low 14 bits)', () => {
    for (let a = 0; a <= 0xffff; a += 13) {
      const d = decode(a);
      expect(d.page).toBe((a >> 14) & 3);
      expect(d.offset).toBe(a & (PAGE_SIZE - 1));
      expect(d.region).toBe(MAP[d.page]);
    }
  });
  it('page ranges tile the 64 KB space without gaps or overlap', () => {
    expect(pageRange(0)).toEqual([0x0000, 0x3fff]);
    expect(pageRange(1)).toEqual([0x4000, 0x7fff]);
    expect(pageRange(3)).toEqual([0xc000, 0xffff]);
  });
});
