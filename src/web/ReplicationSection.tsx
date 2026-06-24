// WAL leader-follower replication, made visible. The leader appends to its log;
// followers copy it, lagging behind. SYNC waits for a quorum before acking (durable);
// ASYNC acks immediately (fast, but a crash loses the un-replicated tail). Append,
// replicate, then crash the leader and see exactly what survived. Real model (replication.ts).
import { useState } from 'react';
import { initRepl, append, replicateOne, replicateAll, commitIndex, leaderCrashes, type ReplState, type FailoverResult, type Mode } from './replication';

export function ReplicationSection() {
  const [s, setS] = useState<ReplState>(() => initRepl('sync', 2));
  const [crash, setCrash] = useState<FailoverResult | null>(null);

  const mutate = (next: ReplState) => { setS(next); setCrash(null); };
  const doAppend = () => mutate(append(s, `e${s.log.length + 1}`));
  const setMode = (mode: Mode) => mutate(initRepl(mode, s.followers.length));
  const ci = commitIndex(s);

  const cellClass = (i: number) => (i < s.ackedIndex ? 'acked' : i < ci ? 'committed' : 'pending');

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Replication &amp; the write-ahead log</h2></div>
        <p className="jsec-sub">
          A database survives crashes by writing every change to an ordered <strong>log</strong> and copying it to
          replicas. The leader appends; followers replay, lagging behind. <strong>Sync</strong> replication waits for a
          majority before telling the client “done” (durable, slower); <strong>async</strong> says done immediately
          (fast, but a crash can lose whatever the followers hadn’t copied yet). Append, replicate, then crash the leader.
        </p>

        <div className="rp-controls">
          <div className="seg">
            <button className={s.mode === 'sync' ? 'on' : ''} onClick={() => setMode('sync')}>Sync (durable)</button>
            <button className={s.mode === 'async' ? 'on' : ''} onClick={() => setMode('async')}>Async (fast)</button>
          </div>
          <button className="ghost small" onClick={doAppend}>＋ append entry</button>
          {s.followers.map((_, i) => <button key={i} className="ghost small" onClick={() => mutate(replicateOne(s, i))}>replicate F{i} →</button>)}
          <button className="ghost small" onClick={() => mutate(replicateAll(s))}>replicate all</button>
          <button className="ghost small rp-crash" onClick={() => setCrash(leaderCrashes(s))}>💥 leader crashes</button>
          <button className="ghost small" onClick={() => mutate(initRepl(s.mode, s.followers.length))}>↺ reset</button>
        </div>

        <div className="rp-logs">
          <div className="rp-row">
            <span className="rp-label">Leader{!crash && ''}</span>
            <div className="rp-cells">
              {s.log.map((e, i) => (
                <span key={i} className={`rp-cell ${cellClass(i)} ${crash && i >= crash.survivedIndex ? 'lost' : ''}`}>{e}</span>
              ))}
              {s.log.length === 0 && <span className="rp-empty">empty — append something</span>}
            </div>
            <span className="rp-meta">ack {s.ackedIndex} · commit {ci}</span>
          </div>
          {s.followers.map((f, fi) => {
            const promoted = crash?.newLeaderFollower === fi;
            return (
              <div className={`rp-row ${promoted ? 'promoted' : ''}`} key={fi}>
                <span className="rp-label">Follower {fi}{promoted && ' 👑 new leader'}</span>
                <div className="rp-cells">
                  {s.log.map((e, i) => <span key={i} className={`rp-cell ${i < f ? 'has' : 'missing'}`}>{i < f ? e : '·'}</span>)}
                </div>
                <span className="rp-meta">{f}/{s.log.length}</span>
              </div>
            );
          })}
        </div>

        {crash && (
          <div className={`rp-failover ${crash.ackedLost ? 'bad' : 'ok'}`}>
            <strong>Leader crashed.</strong> Follower {crash.newLeaderFollower} (the most up-to-date, with {crash.survivedIndex} entries) is promoted.
            {crash.lost.length > 0
              ? <> Entries <code>{crash.lost.join(', ')}</code> existed only on the dead leader and are <strong>LOST</strong>.</>
              : <> Nothing was lost — every entry had reached a follower.</>}
            {crash.ackedLost
              ? <div className="rp-warn">⚠ Some of the lost entries had been <strong>acknowledged to the client</strong> — async replication’s data-loss window. The client thinks they’re saved; they aren’t.</div>
              : <div className="rp-good">✓ No acknowledged write was lost — that’s the sync durability guarantee (a write is only ack’d once a quorum has it).</div>}
          </div>
        )}
        <p className="enc-note">This is the core trade-off behind every replicated store. Postgres, MySQL, Kafka and friends let you tune it per
          write: <em>synchronous_commit</em> / acks=all for durability, or async for throughput. Semi-sync (ack after <em>one</em> replica) is the common
          middle ground. Raft (in the Distributed systems group) makes the quorum-commit rule mandatory so a committed entry is never lost.</p>
      </section>
    </div>
  );
}
