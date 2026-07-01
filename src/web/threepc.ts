// Three-phase commit (3PC) — the fix for two-phase commit's fatal flaw: BLOCKING. In 2PC a coordinator asks
// everyone to prepare, collects yes/no votes, then broadcasts commit-or-abort. If the coordinator crashes
// AFTER the votes but BEFORE the decision, every participant is stuck "prepared" — it can't safely commit
// (maybe someone voted no) nor abort (maybe everyone voted yes) — so it BLOCKS, holding locks, until the
// coordinator returns. 3PC inserts a PRE-COMMIT phase between voting and committing. Now the states are
// separated enough that a surviving participant can always infer the outcome: if ANY participant reached
// pre-commit, everyone must have voted yes, so it's safe to commit; if none did, it's safe to abort. That
// makes 3PC NON-BLOCKING under a coordinator crash. The catch (why nobody actually uses it): it assumes a
// synchronous network with bounded delays and no partitions — under a real network partition it can still go
// wrong, which is exactly why consensus (Paxos/Raft) replaced it. Reference: Skeen & Stonebraker (1983).

export type Fail = 'none' | 'afterVotes' | 'afterPrepare';
export type Decision = 'commit' | 'abort' | 'blocked';
export interface CommitResult { protocol: '2pc' | '3pc'; decision: Decision; blocking: boolean; steps: string[] }

/** Two-phase commit. A coordinator crash after votes (before the decision) leaves participants BLOCKED. */
export function twoPhase(votes: boolean[], fail: Fail): CommitResult {
  const steps = ['phase 1: coordinator asks all to PREPARE', `votes: ${votes.map((v) => (v ? '✓' : '✗')).join(' ')}`];
  if (votes.some((v) => !v)) { steps.push('a NO vote → coordinator broadcasts ABORT'); return { protocol: '2pc', decision: 'abort', blocking: false, steps }; }
  if (fail === 'none') { steps.push('all voted YES → phase 2: coordinator broadcasts COMMIT'); return { protocol: '2pc', decision: 'commit', blocking: false, steps }; }
  // coordinator crashes after collecting votes — participants are prepared but don't know the decision
  steps.push('⚠ coordinator crashes after votes, before the decision');
  steps.push('participants are PREPARED but can\'t tell commit from abort → they BLOCK (locks held)');
  return { protocol: '2pc', decision: 'blocked', blocking: true, steps };
}

/** Three-phase commit. The pre-commit phase lets survivors decide without the coordinator — non-blocking. */
export function threePhase(votes: boolean[], fail: Fail): CommitResult {
  const steps = ['phase 1: coordinator asks all — canCommit?', `votes: ${votes.map((v) => (v ? '✓' : '✗')).join(' ')}`];
  if (votes.some((v) => !v)) { steps.push('a NO vote → ABORT'); return { protocol: '3pc', decision: 'abort', blocking: false, steps }; }
  steps.push('all YES → phase 2: coordinator sends PRE-COMMIT');
  if (fail === 'none') { steps.push('phase 3: coordinator sends DO-COMMIT → all COMMIT'); return { protocol: '3pc', decision: 'commit', blocking: false, steps }; }
  if (fail === 'afterVotes') {
    // crash before anyone pre-committed: survivors see no pre-commit anywhere → safe to ABORT, no blocking
    steps.push('⚠ coordinator crashes before PRE-COMMIT reaches anyone');
    steps.push('no participant is in PRE-COMMIT → termination protocol decides ABORT (non-blocking)');
    return { protocol: '3pc', decision: 'abort', blocking: false, steps };
  }
  // afterPrepare: at least one participant reached pre-commit → everyone voted yes → safe to COMMIT
  steps.push('⚠ coordinator crashes after PRE-COMMIT, before DO-COMMIT');
  steps.push('a participant is in PRE-COMMIT → all must have voted YES → termination protocol COMMITS (non-blocking)');
  return { protocol: '3pc', decision: 'commit', blocking: false, steps };
}
