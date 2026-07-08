import { describe, it, expect } from 'vitest';
import { blocksNeeded, naiveAlloc, pagedAlloc } from '../src/web/kvcache';

// Independent oracle: KV-cache block accounting. blocks = ceil(tokens/blockSize). Naive reserves ceil(maxLen/b) blocks
// per sequence regardless of how long it actually is; paged reserves ceil(curLen/b). seqsFit = floor(total/perSeq).
// Waste is the reserved-but-unused fraction. With 40 blocks of 16 tokens, maxLen 512, curLen 48: naive needs 32 blocks
// per seq → only 1 fits and it's ~91% empty; paged needs 3 → 13 fit with only last-block slack. Values by hand.

describe('blocksNeeded rounds up', () => {
  it('partial blocks count as a whole block', () => {
    expect(blocksNeeded(48, 16)).toBe(3);
    expect(blocksNeeded(50, 16)).toBe(4); // 50 doesn't fit in 3 blocks (48)
    expect(blocksNeeded(0, 16)).toBe(0);
  });
});

describe('naive reserve-for-max wastes memory', () => {
  const a = naiveAlloc(40, 16, 512, 48);
  it('reserves the full max-context per sequence', () => {
    expect(a.perSeqBlocks).toBe(32); // ceil(512/16)
    expect(a.seqsFit).toBe(1);       // only one fits in 40 blocks
  });
  it('is almost entirely wasted', () => {
    // 1 seq holds 48 live tokens of 32*16=512 reserved → ~91% wasted
    expect(a.wastedPct).toBe(91);
  });
});

describe('paged allocates on demand', () => {
  const a = pagedAlloc(40, 16, 48);
  it('reserves only what the current length needs', () => {
    expect(a.perSeqBlocks).toBe(3);  // ceil(48/16)
    expect(a.seqsFit).toBe(13);      // floor(40/3) — 13× more sequences than naive
  });
  it('wastes only last-block slack (here none — 48 is exactly 3 blocks)', () => {
    expect(a.wastedPct).toBe(0);
  });
  it('a length that half-fills its last block wastes only that slack', () => {
    // curLen 40 → 3 blocks (48 slots), 8 slack of 48 → ~17% per seq
    expect(pagedAlloc(40, 16, 40).wastedPct).toBe(17);
  });
});
