// SCTP (RFC 9260, formerly RFC 4960) — the transport that survives a dead network path. A TCP connection is welded to
// one (source IP, dest IP) pair: if that path fails, the connection dies. An SCTP *association* binds
// MULTIPLE addresses on each endpoint (multi-homing); it sends on a primary path, probes every path
// with HEARTBEAT chunks, and on repeated failures marks a path INACTIVE and FAILS OVER to an alternate
// — the association lives on. It also opens with a 4-way COOKIE handshake so the server allocates no
// state until the client proves return-routability, making it immune to SYN-flood-style attacks.
// Two honest models here: the multi-homing failover state machine (RFC 9260 §8) and the cookie
// handshake sequence (§5.1). Tested against the RFC's error-counter rules.

// ---- Multi-homing & path failover (RFC 9260 §8.1–8.3) ------------------------------------------

export interface PathState { id: string; addr: string; errors: number; active: boolean }

export interface SctpConfig {
  paths: { id: string; addr: string }[]; // configured destinations; the first is the initial primary
  pathMaxRetrans: number; // RFC default 5: a path goes INACTIVE once its error count EXCEEDS this
  assocMaxRetrans: number; // RFC default 10: the association fails once total errors EXCEED this
}

export type SctpEvent =
  | { type: 'timeout'; path: string } // a HEARTBEAT/data retransmission timed out on this path
  | { type: 'ack'; path: string }; //    a HEARTBEAT-ACK / data ACK arrived on this path

export interface SctpStep {
  n: number;
  event: string;
  desc: string;
  current: string | null; // the destination currently in use (primary if active, else first active alternate)
  states: PathState[];
  assocErrors: number;
  assoc: 'ESTABLISHED' | 'DOWN';
  failedOver: boolean; // did the current path change as a result of this event?
}

export interface SctpRun {
  steps: SctpStep[];
  finalAssoc: 'ESTABLISHED' | 'DOWN';
  failovers: number; // number of times the active path changed
  endPath: string | null;
}

/** The destination in use: the primary if active, otherwise the first active alternate (primary-preferred). */
function pick(states: PathState[]): string | null {
  const a = states.find((p) => p.active);
  return a ? a.id : null;
}

export function runAssoc(cfg: SctpConfig, events: SctpEvent[]): SctpRun {
  const states: PathState[] = cfg.paths.map((p) => ({ id: p.id, addr: p.addr, errors: 0, active: true }));
  let assocErrors = 0;
  let assoc: 'ESTABLISHED' | 'DOWN' = 'ESTABLISHED';
  let current = pick(states);
  const steps: SctpStep[] = [];
  let failovers = 0;

  const snap = (event: string, desc: string, failedOver: boolean) =>
    steps.push({ n: steps.length + 1, event, desc, current, states: states.map((s) => ({ ...s })), assocErrors, assoc, failedOver });

  for (const e of events) {
    const p = states.find((s) => s.id === e.path);
    if (!p || assoc === 'DOWN') { snap(e.type, `(ignored — ${assoc === 'DOWN' ? 'association is down' : 'unknown path'})`, false); continue; }
    const before = current;

    if (e.type === 'timeout') {
      p.errors += 1;
      assocErrors += 1;
      // RFC 9260 §8.1: association fails once the overall counter EXCEEDS Association.Max.Retrans
      if (assocErrors > cfg.assocMaxRetrans) {
        assoc = 'DOWN';
        states.forEach((s) => (s.active = false));
        current = null;
        snap('timeout', `Timeout on ${p.id}: total errors ${assocErrors} > Association.Max.Retrans (${cfg.assocMaxRetrans}) — peer unreachable, association DOWN`, before !== current);
        continue;
      }
      // RFC 9260 §8.2/8.3: a path goes INACTIVE once its counter EXCEEDS Path.Max.Retrans
      let desc = `Timeout on ${p.id}: path errors ${p.errors}/${cfg.pathMaxRetrans}, assoc errors ${assocErrors}/${cfg.assocMaxRetrans}`;
      if (p.errors > cfg.pathMaxRetrans && p.active) {
        p.active = false;
        desc = `Timeout on ${p.id}: errors ${p.errors} > Path.Max.Retrans (${cfg.pathMaxRetrans}) — ${p.id} marked INACTIVE`;
      }
      current = pick(states);
      const fo = before !== current && current !== null;
      if (fo) { failovers += 1; desc += ` → FAILOVER to ${current}`; }
      snap('timeout', desc, fo);
    } else {
      // a successful ack clears that path's error counter and the association counter (RFC 9260 §8.1, §8.3)
      const wasInactive = !p.active;
      p.errors = 0;
      p.active = true;
      assocErrors = 0;
      current = pick(states);
      const fo = before !== current;
      if (fo) failovers += 1;
      const desc = wasInactive
        ? `ACK on ${p.id}: error counter cleared, ${p.id} back ACTIVE${fo ? ` → failback to ${current}` : ''}`
        : `ACK on ${p.id}: error counters reset (path healthy)`;
      snap('ack', desc, fo);
    }
  }

  return { steps, finalAssoc: assoc, failovers, endPath: current };
}

// ---- 4-way cookie handshake (RFC 9260 §5.1) ---------------------------------------------------

export interface SctpChunk { n: number; from: 'client' | 'server'; chunk: string; carries: string; note: string }

/** The association setup handshake. Unlike TCP's 3-way SYN, the server keeps NO state until the
 *  client echoes the signed cookie back — so a flood of INITs costs the server nothing. */
export function handshake(): SctpChunk[] {
  return [
    { n: 1, from: 'client', chunk: 'INIT', carries: 'Initiate Tag, a_rwnd, # outbound streams, list of the client’s IP addresses',
      note: 'The client proposes the association and advertises ALL of its addresses (multi-homing is negotiated up front).' },
    { n: 2, from: 'server', chunk: 'INIT-ACK', carries: 'Initiate Tag + a State Cookie (signed TCB: a MAC over all the state needed to set up the association)',
      note: 'The server allocates NO memory yet. It packs everything it would need into a self-authenticating cookie and sends it back — nothing to exhaust under a flood.' },
    { n: 3, from: 'client', chunk: 'COOKIE-ECHO', carries: 'the State Cookie, echoed back verbatim (may already piggyback DATA)',
      note: 'The client returns the cookie, proving it can receive at its claimed address (return-routability).' },
    { n: 4, from: 'server', chunk: 'COOKIE-ACK', carries: '(confirmation)',
      note: 'The server verifies the cookie’s MAC with its own secret, NOW builds the TCB, and the association is ESTABLISHED. State was created only after the client proved itself.' },
  ];
}
