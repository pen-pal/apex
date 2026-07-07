// IDS/IPS — intrusion detection two ways, and the tradeoff between them. A SIGNATURE detector matches traffic
// against a database of known-attack patterns: precise on known attacks, blind to anything novel (no signature yet).
// An ANOMALY detector learns a baseline of "normal" and flags deviations: it can catch never-seen attacks, but it
// false-alarms on unusual-but-benign traffic and can miss a low-and-slow attack that stays under the threshold.
// (An IPS is the same detection sitting inline, blocking instead of just alerting.)

export type Kind = 'normal' | 'known' | 'novel';
export type Event = { id: string; kind: Kind; desc: string; anomaly: number }; // anomaly score 0..1

export const isAttack = (e: Event): boolean => e.kind !== 'normal';

// Signature detection fires only on KNOWN attacks — the ones with an entry in the signature DB.
export const signatureFlags = (e: Event): boolean => e.kind === 'known';

// Anomaly detection fires on anything scoring at or above the baseline threshold.
export const anomalyFlags = (e: Event, threshold: number): boolean => e.anomaly >= threshold;

export type Outcome = 'true-positive' | 'false-negative' | 'false-positive' | 'true-negative';
export function outcome(flagged: boolean, attack: boolean): Outcome {
  if (flagged) return attack ? 'true-positive' : 'false-positive';
  return attack ? 'false-negative' : 'true-negative';
}
