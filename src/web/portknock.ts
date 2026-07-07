// Port knocking — a hidden service behind a firewall that drops everything, opened only by a secret SEQUENCE of
// connection attempts to closed ports (e.g. 7000 → 8000 → 9000, in order, from one source). A daemon watches the
// firewall's log; when it sees the exact sequence it briefly opens the real port (say SSH) for that IP. A port scan
// sees only closed ports, so there's nothing to attack — but it's obscurity, not authentication: anyone who can sniff
// the knocks can replay them (which is why fwknop/single-packet-authorization signs and encrypts the knock instead).

export type KnockState = { progress: number; opened: boolean };

// Process one knock. On a match, advance; when the whole sequence is done, the port opens. On a miss, reset — but a
// knock equal to the FIRST port starts a fresh attempt (so a stray knock doesn't permanently lock you out).
export function knock(state: KnockState, port: number, secret: number[]): KnockState {
  if (state.opened) return state;
  if (port === secret[state.progress]) {
    const progress = state.progress + 1;
    return { progress, opened: progress === secret.length };
  }
  return { progress: port === secret[0] ? 1 : 0, opened: false };
}

// Run a whole list of knocks from the closed state.
export function runKnocks(secret: number[], seq: number[]): KnockState {
  return seq.reduce((s, p) => knock(s, p, secret), { progress: 0, opened: false } as KnockState);
}
