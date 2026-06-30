// BGP route reflectors — how iBGP scales past a few routers. The iBGP rule is that a router must NOT
// re-advertise a route learned from one iBGP peer to another iBGP peer (to prevent loops, since iBGP has
// no AS-path to detect them). The naive fix is a FULL MESH: every iBGP router peers with every other, so
// n routers need n(n−1)/2 sessions — 100 routers = 4,950 sessions, unmanageable. A route reflector is
// allowed to break that rule in a controlled way: its CLIENT routers peer only with it, and it REFLECTS
// routes between them, collapsing the mesh to a hub-and-spoke. The reflection rules keep it loop-free: a
// route from a client is reflected to all other clients AND to non-client iBGP peers; a route from a
// non-client (or eBGP) is reflected only to clients; and an ORIGINATOR_ID + CLUSTER_LIST stamp let a
// reflector drop a route that has already passed through its cluster. Reference: RFC 4456.

/** Sessions in a full iBGP mesh of n routers — the O(n²) that route reflectors avoid. */
export const fullMeshSessions = (n: number) => (n * (n - 1)) / 2;

export type PeerKind = 'client' | 'nonclient' | 'ebgp';
export interface Peer { id: string; kind: PeerKind }

/** Sessions with a single route reflector: each client peers only with the RR; non-clients form their
 *  own full mesh with the RR (and each other). */
export function rrSessions(clients: number, nonClients: number): number {
  const rrAndNonClients = nonClients + 1;             // the RR plus the regular iBGP routers…
  return clients + fullMeshSessions(rrAndNonClients); // …form a small full mesh; clients are spokes
}

/** Where does a route learned from a peer of `sourceKind` get reflected? (RFC 4456 §3.) */
export function reflect(sourceKind: PeerKind, peers: Peer[], sourceId: string): string[] {
  const others = peers.filter((p) => p.id !== sourceId);
  if (sourceKind === 'ebgp') return others.map((p) => p.id);                       // eBGP → everyone
  if (sourceKind === 'client') return others.map((p) => p.id);                     // client → other clients + non-clients
  // from a non-client iBGP peer → reflect ONLY to clients (non-clients already have it via their mesh)
  return others.filter((p) => p.kind === 'client').map((p) => p.id);
}
