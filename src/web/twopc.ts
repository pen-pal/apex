// Two-phase commit (2PC) — how a coordinator makes several databases commit a
// transaction atomically (all or nothing). PHASE 1 (prepare/voting): the coordinator
// asks every participant to PREPARE; each votes YES (durably prepared, holding its
// locks) or NO. PHASE 2 (decision): if EVERY vote is YES the coordinator decides
// COMMIT and tells everyone; if any voted NO it decides ABORT. Every participant must
// obey the decision. The fatal flaw: if the coordinator crashes AFTER participants
// prepared but BEFORE broadcasting the decision, those participants are IN-DOUBT —
// stuck holding locks, unable to commit or abort on their own (2PC is blocking).
// Pure, deterministic model. Tested.

export type Phase = 'idle' | 'preparing' | 'committing' | 'aborting' | 'done' | 'blocked';
export type PState = 'working' | 'prepared' | 'committed' | 'aborted' | 'in-doubt';
export type Vote = 'yes' | 'no';

export interface Participant { id: number; vote: Vote; state: PState }
export interface TwoPC {
  phase: Phase;
  participants: Participant[];
  decision: 'commit' | 'abort' | null;
  coordinatorAlive: boolean;
}

/** `votes[i]` is how participant i will vote when asked to prepare. */
export function init2pc(votes: Vote[]): TwoPC {
  return {
    phase: 'idle',
    participants: votes.map((v, id) => ({ id, vote: v, state: 'working' })),
    decision: null,
    coordinatorAlive: true,
  };
}

/** PHASE 1: the coordinator sends PREPARE; each participant votes and moves state. */
export function prepare(s: TwoPC): TwoPC {
  const participants = s.participants.map((p) => ({ ...p, state: (p.vote === 'yes' ? 'prepared' : 'aborted') as PState }));
  return { ...s, phase: 'preparing', participants };
}

/** Decide based on the collected votes: unanimous YES → commit, otherwise abort. */
export function decide(s: TwoPC): TwoPC {
  const allYes = s.participants.every((p) => p.vote === 'yes');
  return { ...s, decision: allYes ? 'commit' : 'abort', phase: allYes ? 'committing' : 'aborting' };
}

/** PHASE 2: deliver the decision; participants apply it and release locks. */
export function applyDecision(s: TwoPC): TwoPC {
  if (s.decision === null) return s;
  const participants = s.participants.map((p) => {
    if (s.decision === 'commit') return { ...p, state: 'committed' as PState };
    return { ...p, state: 'aborted' as PState }; // a NO voter is already aborted; others abort too
  });
  return { ...s, phase: 'done', participants };
}

/**
 * The coordinator crashes. Participants that had voted YES and prepared but never
 * heard the decision are now IN-DOUBT — blocked, holding locks. (If the decision
 * had already been delivered, they keep it; a NO voter already aborted unilaterally.)
 */
export function crashCoordinator(s: TwoPC): TwoPC {
  if (s.phase === 'done') return { ...s, coordinatorAlive: false }; // decision already out
  const participants = s.participants.map((p) => (p.state === 'prepared' ? { ...p, state: 'in-doubt' as PState } : p));
  return { ...s, coordinatorAlive: false, phase: 'blocked', participants };
}

/** Did the transaction reach a clean atomic outcome (all committed or all aborted)? */
export function outcome(s: TwoPC): 'committed' | 'aborted' | 'blocked' | 'pending' {
  if (s.participants.some((p) => p.state === 'in-doubt')) return 'blocked';
  if (s.phase !== 'done') return 'pending';
  return s.decision === 'commit' ? 'committed' : 'aborted';
}
