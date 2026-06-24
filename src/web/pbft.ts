// PBFT — Practical Byzantine Fault Tolerance (Castro & Liskov, 1999). Paxos and Raft
// tolerate nodes that crash; PBFT tolerates nodes that LIE — Byzantine replicas that send
// conflicting messages to different peers. The price is replication: to survive f Byzantine
// faults you need n ≥ 3f+1 replicas and quorums of 2f+1. Why 3f+1? A quorum of 2f+1 might
// include all f liars, leaving f+1 honest; any two quorums overlap in at least f+1 nodes, so
// at least one HONEST node is in both — that shared honest witness prevents two conflicting
// values from both being committed. Agreement runs in three phases (pre-prepare, prepare,
// commit), each needing a 2f+1 quorum. Pure model of the quorum math + phase progression.

export interface Analysis {
  n: number;
  f: number;
  tolerant: boolean;       // n ≥ 3f+1
  quorum: number;          // 2f+1
  honest: number;          // n − f
  honestInQuorum: number;  // quorum − f (the honest floor inside any quorum)
  intersectionMin: number; // min overlap of two quorums = 2·quorum − n
  honestInIntersection: number; // intersectionMin − f
}

export function analyze(n: number, f: number): Analysis {
  const quorum = 2 * f + 1;
  const intersectionMin = Math.max(0, 2 * quorum - n);
  return {
    n, f,
    tolerant: n >= 3 * f + 1,
    quorum,
    honest: n - f,
    honestInQuorum: quorum - f,
    intersectionMin,
    honestInIntersection: intersectionMin - f,
  };
}

export interface Phase { name: string; needed: number; honestCanSend: number; reached: boolean }
export interface Run { phases: Phase[]; agreement: boolean; reason: string }

/** Simulate the three quorum phases: only honest replicas reliably send matching messages,
 *  so each 2f+1 quorum is reachable iff there are at least 2f+1 honest replicas (n ≥ 3f+1). */
export function simulate(n: number, f: number): Run {
  const a = analyze(n, f);
  const phaseNames = ['pre-prepare', 'prepare', 'commit'];
  const phases: Phase[] = phaseNames.map((name) => ({
    name,
    needed: name === 'pre-prepare' ? 1 : a.quorum, // pre-prepare is the primary alone
    honestCanSend: a.honest,
    reached: name === 'pre-prepare' ? a.honest >= 1 : a.honest >= a.quorum,
  }));
  const agreement = a.tolerant && phases.every((p) => p.reached);
  return {
    phases,
    agreement,
    reason: agreement
      ? `n=${n} ≥ 3f+1=${3 * f + 1}: every 2f+1 quorum has ${a.honest} honest replicas to draw on, and any two quorums share ≥${a.honestInIntersection} honest node — safe.`
      : `n=${n} < 3f+1=${3 * f + 1}: only ${a.honest} honest replicas, fewer than the ${a.quorum} a quorum needs — the f liars can block or split agreement.`,
  };
}
