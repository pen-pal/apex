// epoll, made visible. Top: drag the number of open connections and how many are active; watch select/poll
// scan EVERY fd each wait (O(n)) while epoll touches only the ready ones (O(active)) — the gap that is the
// C10k problem. Bottom: the edge-vs-level-triggered gotcha — read a socket one chunk at a time and see
// edge-triggered strand the rest with no further wakeup. Real model from epoll.ts.
import { useMemo, useState } from 'react';
import { compare, drain } from './epoll';

export function EpollSection() {
  const [total, setTotal] = useState(10000);
  const [active, setActive] = useState(5);
  const cmp = useMemo(() => compare(total, [active]), [total, active]);
  const perSelect = cmp.perCall[0].select, perEpoll = cmp.perCall[0].epoll;

  const [bytes, setBytes] = useState(1000);
  const [readSz, setReadSz] = useState(256);
  const [mode, setMode] = useState<'level' | 'edge'>('edge');
  const d = drain(bytes, readSz, mode);

  return (
    <div className="epl">
      <p className="epl-intro">
        How does one thread watch <strong>10,000 sockets</strong>? The old <code>select()</code>/<code>poll()</code>
        hand the kernel the whole fd set every call, so it walks all of them — <strong>O(n)</strong> even if
        one is active. <code>epoll</code> registers interest once and keeps a <strong>ready list</strong>, so
        <code> epoll_wait</code> returns only fds with events — <strong>O(active)</strong>, no matter how many
        idle connections you hold. That's the C10k breakthrough.
      </p>

      <div className="epl-c10k">
        <div className="epl-sliders">
          <label>open connections <input type="range" min={10} max={50000} step={10} value={total} onChange={(e) => setTotal(+e.target.value)} /><b>{total.toLocaleString()}</b></label>
          <label>active right now <input type="range" min={0} max={Math.min(200, total)} value={Math.min(active, total)} onChange={(e) => setActive(+e.target.value)} /><b>{active}</b></label>
        </div>
        <div className="epl-cmp">
          <div className="epl-mech bad">
            <div className="epl-mh">select / poll</div>
            <div className="epl-work">{perSelect.toLocaleString()}</div>
            <div className="epl-wlbl">fds scanned per wait — O(n)</div>
            <div className="epl-track"><div className="epl-fill" style={{ width: '100%' }} /></div>
          </div>
          <div className="epl-mech ok">
            <div className="epl-mh">epoll</div>
            <div className="epl-work">{perEpoll.toLocaleString()}</div>
            <div className="epl-wlbl">fds returned per wait — O(active)</div>
            <div className="epl-track"><div className="epl-fill" style={{ width: `${Math.max(0.4, (perEpoll / perSelect) * 100)}%` }} /></div>
          </div>
        </div>
        <div className="epl-ratio">epoll does <b>{Math.round(cmp.ratio).toLocaleString()}×</b> less work per wait at this load</div>
      </div>

      <div className="epl-trig">
        <div className="epl-th">The edge-triggered gotcha — draining a socket</div>
        <div className="epl-tcontrols">
          <label>bytes waiting <input type="range" min={0} max={4096} step={64} value={bytes} onChange={(e) => setBytes(+e.target.value)} /><b>{bytes}</b></label>
          <label>read per wakeup <input type="range" min={64} max={4096} step={64} value={readSz} onChange={(e) => setReadSz(+e.target.value)} /><b>{readSz}</b></label>
          <div className="epl-modes">
            <button type="button" className={mode === 'level' ? 'on' : ''} onClick={() => setMode('level')}>level-triggered</button>
            <button type="button" className={mode === 'edge' ? 'on' : ''} onClick={() => setMode('edge')}>edge-triggered</button>
          </div>
        </div>
        <div className="epl-tout">
          <div className="epl-tstat"><span>wakeups</span><b>{d.wakeups}</b></div>
          <div className="epl-tstat"><span>bytes read</span><b>{d.bytesRead}</b></div>
          <div className={`epl-tstat ${d.stalled > 0 ? 'bad' : 'ok'}`}><span>stranded</span><b>{d.stalled}</b></div>
        </div>
        <div className={`epl-tnote ${d.stalled > 0 ? 'warn' : ''}`}>
          {mode === 'level'
            ? 'Level-triggered keeps firing while data remains, so a single read-per-wakeup still drains the whole buffer — simple, slightly more wakeups.'
            : d.stalled > 0
              ? `⚠ Edge-triggered fired ONCE. You read ${d.bytesRead} and left ${d.stalled} bytes — and no further wakeup will come for them. The fix: loop reading until EAGAIN.`
              : 'Edge-triggered fired once and a single read happened to drain everything — fine here, but fragile: always loop until EAGAIN.'}
        </div>
      </div>

      <p className="epl-foot">
        epoll isn't magic — it trades O(n)-per-call for O(1) registration (<code>epoll_ctl</code>) plus
        O(active) wakeups, so it wins exactly when you hold many <em>mostly-idle</em> connections (the typical
        server). For all-active fds the edge over poll shrinks. Edge-triggered mode minimizes wakeups but
        demands you drain each socket fully (loop until the read returns EAGAIN) or you stall — the single
        most common epoll bug. BSD/macOS solve the same problem with <strong>kqueue</strong>, Windows with
        <strong> IOCP</strong>, and the newer <strong>io_uring</strong> goes further by batching the actual
        reads/writes, not just the readiness notifications. (Kegel, "The C10K problem"; epoll(7).)
      </p>
    </div>
  );
}
