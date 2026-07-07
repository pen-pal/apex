// Honeypot — a decoy with no legitimate use, so ANY interaction with it is malicious by definition. That gives it
// what a volume/threshold detector can't have: zero false positives. Contrast the two on the same traffic — a
// threshold IDS flags any source that makes enough connections (so a busy-but-benign host trips it), while the
// honeypot flags only sources that touch the decoy (which no legitimate host ever does). The honeypot's weakness is
// recall: a decoy that's too obviously fake gets fingerprinted and skipped. Modelled: both detectors + the trade-off.

export type Conn = { src: string; dst: string; attack?: boolean }; // one connection attempt; `attack` = ground truth

// Honeypot: every source that connects to the decoy host is flagged. Nothing legitimate should ever touch it.
export function honeypotDetect(conns: Conn[], decoy: string): string[] {
  return [...new Set(conns.filter((c) => c.dst === decoy).map((c) => c.src))];
}

// Threshold IDS: any source making >= t connection attempts (across all hosts) is flagged as scanning.
export function idsDetect(conns: Conn[], t: number): string[] {
  const count = new Map<string, number>();
  for (const c of conns) count.set(c.src, (count.get(c.src) ?? 0) + 1);
  return [...count].filter(([, n]) => n >= t).map(([s]) => s);
}

// Confusion matrix of an alert set against the ground-truth attack sources.
export function confusion(conns: Conn[], alerts: string[]): { tp: number; fp: number; fn: number } {
  const attackers = new Set(conns.filter((c) => c.attack).map((c) => c.src));
  const flagged = new Set(alerts);
  let tp = 0, fp = 0, fn = 0;
  for (const s of flagged) (attackers.has(s) ? tp++ : fp++);
  for (const s of attackers) if (!flagged.has(s)) fn++;
  return { tp, fp, fn };
}

// Does the attacker actually probe the decoy? A convincing decoy (realism >= the attacker's fingerprinting skill) is
// touched; one that's too obviously fake is recognised and skipped — so the honeypot never sees it.
export function attackerProbesDecoy(realism: number, skill: number): boolean {
  return realism >= skill;
}
