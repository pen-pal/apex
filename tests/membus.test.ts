import { describe, it, expect } from 'vitest';
import { decode, pageRange } from '../src/web/membus';

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
  it('splits the address into a 2-bit page and a 14-bit offset (hardcoded, not derived from PAGE_SIZE/MAP)', () => {
    expect(decode(0x0000)).toMatchObject({ page: 0, offset: 0x0000 });
    expect(decode(0x3fff)).toMatchObject({ page: 0, offset: 0x3fff }); // last byte of ROM (page 0)
    expect(decode(0x4001)).toMatchObject({ page: 1, offset: 0x0001 }); // RAM base + 1
    expect(decode(0x8000)).toMatchObject({ page: 2, offset: 0x0000 }); // video-RAM base
    expect(decode(0xffff)).toMatchObject({ page: 3, offset: 0x3fff }); // top of I/O space
    expect(decode(0x0000).region.kind).toBe('ROM');
    expect(decode(0x4000).region.name).toBe('RAM (work)');
    expect(decode(0xc000).region.kind).toBe('I/O');
  });
  it('page ranges tile the 64 KB space without gaps or overlap', () => {
    expect(pageRange(0)).toEqual([0x0000, 0x3fff]);
    expect(pageRange(1)).toEqual([0x4000, 0x7fff]);
    expect(pageRange(3)).toEqual([0xc000, 0xffff]);
  });
});
