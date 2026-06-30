// SWIM failure detection — how a cluster decides a node is dead without false alarms or O(N²) chatter.
// Each period a node directly pings one random peer. If that ping times out, it doesn't panic: it asks
// k OTHER peers to ping the target on its behalf (ping-req / INDIRECT probing), so a single bad link
// between two nodes can't trigger a false positive. Only if every probe fails is the target marked
// SUSPECT — not dead — and the suspicion is gossiped. The target, on hearing it's suspected, REFUTES
// with a higher incarnation number, instantly clearing it; a stale suspicion (lower incarnation) is
// ignored. A suspect that never refutes is declared DEAD after a timeout. Membership updates piggyback
// on the pings, so load stays O(1) per node regardless of cluster size.
// Reference: Das, Gupta & Motivala, "SWIM" (DSN 2002); Lifeguard refinements (Hashicorp/Uber 2018).

export type Status = 'alive' | 'suspect' | 'dead';
export interface Member { id: string; status: Status; incarnation: number }
export const initMember = (id: string): Member => ({ id, status: 'alive', incarnation: 0 });

export interface ProbeOutcome { member: Member; via: 'direct' | 'indirect' | null; suspected: boolean; note: string }

/** One full probe period against a target: a direct ping, then k indirect ping-reqs if it failed. */
export function probe(m: Member, directAck: boolean, indirectAcks: boolean[]): ProbeOutcome {
  if (m.status === 'dead') return { member: m, via: null, suspected: false, note: 'target already declared dead' };
  if (directAck) return { member: { ...m, status: 'alive' }, via: 'direct', suspected: false, note: 'direct ack — healthy' };
  if (indirectAcks.some(Boolean))
    return { member: { ...m, status: 'alive' }, via: 'indirect', suspected: false, note: 'direct ping failed but a ping-req got through — one bad link, NOT a failure' };
  return { member: { ...m, status: 'suspect' }, via: null, suspected: true, note: 'no direct or indirect ack → SUSPECT (gossiped; not yet dead)' };
}

/** The suspicion timer elapses with no refutation: suspect → dead. */
export const suspicionExpire = (m: Member): Member => (m.status === 'suspect' ? { ...m, status: 'dead' } : m);

/** The suspected node refutes with a fresh, higher incarnation — instantly clearing the suspicion.
 *  Death is terminal in SWIM (Confirm overrides everything), so a dead node can never be revived. */
export const refute = (m: Member, incarnation: number): Member =>
  m.status !== 'dead' && incarnation > m.incarnation ? { ...m, status: 'alive', incarnation } : m;

/** Apply a gossiped suspicion, but only if it isn't STALE (its incarnation must not predate a refute). */
export const applySuspect = (m: Member, incarnation: number): Member => {
  if (m.status === 'dead') return m;
  return incarnation >= m.incarnation ? { ...m, status: 'suspect' } : m; // stale → ignored
};
