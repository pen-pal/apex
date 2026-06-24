// Single-decree Paxos (Lamport, "Paxos Made Simple"). A cluster of acceptors agrees on
// ONE value despite failures, using two phases. Phase 1 (Prepare/Promise): a proposer
// picks a ballot number n and asks acceptors to promise not to accept anything below n;
// each promise reports the highest-numbered value that acceptor has already accepted.
// Phase 2 (Accept/Accepted): with a majority of promises, the proposer must propose the
// highest already-accepted value it heard (or its own if none), and a value is CHOSEN
// once a majority accept it. The safety magic: any later, higher ballot is forced to
// re-propose the chosen value, because its promise-majority and the accept-majority must
// overlap. Pure model; the safety property is what the tests pin down.

export interface AcceptorSnap { id: number; promised: number; acceptedN: number | null; acceptedV: string | null }
export type Phase = 'prepare' | 'promise' | 'accept' | 'accepted' | 'decision' | 'fail';

export interface Step {
  proposer: string;
  n: number;
  phase: Phase;
  value?: string;
  text: string;
  responders?: number[]; // acceptor ids that answered positively
  acceptors: AcceptorSnap[];
  chosen: string | null;
}

export interface Proposal { proposer: string; n: number; preferred: string }

export interface PaxosRun { steps: Step[]; chosen: string | null }

export function runPaxos(acceptorCount: number, proposals: Proposal[]): PaxosRun {
  const acc = Array.from({ length: acceptorCount }, (_, id) => ({ id, promised: 0, acceptedN: null as number | null, acceptedV: null as string | null }));
  const majority = Math.floor(acceptorCount / 2) + 1;
  const steps: Step[] = [];
  let chosen: string | null = null;
  const snap = (): AcceptorSnap[] => acc.map((a) => ({ ...a }));

  for (const p of proposals) {
    // ── Phase 1: Prepare ──
    steps.push({ proposer: p.proposer, n: p.n, phase: 'prepare', text: `${p.proposer} broadcasts Prepare(${p.n})`, acceptors: snap(), chosen });
    const promises: { id: number; acceptedN: number | null; acceptedV: string | null }[] = [];
    for (const a of acc) {
      if (p.n > a.promised) { a.promised = p.n; promises.push({ id: a.id, acceptedN: a.acceptedN, acceptedV: a.acceptedV }); }
    }
    const promisers = promises.map((x) => x.id);
    steps.push({
      proposer: p.proposer, n: p.n, phase: 'promise', responders: promisers,
      text: promises.length >= majority
        ? `${promises.length}/${acceptorCount} promise — a majority (need ${majority})`
        : `only ${promises.length}/${acceptorCount} promise — no majority, ${p.proposer} stalls`,
      acceptors: snap(), chosen,
    });
    if (promises.length < majority) {
      steps.push({ proposer: p.proposer, n: p.n, phase: 'fail', text: `${p.proposer}'s ballot ${p.n} fails (a higher ballot already promised away the acceptors)`, acceptors: snap(), chosen });
      continue;
    }

    // ── choose the value: highest already-accepted value heard, else the proposer's own ──
    let value = p.preferred, adopted = false;
    let best = -1;
    for (const pr of promises) if (pr.acceptedN !== null && pr.acceptedN > best) { best = pr.acceptedN; value = pr.acceptedV!; adopted = true; }
    steps.push({
      proposer: p.proposer, n: p.n, phase: 'accept', value,
      text: adopted
        ? `must re-propose the highest accepted value it heard: "${value}" (ballot ${best}) — not its own "${p.preferred}"`
        : `no value accepted yet — free to propose its own "${value}". Sends Accept(${p.n}, "${value}")`,
      acceptors: snap(), chosen,
    });

    // ── Phase 2: Accept ──
    const accepters: number[] = [];
    for (const a of acc) {
      if (p.n >= a.promised) { a.promised = p.n; a.acceptedN = p.n; a.acceptedV = value; accepters.push(a.id); }
    }
    const accepted = accepters.length >= majority;
    if (accepted) chosen = value;
    steps.push({
      proposer: p.proposer, n: p.n, phase: 'accepted', value, responders: accepters,
      text: accepted ? `${accepters.length}/${acceptorCount} accept — value "${value}" is CHOSEN` : `only ${accepters.length}/${acceptorCount} accept — not chosen yet`,
      acceptors: snap(), chosen,
    });
    if (accepted) steps.push({ proposer: p.proposer, n: p.n, phase: 'decision', value, text: `Consensus: "${value}" is decided and can never change`, acceptors: snap(), chosen });
  }

  return { steps, chosen };
}
