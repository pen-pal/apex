// Two-phase locking & deadlock, made visible. Pick a scenario of lock requests and watch
// the lock table fill, requests block, and the wait-for graph form — and when the waits
// close a cycle, the deadlock lights up. Real lock + cycle-detection logic in locking.ts
// (tested).
import { useMemo, useState } from 'react';
import { run, type Request } from './locking';

const SCENARIOS: { name: string; reqs: Request[] }[] = [
  {
    name: 'Deadlock (T1↔T2)',
    reqs: [
      { txid: 1, resource: 'A', mode: 'X' }, { txid: 2, resource: 'B', mode: 'X' },
      { txid: 1, resource: 'B', mode: 'X' }, { txid: 2, resource: 'A', mode: 'X' },
    ],
  },
  {
    name: 'Shared reads coexist',
    reqs: [{ txid: 1, resource: 'A', mode: 'S' }, { txid: 2, resource: 'A', mode: 'S' }, { txid: 3, resource: 'A', mode: 'S' }],
  },
  {
    name: 'Writer blocks readers',
    reqs: [{ txid: 1, resource: 'A', mode: 'X' }, { txid: 2, resource: 'A', mode: 'S' }, { txid: 3, resource: 'A', mode: 'S' }],
  },
  {
    name: 'Three-way deadlock',
    reqs: [
      { txid: 1, resource: 'A', mode: 'X' }, { txid: 2, resource: 'B', mode: 'X' }, { txid: 3, resource: 'C', mode: 'X' },
      { txid: 1, resource: 'B', mode: 'X' }, { txid: 2, resource: 'C', mode: 'X' }, { txid: 3, resource: 'A', mode: 'X' },
    ],
  },
];

const TX_COLOR = ['hsl(212 65% 52%)', 'hsl(150 50% 42%)', 'hsl(28 80% 52%)'];

export function LockingSection() {
  const [si, setSi] = useState(0);
  const o = useMemo(() => run(SCENARIOS[si].reqs), [si]);
  const txids = [...new Set(SCENARIOS[si].reqs.map((r) => r.txid))].sort();
  const deadset = new Set(o.deadlock ?? []);
  const col = (tx: number) => TX_COLOR[(tx - 1) % TX_COLOR.length];

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Locking &amp; deadlock — when transactions wait forever</h2></div>
        <p className="jsec-sub">
          To stay correct under concurrency, a transaction locks each row before using it: <strong>shared</strong> locks (reads) coexist,
          but an <strong>exclusive</strong> lock (write) conflicts with everything. If the lock you need is held, you wait — and if two
          transactions each wait on a lock the other holds, neither can proceed. That cycle in the <em>wait-for graph</em> is a deadlock.
        </p>

        <div className="lock-pick">
          {SCENARIOS.map((s, k) => <button key={k} className={si === k ? 'on' : ''} onClick={() => setSi(k)}>{s.name}</button>)}
        </div>

        <div className="lock-cols">
          <div className="lock-table">
            <h3>lock table</h3>
            {Object.entries(o.holders).filter(([, h]) => h.length).map(([res, holds]) => (
              <div key={res} className="lock-row">
                <span className="lock-res">{res}</span>
                <span className="lock-holds">
                  {holds.map((h, i) => <em key={i} style={{ background: col(h.txid) }}>T{h.txid}:{h.mode}</em>)}
                </span>
              </div>
            ))}
            {o.waiting.length > 0 && (
              <div className="lock-waiting">
                waiting: {o.waiting.map((w, i) => <em key={i} className="lock-wait">T{w.txid} wants {w.resource}:{w.mode}</em>)}
              </div>
            )}
          </div>

          <div className="lock-graph">
            <h3>wait-for graph</h3>
            <div className="lock-nodes">
              {txids.map((tx) => (
                <div key={tx} className={`lock-node ${deadset.has(tx) ? 'dead' : ''}`} style={{ borderColor: col(tx) }}>T{tx}</div>
              ))}
            </div>
            <div className="lock-edges">
              {o.waitFor.map(([a, b], i) => (
                <div key={i} className={`lock-edge ${deadset.has(a) && deadset.has(b) ? 'dead' : ''}`}>T{a} <span>waits for</span> T{b}</div>
              ))}
              {o.waitFor.length === 0 && <div className="lock-noedge">no transaction is blocked</div>}
            </div>
          </div>
        </div>

        <div className={`lock-verdict ${o.deadlock ? 'bad' : 'ok'}`}>
          {o.deadlock
            ? `⛔ DEADLOCK — transactions ${o.deadlock.map((t) => `T${t}`).join(' → ')} → T${o.deadlock[0]} form a cycle. The database must abort a victim to break it.`
            : o.waiting.length
              ? '⏳ Some transactions are blocked, but the waits form no cycle — they will proceed once the holders release.'
              : '✓ All locks granted, no contention.'}
        </div>

        <p className="lock-foot">
          The “two-phase” in 2PL is the protocol that makes locking <em>serializable</em>: a transaction acquires all the locks it will
          ever need (growing phase) before releasing any (shrinking phase). Strict 2PL holds every lock until commit, preventing cascading
          aborts. Deadlocks are handled by detection (find a cycle, abort a victim — what most databases do) or prevention (lock ordering,
          or wait-die / wound-wait timestamp schemes). This is the pessimistic counterpart to MVCC’s optimistic versioning.
        </p>
      </section>
    </div>
  );
}
