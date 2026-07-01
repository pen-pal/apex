// The inode & indirect blocks — how a classic Unix filesystem (ext2/ext3, the original FFS) answers "byte N of
// this file lives in which disk block?" without storing one giant contiguous file (impossible as files grow and
// the disk fragments). Every file is an INODE: a fixed-size record holding the file's metadata (size, owner,
// timestamps, permissions) and, crucially, an array of pointers to its data BLOCKS. The clever part is how it
// scales from tiny to huge with a fixed-size inode. The first handful of pointers (classically 12) are DIRECT —
// they point straight at data blocks, so a small file is reached in a single disk read. When you run out, the
// next pointer is SINGLE-INDIRECT: it points at a block that is itself full of pointers (a 4 KB block with 4-byte
// pointers holds 1024 of them), so it adds 1024 more data blocks at the cost of one extra read. Then a
// DOUBLE-INDIRECT pointer points at a block of pointers to blocks of pointers (1024² data blocks), and a
// TRIPLE-INDIRECT adds 1024³ more. The beauty: small files stay fast (direct, one hop) while the same tiny inode
// still addresses terabytes, and the number of disk reads to reach any block is just its "depth" (1 to 4). The
// cost is that huge files pay more reads per block and the indirect blocks are metadata overhead — which is why
// modern filesystems (ext4, XFS, btrfs) largely replaced this with EXTENTS (a start block + length) for big
// contiguous runs. This models the block-pointer tree and the offset-to-block resolution. Reference: the ext2
// inode; McKusick's Fast File System (FFS).

export type Zone = 'direct' | 'single' | 'double' | 'triple' | 'beyond';
export interface Resolution { zone: Zone; reads: number; withinZone: number }

/** Data blocks addressable per indirection zone, given `numDirect` direct pointers and `ppb` pointers/block. */
export function capacities(numDirect: number, ppb: number): Record<Zone, number> {
  return { direct: numDirect, single: ppb, double: ppb * ppb, triple: ppb * ppb * ppb, beyond: 0 };
}

/** Which zone (and how many disk reads) reaches logical block `bi`. Direct=1 read … triple=4 reads. */
export function resolve(bi: number, numDirect: number, ppb: number): Resolution {
  if (bi < numDirect) return { zone: 'direct', reads: 1, withinZone: bi };
  let idx = bi - numDirect;
  if (idx < ppb) return { zone: 'single', reads: 2, withinZone: idx };
  idx -= ppb;
  if (idx < ppb * ppb) return { zone: 'double', reads: 3, withinZone: idx };
  idx -= ppb * ppb;
  if (idx < ppb * ppb * ppb) return { zone: 'triple', reads: 4, withinZone: idx };
  return { zone: 'beyond', reads: 0, withinZone: idx - ppb * ppb * ppb };
}

export const pointersPerBlock = (blockBytes: number, pointerBytes: number): number => Math.floor(blockBytes / pointerBytes);
export const maxBlocks = (numDirect: number, ppb: number): number => numDirect + ppb + ppb * ppb + ppb * ppb * ppb;
export const maxFileSize = (numDirect: number, ppb: number, blockBytes: number): number => maxBlocks(numDirect, ppb) * blockBytes;

/** Resolve a byte offset to its logical block and the read path. */
export function resolveOffset(byteOffset: number, numDirect: number, ppb: number, blockBytes: number): Resolution & { block: number } {
  const block = Math.floor(byteOffset / blockBytes);
  return { block, ...resolve(block, numDirect, ppb) };
}
