// RCU, made visible. Add readers (they pin whatever version is published right now, and never block). Hit
// "writer update" and a NEW version is copied, modified, and published atomically — but the old version can't
// be freed while any reader still holds it. Watch old versions linger in "grace period" until their last
// reader leaves, then get reclaimed. Readers pinned to old versions keep reading them safely the whole time.
// Real model from rcu.ts.
import { useRef, useState } from 'react';
import { RCU } from './rcu';

export function RcuSection() {
  const rcuRef = useRef<RCU | null>(null);
  if (!rcuRef.current) rcuRef.current = new RCU('routes →10.0.0.0');
  const r = rcuRef.current;
  const [, setTick] = useState(0);
  const [ver, setVer] = useState(1);
  const bump = () => setTick((x) => x + 1);

  const addReader = () => { r.readerPin(); bump(); };
  const writerUpdate = () => { const n = ver; r.update(() => `routes →10.0.0.${n}`); setVer(n + 1); bump(); };
  const unpin = (id: number) => { r.readerUnpin(id); bump(); };
  const reset = () => { rcuRef.current = new RCU('routes →10.0.0.0'); setVer(1); bump(); };

  const versions = r.allVersions();
  const readers = r.activeReaders();
  const pubId = r.publishedId_();
  const retiredLive = versions.filter((v) => v.retired && !v.reclaimed);

  const state = (v: (typeof versions)[number]) =>
    v.id === pubId ? 'published' : v.reclaimed ? 'reclaimed' : 'grace';

  return (
    <div className="rcu">
      <p className="rcu-intro">
        Readers take <strong>no lock</strong> and never block — each pins whatever version is published the
        instant it starts. A writer never edits in place: it <strong>copies</strong> the data, modifies the
        copy, and <strong>atomically swaps</strong> the published pointer. The old copy can only be freed once
        <strong> every reader that might still hold it has left</strong> — that wait is the <strong>grace
        period</strong>.
      </p>

      <div className="rcu-controls">
        <button type="button" className="rcu-btn reader" onClick={addReader}>+ reader (pin current)</button>
        <button type="button" className="rcu-btn writer" onClick={writerUpdate}>✎ writer update (copy + publish)</button>
        <button type="button" className="rcu-btn ghost" onClick={reset}>reset</button>
      </div>

      <div className="rcu-lane">
        <div className="rcu-lane-h">memory — versions</div>
        <div className="rcu-versions">
          {versions.map((v) => (
            <div key={v.id} className={`rcu-ver ${state(v)}`}>
              <div className="rcu-ver-top"><span className="rcu-vid">v{v.id}</span>
                <span className={`rcu-badge ${state(v)}`}>{state(v) === 'published' ? 'PUBLISHED' : state(v) === 'grace' ? 'grace period' : 'reclaimed'}</span>
              </div>
              <div className="rcu-val">{v.reclaimed ? '⌀ freed' : v.value}</div>
              <div className="rcu-refs">{v.refs} reader{v.refs === 1 ? '' : 's'} pinning</div>
            </div>
          ))}
        </div>
      </div>

      <div className="rcu-lane">
        <div className="rcu-lane-h">readers ({readers.length})</div>
        <div className="rcu-readers">
          {readers.length === 0 && <span className="rcu-empty">no active readers — add one</span>}
          {readers.map((rd) => {
            const v = versions.find((x) => x.id === rd.versionId)!;
            const stale = rd.versionId !== pubId;
            return (
              <div key={rd.readerId} className={`rcu-reader ${stale ? 'stale' : 'fresh'}`}>
                <span className="rcu-rid">R{rd.readerId}</span>
                <span className="rcu-reads">reads <b>{v.value}</b> (v{v.id}{stale ? ', old — safe' : ''})</span>
                <button type="button" className="rcu-leave" onClick={() => unpin(rd.readerId)}>leave ✕</button>
              </div>
            );
          })}
        </div>
      </div>

      <div className={`rcu-note ${retiredLive.length ? 'wait' : 'clear'}`}>
        {retiredLive.length
          ? `⏳ grace period in progress: ${retiredLive.length} old version${retiredLive.length === 1 ? '' : 's'} can't be freed until their readers leave. Have those readers "leave" to reclaim them.`
          : '✓ no version is waiting on a grace period — every retired copy has been reclaimed.'}
      </div>

      <p className="rcu-foot">
        The asymmetry is deliberate: reads are almost free (grab a pointer, use it — no atomics on the fast
        path, no cache-line ping-pong between CPUs), while the writer absorbs the cost of copying and waiting out
        the grace period. That makes RCU a huge win for <strong>read-mostly</strong> data — routing tables,
        mount trees, the directory cache — where writes are rare but reads are constant and must not stall. The
        subtlety is the grace period: the kernel doesn't track per-object refcounts like this visualization
        does; it detects when every CPU has passed through a quiescent state (a context switch, or an explicit
        <code>rcu_read_unlock</code>), which guarantees no CPU can still hold a pre-existing pointer. Get it
        wrong and you get a use-after-free — the exact bug RCU's grace period exists to prevent. (McKenney, Linux
        RCU.)
      </p>
    </div>
  );
}
