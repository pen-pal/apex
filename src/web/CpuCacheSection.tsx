// The CPU cache, made visible. An address splits into tag / index / offset; the index picks a set, the tags in
// that set are compared, and you see a hit or a miss + eviction. Change the associativity and run patterns to
// watch conflict misses appear (direct-mapped) and vanish (set-associative). Real logic from cpucache.ts.
import { useRef, useState } from 'react';
import { Cache } from './cpucache';

const SETS = 8, BLOCK = 64, ADDR_BITS = 16;

export function CpuCacheSection() {
  const [ways, setWays] = useState(2);
  const cache = useRef(new Cache(BLOCK, SETS, ways));
  const [, force] = useState(0);
  const [last, setLast] = useState<{ addr: number; hit: boolean; index: number; evicted: number | null } | null>(null);
  const rerender = () => force((x) => x + 1);

  // rebuild when associativity changes
  const cfgKey = `${ways}`;
  const lastCfg = useRef(cfgKey);
  if (lastCfg.current !== cfgKey) { cache.current = new Cache(BLOCK, SETS, ways); lastCfg.current = cfgKey; setLast(null); }

  const seed = useRef(1);
  const rnd = (n: number) => { seed.current = (Math.imul(seed.current, 1103515245) + 12345) & 0x7fffffff; return seed.current % n; };

  const run = (addrs: number[]) => { let r = null; for (const a of addrs) r = cache.current.access(a); const l = addrs[addrs.length - 1]; const d = cache.current.decode(l); setLast({ addr: l, hit: r!.hit, index: d.index, evicted: r!.evictedTag }); rerender(); };
  const sequential = () => run(Array.from({ length: 64 }, (_, i) => i * 4));
  const thrash = () => run(Array.from({ length: 40 }, (_, i) => (i % 2 === 0 ? 0 : BLOCK * SETS))); // two blocks, same set
  const random = () => run(Array.from({ length: 64 }, () => rnd(32) * BLOCK));
  const reset = () => { cache.current.reset(); setLast(null); rerender(); };

  const dec = last ? cache.current.decode(last.addr) : null;
  const bin = (n: number, w: number) => (n >>> 0).toString(2).padStart(w, '0');
  const c = cache.current;

  return (
    <div className="cch">
      <p className="cch-intro">
        Main memory is ~100 ns away; a cache hit is ~1 ns. The cache is a grid of <strong>sets</strong>, each with
        a few <strong>ways</strong>. An address splits into a <strong>tag</strong>, a <strong>set index</strong>,
        and a byte <strong>offset</strong>: the index picks a set, and the tag is compared against every way in
        it. Match = hit; no match = miss, which fetches the 64-byte line and evicts the least-recently-used way.
      </p>

      <div className="cch-controls">
        <label>associativity <b>{ways === 1 ? 'direct-mapped' : ways === SETS ? 'fully-assoc' : `${ways}-way`}</b><input type="range" min={1} max={4} value={ways} onChange={(e) => setWays(+e.target.value)} /></label>
        <button type="button" className="cch-btn" onClick={sequential}>sequential scan</button>
        <button type="button" className="cch-btn" onClick={thrash}>thrash 2 blocks</button>
        <button type="button" className="cch-btn" onClick={random}>random</button>
        <button type="button" className="cch-btn ghost" onClick={reset}>reset</button>
      </div>

      {dec && (
        <div className="cch-decode">
          <span className="cch-alabel">last access 0x{last!.addr.toString(16)}:</span>
          <span className="cch-bits">
            {[...bin(last!.addr, ADDR_BITS)].map((b, i) => {
              const bit = ADDR_BITS - 1 - i;
              const field = bit < c.offsetBits ? 'off' : bit < c.offsetBits + c.indexBits ? 'idx' : 'tag';
              return <span key={i} className={`cch-bit ${field}`}>{b}</span>;
            })}
          </span>
          <span className="cch-fields"><b className="tag">tag {dec.tag}</b> · <b className="idx">set {dec.index}</b> · <b className="off">byte {dec.offset}</b></span>
        </div>
      )}

      <div className="cch-grid">
        <div className="cch-ghead"><span>set</span>{Array.from({ length: ways }, (_, w) => <span key={w}>way {w}</span>)}</div>
        {Array.from({ length: SETS }, (_, s) => {
          const tags = c.setContents(s);
          const isSet = last && last.index === s;
          return (
            <div key={s} className={`cch-row ${isSet ? 'active' : ''}`}>
              <span className="cch-si">{s}</span>
              {Array.from({ length: ways }, (_, w) => {
                const tag = tags[w];
                const isHit = isSet && last!.hit && tag === dec!.tag;
                return <span key={w} className={`cch-cell ${tag === undefined ? 'empty' : 'full'} ${isHit ? 'hit' : ''}`}>{tag === undefined ? '·' : `#${tag}`}</span>;
              })}
            </div>
          );
        })}
      </div>

      {last && <div className={`cch-verdict ${last.hit ? 'hit' : 'miss'}`}>{last.hit ? '✓ HIT' : '✗ MISS'} in set {last.index}{last.evicted !== null ? ` — evicted tag #${last.evicted} (LRU)` : ''}</div>}

      <div className="cch-stats">
        <div className="cch-stat"><span>hits</span><b>{c.hits}</b></div>
        <div className="cch-stat"><span>misses</span><b>{c.misses}</b></div>
        <div className={`cch-stat ${c.hitRate() > 0.7 ? 'ok' : c.hits + c.misses > 0 ? 'bad' : ''}`}><span>hit rate</span><b>{(c.hitRate() * 100).toFixed(0)}%</b></div>
      </div>

      <p className="cch-foot">
        Set associativity to <em>direct-mapped</em> and hit "thrash 2 blocks": two blocks that map to the same set
        evict each other on every access, so the hit rate craters even though the cache is nearly empty. Two-way
        holds both at ~100%. That's why real caches run 4–16 way — a little associativity kills those conflict
        misses cheaply. Every miss is one of three kinds: <em>compulsory</em> (first touch of a block),
        <em>capacity</em> (working set bigger than the cache), or <em>conflict</em> (too many hot blocks in one
        set — the thrash above). It's also why layout dominates speed: walking an array by rows reuses lines the
        hardware just fetched, while striding by columns touches a fresh line every step and can run 10× slower.
        The tag/index/offset you decoded here is the same address DRAM splits into bank/row/column — the cache
        checks first, and only a miss reaches the chips.
      </p>
    </div>
  );
}
