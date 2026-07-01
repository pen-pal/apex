import { describe, it, expect } from 'vitest';
import { resolve, capacities, pointersPerBlock, maxBlocks, maxFileSize, resolveOffset } from '../src/web/inode';

const ND = 12, B = 4096, P = 4;
const ppb = pointersPerBlock(B, P); // 1024

describe('parameters', () => {
  it('pointers per block = blockBytes / pointerBytes', () => {
    expect(ppb).toBe(1024);
    expect(pointersPerBlock(1024, 4)).toBe(256);
  });
  it('zone capacities are numDirect, ppb, ppb², ppb³', () => {
    expect(capacities(ND, ppb)).toMatchObject({ direct: 12, single: 1024, double: 1024 * 1024, triple: 1024 * 1024 * 1024 });
  });
});

describe('offset-to-block resolution and read depth', () => {
  it('direct blocks are one read', () => {
    expect(resolve(0, ND, ppb)).toMatchObject({ zone: 'direct', reads: 1 });
    expect(resolve(11, ND, ppb)).toMatchObject({ zone: 'direct', reads: 1 });
  });
  it('each indirection level adds one read at the right boundary', () => {
    expect(resolve(12, ND, ppb)).toMatchObject({ zone: 'single', reads: 2, withinZone: 0 });
    expect(resolve(12 + ppb - 1, ND, ppb)).toMatchObject({ zone: 'single', reads: 2 });
    expect(resolve(12 + ppb, ND, ppb)).toMatchObject({ zone: 'double', reads: 3, withinZone: 0 });
    expect(resolve(12 + ppb + ppb * ppb, ND, ppb)).toMatchObject({ zone: 'triple', reads: 4, withinZone: 0 });
  });
  it('every zone boundary maps to the right zone and read count', () => {
    const caps = capacities(ND, ppb);
    let cum = 0;
    for (const [zone, reads] of [['direct', 1], ['single', 2], ['double', 3], ['triple', 4]] as const) {
      expect(resolve(cum, ND, ppb)).toMatchObject({ zone, reads });                 // first of the zone
      expect(resolve(cum + caps[zone] - 1, ND, ppb).zone).toBe(zone);               // last of the zone
      cum += caps[zone];
    }
    expect(resolve(cum, ND, ppb).zone).toBe('beyond'); // one past the max
  });
  it('resolveOffset divides the byte offset by the block size', () => {
    expect(resolveOffset(0, ND, ppb, B).block).toBe(0);
    expect(resolveOffset(B * 12 + 5, ND, ppb, B)).toMatchObject({ block: 12, zone: 'single' });
  });
});

describe('maximum file size', () => {
  it('classic ext2 (12 direct, 4 KB blocks, 1024 ptrs/block) addresses ~4 TB', () => {
    expect(maxBlocks(ND, ppb)).toBe(12 + 1024 + 1024 ** 2 + 1024 ** 3);
    const bytes = maxFileSize(ND, ppb, B);
    expect(bytes).toBe(maxBlocks(ND, ppb) * B);
    expect(bytes / 1e12).toBeGreaterThan(4);   // > 4 TB
    expect(bytes / 1e12).toBeLessThan(4.5);
  });
  it('smaller blocks address much less (the triple-indirect term dominates)', () => {
    const small = maxFileSize(12, pointersPerBlock(1024, 4), 1024); // 1 KB blocks, 256 ptrs
    expect(small).toBeLessThan(maxFileSize(ND, ppb, B));
  });
});
