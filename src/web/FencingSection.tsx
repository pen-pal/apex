// Fencing tokens, made visible. The classic split-brain scenario played out twice side by
// side — without fencing, a paused-then-resumed client overwrites fresh data with stale; with
// fencing, the resource rejects the old token and the correct data survives. Real logic in
// fencing.ts (tested).
import { useMemo } from 'react';
import { splitBrainScenario } from './fencing';

export function FencingSection() {
  const sc = useMemo(() => splitBrainScenario(), []);

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Fencing tokens — why a lock isn’t enough</h2></div>
        <p className="jsec-sub">
          Client A acquires a distributed lock (token 1), then freezes — a long garbage-collection pause. Its lease expires, so the lock
          service grants the lock to Client B (token 2), which does its work. Then A wakes up, still believing it holds the lock, and
          writes. A plain lock can’t stop this; the trick is to stamp each grant with an ever-increasing <strong>fencing token</strong> and
          have the resource reject any write whose token is older than the newest it has seen.
        </p>

        <div className="fence-timeline">
          <div className="fence-tl-row"><span className="fence-actor a">Client A</span><div className="fence-tl-bar"><span className="fence-ev" style={{ left: '2%' }}>acquire → token 1</span><span className="fence-ev pause" style={{ left: '28%' }}>⏸ GC pause…</span><span className="fence-ev" style={{ left: '74%' }}>resume → write (token 1)</span></div></div>
          <div className="fence-tl-row"><span className="fence-actor b">Client B</span><div className="fence-tl-bar"><span className="fence-ev" style={{ left: '40%' }}>acquire → token 2</span><span className="fence-ev" style={{ left: '56%' }}>write (token 2)</span></div></div>
        </div>

        <div className="fence-cols">
          <div className="fence-col bad">
            <h3>❌ Without fencing</h3>
            <div className="fence-log">
              {sc.withoutFencing.log.map((l, i) => <div key={i} className="fence-line ok">{l}</div>)}
            </div>
            <div className="fence-final bad">final value: <b>“{sc.withoutFencing.value}”</b> — the stale resumed client clobbered B’s write. Data corrupted.</div>
          </div>
          <div className="fence-col good">
            <h3>✅ With fencing</h3>
            <div className="fence-log">
              {sc.withFencing.log.map((l, i) => <div key={i} className={`fence-line ${l.includes('REJECTED') ? 'rej' : 'ok'}`}>{l}</div>)}
            </div>
            <div className="fence-final good">final value: <b>“{sc.withFencing.value}”</b> — A’s token (1) is older than the resource’s high-water mark (2), so it’s fenced out. Correct.</div>
          </div>
        </div>

        <p className="fence-foot">
          The key property is monotonicity: the lock service must hand out strictly increasing tokens (a Paxos/Raft/ZooKeeper-style
          counter), and the resource must remember the highest it has honoured and reject anything lower. This converts “I think I hold the
          lock” into a checkable fact at the point of the write — defending against the unavoidable reality that a lock holder can be paused
          or partitioned for arbitrarily long. ZooKeeper’s <code>zxid</code> and the version numbers in optimistic-concurrency systems play
          exactly this role.
        </p>
      </section>
    </div>
  );
}
