// KV cache & PagedAttention — why an LLM server fits many chats in fixed GPU memory. Each generated token appends a
// key+value vector to that sequence's KV cache, so the cache is the memory bottleneck of inference. The naive layout
// gives each sequence one CONTIGUOUS slab sized for the model's max context, so almost all of it is reserved-but-empty
// (internal fragmentation) and only a couple of sequences fit. vLLM's PagedAttention instead splits the cache into
// fixed-size BLOCKS and gives each sequence a block table (logical→physical, exactly like OS page tables), allocating
// blocks on demand — so you only pay for tokens that exist and far more sequences fit. This models that accounting.

export const blocksNeeded = (tokens: number, blockSize: number): number => Math.ceil(tokens / blockSize);

export interface Alloc { perSeqBlocks: number; seqsFit: number; usedBlocks: number; wastedPct: number }

// Naive: reserve enough blocks for the MODEL'S MAX context per sequence, up front, before you know how long it gets.
export function naiveAlloc(totalBlocks: number, blockSize: number, maxLen: number, curLen: number): Alloc {
  const perSeqBlocks = blocksNeeded(maxLen, blockSize);
  const seqsFit = Math.floor(totalBlocks / perSeqBlocks);
  const usedBlocks = seqsFit * perSeqBlocks;
  const reservedTokens = seqsFit * perSeqBlocks * blockSize;
  const liveTokens = seqsFit * curLen;
  const wastedPct = reservedTokens === 0 ? 0 : Math.round((1 - liveTokens / reservedTokens) * 100);
  return { perSeqBlocks, seqsFit, usedBlocks, wastedPct };
}

// Paged: allocate only the blocks the CURRENT length needs; the only waste is the slack in each sequence's last block.
export function pagedAlloc(totalBlocks: number, blockSize: number, curLen: number): Alloc {
  const perSeqBlocks = blocksNeeded(curLen, blockSize);
  const seqsFit = perSeqBlocks === 0 ? totalBlocks : Math.floor(totalBlocks / perSeqBlocks);
  const usedBlocks = seqsFit * perSeqBlocks;
  const reservedTokens = seqsFit * perSeqBlocks * blockSize;
  const liveTokens = seqsFit * curLen;
  const wastedPct = reservedTokens === 0 ? 0 : Math.round((1 - liveTokens / reservedTokens) * 100);
  return { perSeqBlocks, seqsFit, usedBlocks, wastedPct };
}
