// SIEM log correlation — how a security monitor catches an attack that no single log line reveals. A SIEM ingests
// events from many sources and runs CORRELATION RULES over a sliding time window. The canonical rule is brute-force
// detection: K or more failed logins from the SAME source within W seconds is an attack in progress; a success
// right after is a likely compromise. Detection is a tuning trade-off — too loose misses the attack (false
// negative), too tight fires on benign bursts (false positives). Modelled: the windowed count and its verdict.

export type Kind = 'fail' | 'ok';
export type Event = { t: number; src: string; kind: Kind; attack?: boolean }; // `attack` = ground-truth label

export type Rule = { k: number; window: number }; // K failures within `window` seconds, per source

export type Alert = { src: string; at: number; fails: number; compromised: boolean };

// Run the correlation rule: for each source, slide over its events; whenever K failures fall inside a `window`, raise
// one alert (marked compromised if an 'ok' from that source follows within the same window). Returns one alert per
// distinct brute-force burst (a source is not re-alerted until its window of failures clears).
export function correlate(events: Event[], rule: Rule): Alert[] {
  const bySrc = new Map<string, Event[]>();
  for (const e of [...events].sort((a, b) => a.t - b.t)) {
    (bySrc.get(e.src) ?? bySrc.set(e.src, []).get(e.src)!).push(e);
  }
  const alerts: Alert[] = [];
  for (const [src, evs] of bySrc) {
    const fails = evs.filter((e) => e.kind === 'fail');
    let i = 0, firedUntil = -Infinity;
    for (let j = 0; j < fails.length; j++) {
      while (fails[j].t - fails[i].t > rule.window) i++; // shrink window [i..j] to <= `window`
      const count = j - i + 1;
      if (count >= rule.k && fails[i].t > firedUntil) {
        const at = fails[j].t;
        const compromised = evs.some((e) => e.kind === 'ok' && e.t >= fails[i].t && e.t <= at + rule.window);
        alerts.push({ src, at, fails: count, compromised });
        firedUntil = at; // don't re-alert on the same burst
      }
    }
  }
  return alerts.sort((a, b) => a.at - b.at);
}

// Score a rule against the ground-truth labels: an attack source is any src that emitted a labelled-attack event.
// A true positive is an alert on such a source; a false positive is an alert on a benign source; a false negative is
// an attack source that produced no alert.
export function score(events: Event[], rule: Rule): { detected: boolean; truePos: number; falsePos: number; falseNeg: number } {
  const attackSrcs = new Set(events.filter((e) => e.attack).map((e) => e.src));
  const alerts = correlate(events, rule);
  const alertedSrcs = new Set(alerts.map((a) => a.src));
  let falsePos = 0;
  for (const s of alertedSrcs) if (!attackSrcs.has(s)) falsePos++;
  let truePos = 0;
  for (const s of alertedSrcs) if (attackSrcs.has(s)) truePos++;
  let falseNeg = 0;
  for (const s of attackSrcs) if (!alertedSrcs.has(s)) falseNeg++;
  return { detected: falseNeg === 0 && attackSrcs.size > 0, truePos, falsePos, falseNeg };
}
