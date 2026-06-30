// Copy-on-write fork, made visible. Fork the parent and watch the child's pages point at the very same
// frames (yellow = shared, no copy made). Click a page to write to it and only THAT page faults and
// diverges to a fresh private frame (green); the copy counter ticks up one. Or exec the child and watch
// every share drop with zero copies — the fork+exec fast path. Real refcounted page tables from cow.ts.
import { useMemo, useState } from 'react';
import { CowMemory, type Proc } from './cow';

const PAGES = 6;
type Op = { t: 'fork' } | { t: 'write'; p: Proc; i: number } | { t: 'exec' };

export function CowSection() {
  const [ops, setOps] = useState<Op[]>([]);

  const m = useMemo(() => {
    const mem = new CowMemory(PAGES);
    for (const op of ops) {
      if (op.t === 'fork') mem.fork();
      else if (op.t === 'write') mem.write(op.p, op.i);
      else mem.execChild();
    }
    return mem;
  }, [ops]);

  const forked = ops.some((o) => o.t === 'fork');
  const execed = ops.some((o) => o.t === 'exec');
  const add = (op: Op) => setOps((o) => [...o, op]);

  const Row = ({ p }: { p: Proc }) => (
    <div className="cow-proc">
      <div className="cow-proc-h">{p}{p === 'child' && execed ? ' (after exec — new address space)' : ''}</div>
      <div className="cow-pages">
        {m.view(p).map((pg) => (
          <button key={pg.index} type="button" disabled={!forked || pg.frame < 0}
            className={`cow-page ${pg.frame < 0 ? 'empty' : pg.shared ? 'shared' : 'private'}`}
            onClick={() => add({ t: 'write', p, i: pg.index })} title={pg.frame < 0 ? 'unmapped' : `frame ${pg.frame}, refcount ${pg.refcount}`}>
            <span className="cow-pg-i">pg {pg.index}</span>
            <span className="cow-pg-f">{pg.frame < 0 ? '—' : `f${pg.frame}`}</span>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="cow">
      <div className="cow-controls">
        <button type="button" className="primary" onClick={() => add({ t: 'fork' })} disabled={forked}>fork()</button>
        <button type="button" onClick={() => add({ t: 'exec' })} disabled={!forked || execed}>child exec()</button>
        <button type="button" onClick={() => setOps([])} disabled={ops.length === 0}>reset</button>
        <span className="cow-copies">physical copies made: <b className={m.copies > 0 ? 'hot' : ''}>{m.copies}</b></span>
      </div>

      <Row p="parent" />
      {forked && <Row p="child" />}

      <div className="cow-hint">
        {!forked ? 'press fork() — the child will share the parent’s pages with zero copying.'
          : execed ? 'the child exec’d before writing, so nothing was ever copied — the fork+exec fast path.'
            : 'click any page to write to it; a shared page faults and copies just that one page to a private frame.'}
      </div>
      <div className="cow-legend"><span className="cow-lg shared" /> shared (read-only, refcount 2) <span className="cow-lg private" /> private (copied / refcount 1)</div>

      <p className="cow-foot">
        fork() used to literally duplicate the address space, which was absurd for a big process that was about to call exec() and throw it all
        away. Copy-on-write makes fork nearly free — duplicate the page tables, mark everything read-only, share the frames — and defers the real
        cost to the first write to each page, paid one page at a time. The same trick powers <strong>memory snapshots</strong> (fork to get a
        consistent point-in-time copy, as Redis does for persistence), <strong>zygote</strong> process spawning on Android, and filesystem/
        container layers (btrfs, overlayfs). The cost is a minor page fault on each first write, and a subtlety for GC’d runtimes: touching a page
        merely to update a reference count can trigger a copy, defeating COW — which is why some allocators keep refcounts off-page. (Unix VM; OSTEP.)
      </p>
    </div>
  );
}
