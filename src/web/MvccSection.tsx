// MVCC, made visible. A scripted scenario of two concurrent transactions over one row:
// step through it and watch each write append a new version (not overwrite), and watch the
// long-running reader keep seeing its snapshot even after the other transaction commits a
// new value — the essence of snapshot isolation. Real visibility logic in mvcc.ts (tested).
import { useMemo, useState } from 'react';
import { emptyStore, read, write, inspect, type Store, type Snapshot } from './mvcc';

interface Step { label: string; detail: string; apply: (s: Store) => void; readers: { who: string; snap: Snapshot }[] }

const T2: Snapshot = { txid: 2, committed: new Set([1]) };        // begins seeing only tx1
const T3: Snapshot = { txid: 3, committed: new Set([1]) };        // concurrent writer
const T4: Snapshot = { txid: 4, committed: new Set([1, 3]) };     // begins after tx3 commits

const SCRIPT: Step[] = [
  { label: 'tx1 creates the row, commits', detail: 'balance = 100 is now the committed value.', apply: (s) => write(s, 'balance', '100', { txid: 1, committed: new Set() }), readers: [] },
  { label: 'T2 begins and reads', detail: 'T2’s snapshot includes tx1 → it reads 100.', apply: () => {}, readers: [{ who: 'T2', snap: T2 }] },
  { label: 'T3 updates the balance to 200', detail: 'A NEW version is appended; the old one is retired (xmax = 3). T3 has not committed to T2.', apply: (s) => write(s, 'balance', '200', T3), readers: [{ who: 'T2', snap: T2 }] },
  { label: 'T2 reads again', detail: 'T2’s snapshot still excludes tx3 → it STILL reads 100. Readers don’t see writes committed after their snapshot.', apply: () => {}, readers: [{ who: 'T2', snap: T2 }] },
  { label: 'T4 begins (after tx3) and reads', detail: 'T4’s snapshot includes tx3 → it reads the new value, 200.', apply: () => {}, readers: [{ who: 'T2', snap: T2 }, { who: 'T4', snap: T4 }] },
];

export function MvccSection() {
  const [step, setStep] = useState(SCRIPT.length - 1);

  const store = useMemo(() => {
    const s = emptyStore();
    for (let i = 0; i <= step; i++) SCRIPT[i].apply(s);
    return s;
  }, [step]);

  const cur = SCRIPT[step];
  const versions = inspect(store, 'balance', { txid: 99, committed: new Set([1, 3]) }); // god-view: all committed

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>MVCC — readers and writers that never block</h2></div>
        <p className="jsec-sub">
          A database that overwrote rows in place would force a reader to wait for a writer (and vice-versa). MVCC keeps <em>every</em>
          version of a row, each tagged with the transaction that made it. A transaction reads against a <strong>snapshot</strong> — the
          transactions committed when it began — so it sees a frozen, consistent picture while other writes pile up new versions beside
          it. Step through two concurrent transactions:
        </p>

        <div className="mvcc-controls">
          <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>◀</button>
          <span className="mvcc-count">step {step + 1} / {SCRIPT.length}</span>
          <button onClick={() => setStep(Math.min(SCRIPT.length - 1, step + 1))} disabled={step >= SCRIPT.length - 1}>▶</button>
        </div>

        <div className="mvcc-now"><b>{cur.label}</b><span>{cur.detail}</span></div>

        <div className="mvcc-versions">
          <div className="mvcc-vlabel">versions of <code>balance</code> on disk (newest first):</div>
          {versions.map((r, i) => (
            <div key={i} className="mvcc-ver">
              <span className="mvcc-val">{r.version.value}</span>
              <span className="mvcc-meta">xmin={r.version.xmin} · xmax={r.version.xmax ?? '—'}</span>
            </div>
          ))}
        </div>

        <div className="mvcc-readers">
          {cur.readers.map((rd) => {
            const v = read(store, 'balance', rd.snap).value;
            return (
              <div key={rd.who} className="mvcc-reader">
                <b>{rd.who}</b> sees <code>balance = {v}</code>
                <span className="mvcc-snap">snapshot: committed {`{${[...rd.snap.committed].join(', ') || '∅'}}`}</span>
              </div>
            );
          })}
        </div>

        <p className="mvcc-foot">
          This is why <code>SELECT</code> never waits for an <code>UPDATE</code> in PostgreSQL. The cost is that dead versions accumulate
          and must be garbage-collected (Postgres’s VACUUM). Snapshot isolation prevents dirty reads and non-repeatable reads, but not
          <em> write skew</em> — two transactions can each read-then-write disjoint rows on a shared invariant and both commit; truly
          serializable isolation (SSI) adds conflict detection on top. Oracle, MySQL/InnoDB, and CockroachDB all build on this versioned
          core.
        </p>
      </section>
    </div>
  );
}
