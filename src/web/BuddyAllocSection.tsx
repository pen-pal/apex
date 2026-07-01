// Buddy allocator, made visible. The pool is one bar. Allocate a size and watch it round up to a power of two
// and split a larger free block in half (and half again) until it fits; click an allocated block to free it and
// watch it coalesce with its buddy back into a bigger block. Free lists per order and fragmentation stats update
// live. Real model from buddyalloc.ts.
import { useMemo, useReducer, useRef, useState } from 'react';
import { Buddy } from './buddyalloc';

const TOTAL = 1024, MIN = 32;
const hue = (offset: number) => (offset * 137 + 40) % 360; // distinct-ish color per allocation

export function BuddyAllocSection() {
  const buddy = useMemo(() => new Buddy(TOTAL, MIN), []);
  const req = useRef(new Map<number, number>()); // offset -> requested bytes (for internal-fragmentation)
  const [, force] = useReducer((x) => x + 1, 0);
  const [size, setSize] = useState(100);
  const [msg, setMsg] = useState<string | null>(null);

  const nextPow = (n: number) => { let s = MIN; while (s < n) s <<= 1; return s; };
  const doAlloc = (bytes: number) => {
    const off = buddy.alloc(bytes);
    if (off === null) setMsg(`✗ alloc(${bytes}) failed — no block large enough (fragmentation or full)`);
    else { req.current.set(off, bytes); setMsg(`alloc(${bytes}) → offset ${off}, rounded up to a ${nextPow(bytes)}-byte block`); }
    force();
  };
  const freeBlock = (offset: number) => { buddy.release(offset); req.current.delete(offset); setMsg(`freed offset ${offset} — coalesced with any free buddy`); force(); };
  const reset = () => { for (const off of [...req.current.keys()]) buddy.release(off); req.current.clear(); setMsg(null); force(); };

  const layout = buddy.layout();
  const stats = buddy.stats();
  const requested = [...req.current.values()].reduce((a, b) => a + b, 0);
  const internalFrag = stats.used - requested;
  const orders = Array.from({ length: buddy.maxOrder + 1 }, (_, o) => o).reverse();

  return (
    <div className="bud">
      <p className="bud-intro">
        A {TOTAL}-byte pool, allocated in power-of-two blocks (min {MIN}). A request rounds <strong>up</strong> to
        a power of two; if only a bigger free block exists, it <strong>splits in half</strong> repeatedly until it
        fits. Freeing a block checks its <strong>buddy</strong> (at <code>offset XOR size</code>) and merges if
        it's free. Allocate below; click a used block to free it:
      </p>

      <div className="bud-controls">
        <label className="bud-sizef">size<input type="number" value={size} min={1} max={TOTAL} onChange={(e) => setSize(+e.target.value)} /></label>
        <button type="button" className="bud-alloc" onClick={() => doAlloc(size)}>alloc</button>
        <span className="bud-quick">quick:{[32, 100, 200, 500].map((s) => <button key={s} type="button" onClick={() => doAlloc(s)}>{s}</button>)}</span>
        <button type="button" className="bud-reset" onClick={reset}>reset</button>
      </div>

      <div className="bud-bar">
        {layout.map((b) => (
          <div
            key={b.offset}
            className={`bud-block ${b.state}`}
            style={{ width: `${(b.size / TOTAL) * 100}%`, ...(b.state === 'used' ? { background: `hsl(${hue(b.offset)} 55% 52%)`, borderColor: `hsl(${hue(b.offset)} 55% 42%)` } : {}) }}
            onClick={b.state === 'used' ? () => freeBlock(b.offset) : undefined}
            title={b.state === 'used' ? `used ${b.size}B @ ${b.offset} — click to free` : `free ${b.size}B @ ${b.offset}`}
          >
            <span className="bud-block-sz">{b.size}</span>
            {b.state === 'used' && req.current.has(b.offset) && <span className="bud-block-req">req {req.current.get(b.offset)}</span>}
          </div>
        ))}
      </div>
      {msg && <div className="bud-msg">{msg}</div>}

      <div className="bud-orders">
        <span className="bud-orders-label">free lists</span>
        {orders.map((o) => {
          const count = layout.filter((b) => b.state === 'free' && b.order === o).length;
          return <span key={o} className={`bud-order ${count ? 'has' : ''}`}>{buddy.size(o)}B<b>×{count}</b></span>;
        })}
      </div>

      <div className="bud-stats">
        <div className="bud-stat"><span>used</span><b>{stats.used}B</b></div>
        <div className="bud-stat"><span>free</span><b>{stats.free}B</b></div>
        <div className="bud-stat"><span>largest free block</span><b>{stats.largestFree}B</b></div>
        <div className={`bud-stat ${internalFrag > 0 ? 'warn' : ''}`}><span>internal fragmentation</span><b>{internalFrag}B</b></div>
      </div>

      <p className="bud-foot">
        Two kinds of waste show up here. <strong>Internal fragmentation</strong> is the gap between what you asked
        for and the power-of-two block you got (ask 100, receive 128, lose 28) — the buddy system's built-in tax,
        usually 25% on average for random sizes. <strong>External fragmentation</strong> — free memory that
        exists but not as one contiguous run — is what buddy allocation fights well: because every free at a
        given order tries to reunite buddies, large blocks keep reforming, so "largest free block" recovers
        instead of decaying. The trade the design makes is coarse block sizes for O(log n) allocation and O(1)
        buddy lookup (one XOR). Real allocators layer on top of it: the Linux kernel uses the buddy system for
        whole <em>pages</em> and then a <strong>slab/slub</strong> allocator to carve those pages into small
        same-sized objects (task structs, inodes) without the rounding waste; userspace mallocs (ptmalloc,
        jemalloc, tcmalloc) use size-class free lists and per-thread caches for the same reason. Knowing which
        layer you're on explains a lot of real memory behaviour. (Knuth, TAOCP vol. 1.)
      </p>
    </div>
  );
}
