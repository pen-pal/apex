// Write-Ahead Logging, made visible. A log of transaction records with a crash slider:
// drag where the crash happens and watch recovery REDO the transactions whose commit record
// survived and UNDO the ones whose didn't — restoring a consistent database either way.
// Real recovery logic in wal.ts (tested).
import { useMemo, useState } from 'react';
import { recover, crashAt, type Rec } from './wal';

const INITIAL = { x: '100', y: '50', z: '7' };

const LOG: Rec[] = [
  { lsn: 1, txid: 1, type: 'update', key: 'x', before: '100', after: '200' },
  { lsn: 2, txid: 1, type: 'commit' },
  { lsn: 3, txid: 2, type: 'update', key: 'y', before: '50', after: '300' },
  { lsn: 4, txid: 3, type: 'update', key: 'z', before: '7', after: '42' },
  { lsn: 5, txid: 2, type: 'commit' },
  { lsn: 6, txid: 3, type: 'update', key: 'z', before: '42', after: '99' },
  // tx3 never commits
];

export function WalSection() {
  const [crash, setCrash] = useState(6);
  const survived = useMemo(() => crashAt(LOG, crash), [crash]);
  const r = useMemo(() => recover(survived, INITIAL), [survived]);

  const recordTx = (rec: Rec) => rec.txid;
  const fate = (txid: number) => (r.committed.includes(txid) ? 'redo' : 'undo');

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Write-Ahead Logging — surviving a crash</h2></div>
        <p className="jsec-sub">
          The golden rule of durability: write the change to a sequential <strong>log</strong> (and flush it) <em>before</em> touching
          the actual data pages. Then a crash can’t corrupt anything — on restart, recovery replays the log: <strong>REDO</strong> every
          transaction that has a COMMIT record, <strong>UNDO</strong> every one that doesn’t. Drag the crash point and watch the outcome:
        </p>

        <div className="wal-crashctl">
          <span>💥 crash after LSN</span>
          <input type="range" min={1} max={LOG.length} value={crash} onChange={(e) => setCrash(+e.target.value)} />
          <b>{crash}</b>
        </div>

        <div className="wal-log">
          {LOG.map((rec) => {
            const lost = rec.lsn > crash;
            return (
              <div key={rec.lsn} className={`wal-rec ${lost ? 'lost' : ''} ${!lost ? fate(recordTx(rec)) : ''} ${rec.type}`}>
                <span className="wal-lsn">#{rec.lsn}</span>
                <span className="wal-tx">T{rec.txid}</span>
                <span className="wal-body">
                  {rec.type === 'commit' ? <b>COMMIT</b> : <>{rec.key}: {rec.before} → {rec.after}</>}
                </span>
                {!lost && <span className="wal-fate">{rec.type === 'commit' ? '' : fate(recordTx(rec)) === 'redo' ? '↻ redo' : '↶ undo'}</span>}
                {lost && <span className="wal-fate dim">lost</span>}
              </div>
            );
          })}
        </div>

        <div className="wal-recovery">
          <div className="wal-rlabel">recovered database:</div>
          <div className="wal-state">
            {Object.entries(r.final).map(([k, v]) => (
              <span key={k} className={`wal-cell ${v !== INITIAL[k as keyof typeof INITIAL] ? 'changed' : ''}`}>{k} = {v}</span>
            ))}
          </div>
          <div className="wal-summary">
            committed (durable): {r.committed.length ? r.committed.map((t) => `T${t}`).join(', ') : 'none'} ·
            rolled back: {r.aborted.length ? r.aborted.map((t) => `T${t}`).join(', ') : 'none'}
          </div>
        </div>

        <p className="wal-foot">
          Two transactions illustrate it: T1 and T2 commit, T3 never does. Crash before LSN 5 and T2’s commit is gone, so T2’s write
          to <code>y</code> is undone; crash after it and T2 is durable. T3’s writes to <code>z</code> are always undone — no commit
          record exists. Real recovery (ARIES) also writes periodic <strong>checkpoints</strong> so it needn’t replay the entire log,
          and logs UNDO actions too so recovery is itself crash-safe. This same log, streamed to replicas, is how Postgres does
          replication and point-in-time restore.
        </p>
      </section>
    </div>
  );
}
