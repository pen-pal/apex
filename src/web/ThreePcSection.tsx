// Three-phase commit, made visible. Set the participants' votes and pick where the coordinator crashes, then
// compare 2PC and 3PC side by side. The one scenario that matters: all-yes, coordinator dies right after the
// votes. 2PC leaves everyone stuck "prepared" — BLOCKED, holding locks. 3PC's extra pre-commit phase lets the
// survivors decide on their own, so it keeps moving. Real model from threepc.ts.
import { useState } from 'react';
import { twoPhase, threePhase, type Fail, type CommitResult } from './threepc';

const FAILS: { id: Fail; label: string }[] = [
  { id: 'none', label: 'coordinator stays up' },
  { id: 'afterVotes', label: 'crashes after votes' },
  { id: 'afterPrepare', label: 'crashes after pre-commit' },
];

function Panel({ r }: { r: CommitResult }) {
  const tone = r.decision === 'commit' ? 'ok' : r.decision === 'abort' ? 'warn' : 'bad';
  return (
    <div className={`t3c-panel ${tone}`}>
      <div className="t3c-ph">{r.protocol === '2pc' ? 'Two-phase commit' : 'Three-phase commit'}</div>
      <ol className="t3c-steps">{r.steps.map((s, i) => <li key={i} className={s.startsWith('⚠') ? 'warn' : ''}>{s}</li>)}</ol>
      <div className={`t3c-decision ${tone}`}>
        {r.decision === 'blocked' ? '⛔ BLOCKED — participants stuck holding locks' : r.decision === 'commit' ? '✓ COMMIT' : '↩ ABORT'}
        {r.blocking && <span className="t3c-blk">blocking</span>}
        {!r.blocking && r.decision !== 'blocked' && <span className="t3c-nonblk">non-blocking</span>}
      </div>
    </div>
  );
}

export function ThreePcSection() {
  const [votes, setVotes] = useState([true, true, true]);
  const [fail, setFail] = useState<Fail>('afterVotes');
  const toggle = (i: number) => setVotes((v) => v.map((x, j) => (j === i ? !x : x)));

  const two = twoPhase(votes, fail);
  const three = threePhase(votes, fail);

  return (
    <div className="t3c">
      <p className="t3c-intro">
        Two-phase commit has a fatal flaw: if the coordinator crashes <strong>after collecting votes but before
        announcing the decision</strong>, every participant is stuck "prepared" — it can't safely commit or abort,
        so it <strong>blocks</strong>, holding locks, until the coordinator comes back. <strong>3PC</strong> adds
        a <strong>pre-commit</strong> phase so survivors can always infer the outcome — <strong>non-blocking</strong>.
      </p>

      <div className="t3c-controls">
        <div className="t3c-votes">
          <span className="t3c-vlbl">votes:</span>
          {votes.map((v, i) => (
            <button key={i} type="button" className={`t3c-vote ${v ? 'yes' : 'no'}`} onClick={() => toggle(i)}>P{i + 1} {v ? '✓ yes' : '✗ no'}</button>
          ))}
        </div>
        <div className="t3c-fails">
          {FAILS.map((f) => (
            <button key={f.id} type="button" className={`t3c-fbtn ${fail === f.id ? 'on' : ''}`} onClick={() => setFail(f.id)}>{f.label}</button>
          ))}
        </div>
      </div>

      <div className="t3c-compare">
        <Panel r={two} />
        <Panel r={three} />
      </div>

      {two.blocking && !three.blocking && (
        <div className="t3c-callout">👉 same crash, opposite outcome: 2PC is <b>stuck</b>, 3PC <b>decided and moved on</b>. That's the pre-commit phase earning its keep.</div>
      )}

      <p className="t3c-foot">
        Why the extra phase works: 3PC keeps the "can we?" agreement (votes) separate from "we will" (pre-commit)
        separate from "do it" (commit). A participant only pre-commits after learning <em>everyone</em> voted yes,
        so seeing any pre-commit anywhere is proof the transaction is committable. So why doesn't everyone use it?
        3PC assumes a <strong>synchronous</strong> network — bounded message delay and reliable failure detection —
        and it is <strong>not</strong> safe under a network <strong>partition</strong>: a split can let one side
        commit while the other aborts. Real systems chose <strong>consensus</strong> (Paxos/Raft) instead, which
        is safe under partitions (at the cost of needing a majority up), or they keep 2PC and add a
        <strong> recovery/transaction manager</strong> with a durable log so a restarted coordinator resolves the
        blocked transactions. (Skeen &amp; Stonebraker, 1983.)
      </p>
    </div>
  );
}
