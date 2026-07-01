// Read repair, made visible. Five replicas of one key. A write reaches only some of them (others are "down"),
// so versions drift apart. Pick a read set (click replicas), hit read, and watch the coordinator return the
// freshest version AND write it back to the stale replicas it touched — healing them for free. If your read
// set misses the newest write, you get a stale read: the reason strong consistency wants R + W > N. Real model
// from readrepair.ts.
import { useState } from 'react';
import { read, write, converged, type Replica, type ReadResult } from './readrepair';

const fresh = (): Replica[] => [0, 1, 2, 3, 4].map((id) => ({ id, value: 'A', version: 1 }));
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

export function ReadRepairSection() {
  const [reps, setReps] = useState<Replica[]>(fresh);
  const [readSet, setReadSet] = useState<number[]>([1, 3, 4]);
  const [ver, setVer] = useState(1);
  const [last, setLast] = useState<ReadResult | null>(null);

  const globalNewest = Math.max(...reps.map((r) => r.version));
  const toggle = (id: number) => { setReadSet((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id])); setLast(null); };

  const doWrite = () => {
    const v = ver + 1;
    const target = [v % 5, (v + 1) % 5, (v + 2) % 5]; // a rotating set of 3 reachable replicas (2 miss it)
    const copy = reps.map((r) => ({ ...r }));
    write(copy, target, LETTERS[v] ?? 'Z', v);
    setReps(copy); setVer(v); setLast(null);
  };
  const doRead = () => {
    if (readSet.length === 0) return;
    const copy = reps.map((r) => ({ ...r }));
    setLast(read(copy, readSet));
    setReps(copy);
  };
  const reset = () => { setReps(fresh()); setVer(1); setReadSet([1, 3, 4]); setLast(null); };

  return (
    <div className="rrp">
      <p className="rrp-intro">
        One key, five replicas. Writes don't always reach every replica, so their versions <strong>drift
        apart</strong>. When you read at consistency level R, the coordinator queries R replicas, returns the
        <strong> freshest</strong> value, and <strong>writes it back</strong> to any it finds behind — repair as
        a side effect of the read. Click replicas to build a read set:
      </p>

      <div className="rrp-replicas">
        {reps.map((r) => {
          const inSet = readSet.includes(r.id);
          const stale = r.version < globalNewest;
          const repaired = last?.repaired.includes(r.id);
          return (
            <button key={r.id} type="button" className={`rrp-rep ${inSet ? 'inset' : ''} ${stale ? 'stale' : 'fresh'} ${repaired ? 'repaired' : ''}`} onClick={() => toggle(r.id)}>
              <span className="rrp-rid">replica {r.id}</span>
              <span className="rrp-val">{r.value}</span>
              <span className="rrp-ver">v{r.version}{stale ? ' · stale' : ''}</span>
              {inSet && <span className="rrp-badge">in read set</span>}
              {repaired && <span className="rrp-fixed">✓ repaired</span>}
            </button>
          );
        })}
      </div>

      <div className="rrp-controls">
        <button type="button" className="rrp-btn write" onClick={doWrite}>✎ write (reaches only 3 of 5)</button>
        <button type="button" className="rrp-btn read" disabled={readSet.length === 0} onClick={doRead}>🔍 read {readSet.length} replicas (repair)</button>
        <button type="button" className="rrp-btn ghost" onClick={reset}>reset</button>
        <span className={`rrp-conv ${converged(reps) ? 'ok' : 'bad'}`}>{converged(reps) ? '✓ all replicas agree' : '⚠ replicas diverged'}</span>
      </div>

      {last && (
        <div className={`rrp-result ${last.sawNewest ? 'ok' : 'bad'}`}>
          <div className="rrp-rval">read returned <b>{last.value}</b> (v{last.version}) · {last.repaired.length ? <>repaired replica{last.repaired.length > 1 ? 's' : ''} <b>{last.repaired.join(', ')}</b></> : 'nothing to repair'}</div>
          {!last.sawNewest && <div className="rrp-warn">⚠ STALE READ — the newest version is v{last.globalNewest}, but your read set missed it. With R + W {'>'} N the read set is guaranteed to overlap the write set, so this can't happen.</div>}
        </div>
      )}

      <p className="rrp-foot">
        Read repair is one of three convergence mechanisms an AP store leans on together: <strong>hinted
        handoff</strong> catches a single node up when it comes back, <strong>anti-entropy</strong> periodically
        Merkle-syncs entire datasets in the background, and <strong>read repair</strong> opportunistically fixes
        whatever hot keys happen to be read. The elegance is that popular data self-heals with no extra traffic;
        the limit is that <em>cold</em> data (rarely read) can stay stale until anti-entropy sweeps it, which is
        why you can't rely on read repair alone. Two design knobs matter: the version comparison must be a real
        causal check — a scalar timestamp works only with a single writer; concurrent writes need <strong>vector
        clocks</strong> (or last-write-wins with synchronized clocks, which can silently drop updates) so
        "freshest" is well-defined. And <strong>R + W {'>'} N</strong> is what turns "eventually consistent" into
        "read-your-writes": it forces every read quorum to overlap every write quorum by at least one replica, so
        the freshest version is always in the read set. Systems expose R and W as per-request knobs so you can
        trade latency for consistency call by call. (Dynamo, 2007; Cassandra.)
      </p>
    </div>
  );
}
