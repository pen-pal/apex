// io_uring, made visible. Top: drag the number of I/O operations and the batch size and watch the syscall
// count for each model — blocking pays one syscall per op, epoll pays even MORE (a read per op plus waits),
// while io_uring batches everything into a handful of io_uring_enter calls, and SQPOLL drops it to zero.
// Bottom: step the submission/completion ring loop — fill the SQ, submit a batch with one syscall, reap the
// completions from the CQ for free. Real model from ioring.ts.
import { useMemo, useState } from 'react';
import { compareAll, ringRound, type Mode, type RingState } from './ioring';

const MODES: { id: Mode; label: string; note: string }[] = [
  { id: 'blocking', label: 'blocking read/write', note: '1 syscall per op' },
  { id: 'epoll', label: 'epoll + read', note: 'readiness wait + a read per op' },
  { id: 'iouring', label: 'io_uring', note: '1 enter per batch, completions free' },
  { id: 'iouring-sqpoll', label: 'io_uring + SQPOLL', note: 'kernel polls the SQ — 0 syscalls' },
];

export function IoUringSection() {
  const [ops, setOps] = useState(1000);
  const [batch, setBatch] = useState(64);
  const counts = useMemo(() => compareAll(ops, batch), [ops, batch]);
  const max = Math.max(...Object.values(counts), 1);

  const [ring, setRing] = useState<RingState>({ sq: [1, 2, 3, 4, 5, 6, 7], cq: [], inKernel: [], submitted: 0, reaped: 0 });
  const step = () => setRing((s) => ringRound(s, 3));
  const resetRing = () => setRing({ sq: [1, 2, 3, 4, 5, 6, 7], cq: [], inKernel: [], submitted: 0, reaped: 0 });
  const ringActive = ring.sq.length > 0 || ring.inKernel.length > 0;

  return (
    <div className="iou">
      <p className="iou-intro">
        <strong>epoll</strong> tells you <em>when</em> a socket is ready, but you still call <code>read</code>
        for each one — a syscall per operation. <strong>io_uring</strong> goes further: you write many requests
        into a shared <strong>submission ring</strong> and hand them all to the kernel with <strong>one</strong>
        <code> io_uring_enter</code>; it does the I/O asynchronously and posts results to a
        <strong> completion ring</strong> you read with <em>no</em> syscall. That's how one thread drives
        millions of IOPS.
      </p>

      <div className="iou-cmp">
        <div className="iou-sliders">
          <label>I/O operations <input type="range" min={10} max={5000} step={10} value={ops} onChange={(e) => setOps(+e.target.value)} /><b>{ops.toLocaleString()}</b></label>
          <label>batch / ring depth <input type="range" min={1} max={256} value={batch} onChange={(e) => setBatch(+e.target.value)} /><b>{batch}</b></label>
        </div>
        <div className="iou-bars">
          {MODES.map((m) => (
            <div key={m.id} className="iou-row">
              <div className="iou-mh"><b>{m.label}</b><span>{m.note}</span></div>
              <div className="iou-track"><div className={`iou-fill ${m.id}`} style={{ width: `${(counts[m.id] / max) * 100}%` }} /></div>
              <div className="iou-num">{counts[m.id].toLocaleString()}<span> syscalls</span></div>
            </div>
          ))}
        </div>
        <div className="iou-takeaway">io_uring does <b>{Math.round(counts.blocking / Math.max(1, counts.iouring))}×</b> fewer syscalls than blocking at this load — and SQPOLL does none.</div>
      </div>

      <div className="iou-ring">
        <div className="iou-rh">the submission / completion ring</div>
        <div className="iou-queues">
          <div className="iou-q sq">
            <div className="iou-ql">SQ — submission queue <span>app → kernel</span></div>
            <div className="iou-cells">{ring.sq.map((x) => <span key={x} className="iou-cell pending">{x}</span>)}{ring.sq.length === 0 && <span className="iou-empty">empty</span>}</div>
          </div>
          <div className="iou-q kern">
            <div className="iou-ql">in kernel <span>async I/O</span></div>
            <div className="iou-cells">{ring.inKernel.map((x) => <span key={x} className="iou-cell working">{x}</span>)}{ring.inKernel.length === 0 && <span className="iou-empty">—</span>}</div>
          </div>
          <div className="iou-q cq">
            <div className="iou-ql">CQ — completion queue <span>kernel → app</span></div>
            <div className="iou-cells">{ring.cq.map((x) => <span key={x} className="iou-cell done">{x}</span>)}{ring.cq.length === 0 && <span className="iou-empty">empty</span>}</div>
          </div>
        </div>
        <div className="iou-ringctl">
          <button type="button" onClick={step} disabled={!ringActive}>▸ io_uring_enter (submit a batch)</button>
          <button type="button" className="ghost" onClick={resetRing}>reset</button>
          <span className="iou-rstat">submitted {ring.submitted} · reaped {ring.reaped} <i>(reaping the CQ costs no syscall)</i></span>
        </div>
      </div>

      <p className="iou-foot">
        The rings are memory shared between app and kernel (mapped once), so submitting and reaping are just
        memory writes/reads with a lightweight memory barrier — the <code>io_uring_enter</code> syscall is only
        needed to wake the kernel to process the SQ, and you can amortize it over a big batch or skip it
        entirely with <strong>SQPOLL</strong> (a kernel thread busy-polls the SQ). Beyond fewer syscalls,
        io_uring is <strong>truly asynchronous</strong> for things epoll can't make non-blocking (regular file
        reads, <code>fsync</code>, even <code>accept</code>), supports <strong>linked</strong> operations
        (do B only if A succeeds) and <strong>fixed</strong> buffers/files to skip per-op setup. The tradeoff
        is complexity and a string of early security CVEs. (Axboe, "Efficient IO with io_uring," 2019.)
      </p>
    </div>
  );
}
