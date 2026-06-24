// NAT traversal — how two peers behind NATs (e.g. a WebRTC call) find a path to each
// other. ICE gathers CANDIDATES for each peer: HOST (its LAN ip:port), SERVER-REFLEXIVE
// (its public ip:port, discovered by asking a STUN server "what address do you see?"),
// and RELAY (a TURN-server allocation that forwards traffic). The peers exchange
// candidate lists and run CONNECTIVITY CHECKS on pairs, preferring direct paths:
//   host↔host    — works only if both peers are on the same LAN.
//   srflx↔srflx  — direct hole-punching via STUN; works if BOTH NATs are cone-type,
//                  but FAILS if either is symmetric (it picks a new public port per
//                  destination, so the address the peer was told is already wrong).
//   relay (TURN) — always works, but every packet detours through the relay.
// ICE picks the highest-priority pair that works. Pure, deterministic model. Tested.

export type NatType = 'open' | 'cone' | 'symmetric';
export type CandType = 'host' | 'srflx' | 'relay';

export interface Peer { name: string; nat: NatType; lan: string; sameLanAs?: string }
export interface Candidate { type: CandType; priority: number; addr: string }

const PRIORITY: Record<CandType, number> = { host: 126, srflx: 100, relay: 0 };

/** Gather this peer's ICE candidates (host always; srflx unless open; relay always). */
export function gather(peer: Peer): Candidate[] {
  const out: Candidate[] = [{ type: 'host', priority: PRIORITY.host, addr: `${peer.lan} (LAN)` }];
  if (peer.nat !== 'open') out.push({ type: 'srflx', priority: PRIORITY.srflx, addr: `public:${peer.name} (via STUN)` });
  out.push({ type: 'relay', priority: PRIORITY.relay, addr: `TURN/${peer.name}` });
  return out.sort((a, b) => b.priority - a.priority);
}

/** Does a candidate pair of the given type actually connect, for these two peers? */
export function pairWorks(type: CandType, a: Peer, b: Peer): boolean {
  if (type === 'host') return a.lan === b.lan || a.sameLanAs === b.name || b.sameLanAs === a.name;
  if (type === 'srflx') {
    // direct hole-punching needs predictable public ports → both NATs must be cone
    // (open peers have a public address directly, which also works).
    const ok = (n: NatType) => n === 'cone' || n === 'open';
    return ok(a.nat) && ok(b.nat);
  }
  return true; // relay (TURN) always works
}

export interface CheckStep { type: CandType; works: boolean; reason: string }
export interface IceResult {
  candidatesA: Candidate[];
  candidatesB: Candidate[];
  checks: CheckStep[];
  selected: CandType | null; // the chosen pair type (null = no connection possible)
  relayed: boolean; // did we fall back to a TURN relay?
}

/** Run ICE between two peers: gather, then check pairs in priority order, pick the first that works. */
export function negotiate(a: Peer, b: Peer): IceResult {
  const order: CandType[] = ['host', 'srflx', 'relay'];
  const checks: CheckStep[] = [];
  let selected: CandType | null = null;
  for (const type of order) {
    const works = pairWorks(type, a, b);
    checks.push({ type, works, reason: reasonFor(type, works, a, b) });
    if (works && selected === null) selected = type;
  }
  return {
    candidatesA: gather(a),
    candidatesB: gather(b),
    checks,
    selected,
    relayed: selected === 'relay',
  };
}

function reasonFor(type: CandType, works: boolean, a: Peer, b: Peer): string {
  if (type === 'host') return works ? 'both peers share a LAN — connect directly' : 'peers are on different networks';
  if (type === 'srflx') {
    if (works) return 'both NATs are cone-type → STUN hole-punching succeeds (direct, no relay)';
    const culprit = a.nat === 'symmetric' ? a.name : b.name;
    return `${culprit} is behind a SYMMETRIC NAT — its public port changes per destination, so hole-punching fails`;
  }
  return 'TURN relay forwards the media — always works, but adds a hop';
}
