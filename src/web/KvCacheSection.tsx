// KV cache & PagedAttention, made visible. A fixed pool of GPU blocks; slide the sequences' current length and flip
// between naive (reserve the max context per sequence) and paged (allocate blocks on demand) to watch the pool go from
// mostly reserved-but-empty to packed full — and the sequences-that-fit jump. Model + tests in kvcache.ts.
import { useMemo, useState } from 'react';
import { blocksNeeded, naiveAlloc, pagedAlloc } from './kvcache';

const TOTAL = 48, BLOCK = 16, MAX = 512;
const HUES = [186, 145, 210, 35, 280, 320, 90, 250];

export function KvCacheSection() {
  const [curLen, setCurLen] = useState(48);
  const [paged, setPaged] = useState(false);

  const a = useMemo(() => (paged ? pagedAlloc(TOTAL, BLOCK, curLen) : naiveAlloc(TOTAL, BLOCK, MAX, curLen)), [paged, curLen]);
  const naiveFit = naiveAlloc(TOTAL, BLOCK, MAX, curLen).seqsFit;
  const pagedFit = pagedAlloc(TOTAL, BLOCK, curLen).seqsFit;
  const liveBlocks = blocksNeeded(curLen, BLOCK);

  const cells: { seq: number; kind: 'live' | 'reserved' | 'free' }[] = [];
  for (let s = 0; s < a.seqsFit; s++)
    for (let b = 0; b < a.perSeqBlocks; b++)
      cells.push({ seq: s, kind: b < liveBlocks ? 'live' : 'reserved' });
  while (cells.length < TOTAL) cells.push({ seq: -1, kind: 'free' });

  return (
    <div className="kvc">
      <div className="kvc-controls">
        <label className="kvc-slider"><span>each sequence has generated&nbsp;<b>{curLen}</b>&nbsp;tokens</span>
          <input type="range" min={16} max={320} step={16} value={curLen} onChange={(e) => setCurLen(+e.target.value)} /></label>
        <div className="kvc-seg">
          <button type="button" className={!paged ? 'on' : ''} onClick={() => setPaged(false)}>naive (reserve max)</button>
          <button type="button" className={paged ? 'on' : ''} onClick={() => setPaged(true)}>PagedAttention</button>
        </div>
      </div>

      <div className="kvc-pool">
        <div className="kvc-lbl">the GPU KV-cache block pool — {TOTAL} blocks of {BLOCK} tokens each</div>
        <div className="kvc-grid">
          {cells.map((c, i) => (
            <div key={i} className={`kvc-cell kvc-${c.kind}`}
              style={c.kind !== 'free' ? { borderColor: `hsl(${HUES[c.seq % HUES.length]} 50% 50% / .7)`, background: c.kind === 'live' ? `hsl(${HUES[c.seq % HUES.length]} 50% 50% / .35)` : undefined } : undefined} />
          ))}
        </div>
      </div>

      <div className="kvc-stats">
        <div className="kvc-stat"><b>{a.perSeqBlocks}</b><span>blocks reserved per sequence</span></div>
        <div className="kvc-stat kvc-hi"><b>{a.seqsFit}</b><span>sequences fit at once</span></div>
        <div className="kvc-stat"><b>{a.wastedPct}%</b><span>of used memory wasted</span></div>
      </div>

      <div className={`kvc-verdict ${paged ? 'kvc-good' : 'kvc-bad'}`}>
        {paged
          ? <>PagedAttention gives each sequence only the blocks it needs (ceil({curLen}/{BLOCK}) = {a.perSeqBlocks}), so the pool packs full — <b>{pagedFit}</b> sequences vs naive’s <b>{naiveFit}</b>, about <b>{Math.round(pagedFit / Math.max(1, naiveFit))}×</b> the batch on the same GPU. A block table (logical→physical, like a page table) lets a sequence’s blocks be scattered.</>
          : <>Reserving the {MAX}-token max context up front means <b>{a.perSeqBlocks}</b> blocks per sequence whether it needs them or not, so only <b>{naiveFit}</b> fit and <b>{a.wastedPct}%</b> of that memory is reserved-but-empty. Switch to PagedAttention.</>}
      </div>

      <p className="kvc-foot">
        Generating a token is cheap; <em>remembering</em> the conversation is not — every token’s key and value stay in the
        <strong> KV cache</strong> so attention can look back, and that cache, not compute, is what caps how many chats a GPU
        serves at once. Sizing a contiguous buffer for each request’s worst case wastes most of the memory, the same
        <strong> internal fragmentation</strong> that killed fixed-partition OS memory. vLLM’s <strong>PagedAttention</strong>
        borrows the fix that virtual memory used: fixed-size <strong>blocks</strong> plus a per-sequence <strong>block
        table</strong>, so memory is allocated on demand and a sequence’s blocks needn’t be contiguous. Same trick as
        <code> pagewalk</code>, one abstraction level up — and it’s why real LLM serving batches far more requests than a
        naive cache would allow. (vLLM / PagedAttention, Kwon et al. 2023.)
      </p>
    </div>
  );
}
