// Feature flags — decoupling DEPLOY (the code is on the servers) from RELEASE (the feature is on for a
// user). Ship the code dark, then turn it on independently: for an internal cohort, then a 5% canary,
// then everyone — and flip it off instantly (a kill switch) if it misbehaves, no redeploy. Evaluation
// is a fixed precedence: a disabled flag is off for everyone; otherwise targeting RULES match first
// (e.g. country = US, or plan = beta); otherwise a PERCENTAGE rollout decides, bucketed by a stable hash
// of (flag, user) so a given user is consistently in or out — and increasing the percentage only ever
// ADDS users, never flips someone back off. Reference: the practice behind LaunchDarkly / Flagger /
// Unleash; Humble & Farley on decoupling deploy from release.

export interface Rule { attribute: string; value: string; result: boolean }
export interface Flag { key: string; enabled: boolean; rules: Rule[]; rolloutPercent: number }
export type User = Record<string, string>; // must include an `id`
export interface Evaluation { on: boolean; reason: string; bucket: number }

/** Stable 0–99 bucket for a (flag, user) pair (FNV-1a) — same inputs always land in the same bucket. */
export function bucketOf(flagKey: string, userId: string): number {
  let h = 0x811c9dc5 >>> 0;
  const s = `${flagKey}:${userId}`;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h % 100;
}

/** Evaluate a flag for a user, returning the decision and WHY (kill switch → rule → rollout). */
export function evaluate(flag: Flag, user: User): Evaluation {
  const bucket = bucketOf(flag.key, user.id ?? '');
  if (!flag.enabled) return { on: false, reason: 'flag disabled (kill switch) — off for everyone', bucket };
  for (const r of flag.rules) {
    if (user[r.attribute] === r.value) return { on: r.result, reason: `targeting rule: ${r.attribute} = ${r.value} → ${r.result ? 'on' : 'off'}`, bucket };
  }
  if (bucket < flag.rolloutPercent) return { on: true, reason: `in the ${flag.rolloutPercent}% rollout (bucket ${bucket} < ${flag.rolloutPercent})`, bucket };
  return { on: false, reason: `outside the rollout (bucket ${bucket} ≥ ${flag.rolloutPercent})`, bucket };
}
