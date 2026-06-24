// TCP connection setup and teardown (RFC 9293). The most-drawn diagram in networking,
// made exact. Each side picks an Initial Sequence Number; SYN and FIN each consume one
// sequence number, and an ACK always carries (other side's seq + bytes/flags consumed).
// Both endpoints walk the TCP state machine: CLOSED → SYN_SENT/SYN_RCVD → ESTABLISHED
// for the 3-way open, then FIN_WAIT_1/2, CLOSE_WAIT, LAST_ACK, TIME_WAIT for the close.
// Pure model; the seq/ack relationships and the state path are tested against the RFC.

export type Flag = 'SYN' | 'ACK' | 'FIN';
export type Dir = 'c2s' | 's2c';

export interface Segment {
  step: number;
  dir: Dir;
  flags: Flag[];
  seq: number;
  ack?: number;
  clientState: string; // state AFTER this segment is processed
  serverState: string;
  note: string;
}

/** Full open-then-close exchange given each side's Initial Sequence Number. */
export function handshake(c: number, s: number): Segment[] {
  const segs: Segment[] = [];
  let step = 0;
  const push = (dir: Dir, flags: Flag[], seq: number, ack: number | undefined, clientState: string, serverState: string, note: string) =>
    segs.push({ step: step++, dir, flags, seq, ack, clientState, serverState, note });

  // ── three-way handshake ──
  push('c2s', ['SYN'], c, undefined, 'SYN_SENT', 'LISTEN', 'client opens: SYN, my ISN = c');
  push('s2c', ['SYN', 'ACK'], s, c + 1, 'SYN_SENT', 'SYN_RCVD', 'server: my ISN = s, and I ack c+1');
  push('c2s', ['ACK'], c + 1, s + 1, 'ESTABLISHED', 'ESTABLISHED', 'client acks s+1 — both sides open');
  // ── active close by the client (FIN consumes one sequence number) ──
  push('c2s', ['FIN', 'ACK'], c + 1, s + 1, 'FIN_WAIT_1', 'ESTABLISHED', 'client done sending: FIN');
  push('s2c', ['ACK'], s + 1, c + 2, 'FIN_WAIT_2', 'CLOSE_WAIT', 'server acks the FIN (may still send)');
  push('s2c', ['FIN', 'ACK'], s + 1, c + 2, 'FIN_WAIT_2', 'LAST_ACK', 'server done too: its own FIN');
  push('c2s', ['ACK'], c + 2, s + 2, 'TIME_WAIT', 'CLOSED', 'client acks; waits 2·MSL, then CLOSED');
  return segs;
}

/** The ordered set of distinct states each side passes through (for the FSM view). */
export function statePath(segs: Segment[], side: 'client' | 'server'): string[] {
  const key = side === 'client' ? 'clientState' : 'serverState';
  const start = side === 'client' ? 'CLOSED' : 'CLOSED';
  const path = [start];
  for (const s of segs) {
    const st = s[key as 'clientState' | 'serverState'];
    if (st !== path[path.length - 1]) path.push(st);
  }
  if (path[path.length - 1] !== 'CLOSED') path.push('CLOSED'); // TIME_WAIT → CLOSED
  return path;
}
