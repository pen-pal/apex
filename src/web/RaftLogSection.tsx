// Raft log replication, made visible. Two parts: (1) Log Matching — a follower whose log diverged is
// reconciled by the leader backing up nextIndex until the consistency check passes, then overwriting the
// bad suffix; (2) the commit rule, including the §5.4.2 safety case where a term-2 entry sitting on a
// majority still can't be committed until a current-term entry above it commits. Logic from raftlog.ts.
import { useMemo, useState } from 'react';
import { syncFollower, commitIndex, type Entry } from './raftlog';

const E = (term: number, cmd: string): Entry => ({ term, cmd });
const TERM_COLOR = ['', 'hsl(212 60% 55%)', 'hsl(150 50% 45%)', 'hsl(280 50% 58%)', 'hsl(0 65% 58%)'];

function Log({ log, commit }: { log: Entry[]; commit?: number }) {
  return (
    <div className="rl-log">
      {log.length === 0 ? <span className="rl-empty">∅</span> : log.map((e, i) => (
        <span key={i} className={`rl-entry ${commit != null && i <= commit ? 'committed' : ''}`} style={{ background: TERM_COLOR[e.term] ?? '#999' }} title={`index ${i} · term ${e.term}`}>
          {e.cmd}<i>t{e.term}</i>
        </span>
      ))}
    </div>
  );
}

const SCENARIOS: Record<string, { label: string; logs: Entry[][]; note: (c: number) => string }> = {
  safe: {
    label: 'current-term entry reaches a majority',
    logs: [[E(1, 'a'), E(2, 'b'), E(3, 'c')], [E(1, 'a'), E(2, 'b'), E(3, 'c')], [E(1, 'a'), E(2, 'b'), E(3, 'c')], [E(1, 'a'), E(2, 'b')], [E(1, 'a')]],
    note: (c) => `The term-3 entry at index 2 is on 3/5 nodes → commitIndex = ${c}. Everything up to and including it (even the older term-2 entry) is now committed and safe forever.`,
  },
  unsafe: {
    label: 'only a prior-term entry has a majority (§5.4.2)',
    logs: [[E(1, 'a'), E(2, 'b'), E(3, 'c')], [E(1, 'a'), E(2, 'b')], [E(1, 'a'), E(2, 'b')], [E(1, 'a')], [E(1, 'a')]],
    note: (c) => `The term-2 entry at index 1 sits on a majority (3/5) — but the leader is in term 3, so it MUST NOT commit it by counting (commitIndex = ${c}). A future leader could still overwrite it. This is the Figure-8 fix.`,
  },
};

export function RaftLogSection() {
  const [scn, setScn] = useState('unsafe');
  const sc = SCENARIOS[scn];
  const commit = useMemo(() => commitIndex(sc.logs, 3), [scn]);

  // log-matching sync demo
  const leader = [E(1, 'a'), E(2, 'b'), E(3, 'c'), E(3, 'd')];
  const diverged = [E(1, 'a'), E(2, 'b'), E(4, 'x'), E(4, 'y')];
  const sync = useMemo(() => syncFollower(leader, diverged), []);

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Raft log replication — making every log identical, safely</h2></div>
        <p className="jsec-sub">
          Election picks a leader; replication is how it makes the followers’ logs match its own and decides when an entry is durable. The
          leader sends <strong>AppendEntries</strong> with the index/term of the entry just before the new ones — a follower accepts only if it
          has that entry (<strong>Log Matching</strong>), so agreement at the tip guarantees agreement on the whole prefix.
        </p>

        <h3 className="rl-h3">1 · Log matching — reconciling a divergent follower</h3>
        <div className="rl-sync">
          <div className="rl-row"><span className="rl-rlbl">leader</span><Log log={leader} /></div>
          <div className="rl-row"><span className="rl-rlbl">follower (was)</span><Log log={diverged} /></div>
          <div className="rl-row"><span className="rl-rlbl">follower (now)</span><Log log={sync.log} /></div>
        </div>
        <p className="rl-note">
          The leader tried nextIndex = {sync.nextIndexTried.join(' → ')}, backing up on each rejection until the consistency check passed at index
          {' '}{Math.min(...sync.nextIndexTried) - 1}, then overwrote the follower’s term-4 suffix with its own. {sync.rounds} round-trips.
        </p>

        <h3 className="rl-h3">2 · When is an entry committed? (the §5.4.2 rule)</h3>
        <div className="rl-scns">
          {Object.entries(SCENARIOS).map(([k, s]) => <button key={k} className={`rl-scn ${scn === k ? 'on' : ''}`} onClick={() => setScn(k)}>{s.label}</button>)}
        </div>
        <div className="rl-cluster">
          {sc.logs.map((lg, i) => (
            <div key={i} className="rl-row"><span className="rl-rlbl">{i === 0 ? 'leader' : `follower ${i}`}</span><Log log={lg} commit={i === 0 ? commit : undefined} /></div>
          ))}
        </div>
        <div className={`rl-verdict ${commit >= 0 ? 'ok' : 'hold'}`}>
          commitIndex = <b>{commit}</b> — {sc.note(commit)}
        </div>

        <p className="rl-foot">
          The leader counts replicas only for entries from its <em>own</em> term; older entries ride to safety underneath them. Without that rule,
          the Figure-8 scenario lets an entry that’s on a majority later get overwritten — violating the core promise that a committed entry is
          permanent. Combined with the election restriction (a candidate must have an up-to-date log to win), this gives Raft its State Machine
          Safety property: if any server has applied an entry at an index, no other server ever applies a different one there. It’s the same
          guarantee Paxos provides, arranged to be teachable — which is why etcd, Consul, CockroachDB, and TiKV all run Raft.
        </p>
      </section>
    </div>
  );
}
