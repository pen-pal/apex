// Onion (hidden) services — a server reachable by its .onion address with NO public IP, so neither side learns the
// other's location. The .onion address IS the service's public key (self-authenticating). Connection uses a
// rendezvous protocol: the service publishes a signed descriptor (its intro points) to the DHT; a client fetches it,
// picks a rendezvous relay, and asks — via an introduction point — the service to meet there; both build Tor circuits
// to the rendezvous, which only ever sees two circuits, never two IPs. Modelled: the mutual-anonymity property, and
// what an adversary who compromises a set of relays actually learns.

export type RelayRole = { role: string; side?: 'client' | 'service' | 'shared'; seesClientIp: boolean; seesServiceIp: boolean };

// The relays on the two 3-hop Tor circuits that meet at the rendezvous point. Only the GUARD nearest each end sees
// that end's IP; every interior relay (middles, rendezvous, intro point) sees only circuit traffic, never an endpoint.
export const TOPOLOGY: RelayRole[] = [
  { role: "client's guard", side: 'client', seesClientIp: true, seesServiceIp: false },
  { role: "client's middle", side: 'client', seesClientIp: false, seesServiceIp: false },
  { role: 'rendezvous point', side: 'shared', seesClientIp: false, seesServiceIp: false },
  { role: "service's middle", side: 'service', seesClientIp: false, seesServiceIp: false },
  { role: "service's guard", side: 'service', seesClientIp: false, seesServiceIp: true },
  { role: 'introduction point', side: 'service', seesClientIp: false, seesServiceIp: false },
];

// Who learns what in a fully-built onion-service connection (each side reaches the rendezvous over its own circuit).
export function rendezvousKnowledge(): RelayRole[] {
  return TOPOLOGY;
}

// Mutual anonymity: no single relay sees BOTH the client's and the service's IP.
export function mutuallyAnonymous(k: RelayRole[]): boolean {
  return !k.some((r) => r.seesClientIp && r.seesServiceIp);
}

export type Adversary = { seesClientIp: boolean; seesServiceIp: boolean; canDeanonymize: boolean };

// What an adversary who has compromised a SET of relays learns. A single relay never sees both ends, so deanonymizing
// requires collecting the client's IP from one controlled relay AND the service's IP from another — in practice, both
// guards (the guard-discovery / end-to-end correlation attack). Controlling only interior relays reveals nothing.
export function adversaryView(controlled: RelayRole[]): Adversary {
  const seesClientIp = controlled.some((r) => r.seesClientIp);
  const seesServiceIp = controlled.some((r) => r.seesServiceIp);
  return { seesClientIp, seesServiceIp, canDeanonymize: seesClientIp && seesServiceIp };
}

// The .onion address is self-authenticating: it's derived from the service's public key, so a client can verify the
// descriptor's signature against the address itself — no certificate authority needed.
export function selfAuthenticates(onionAddrIsPubkey: boolean, descriptorSignedByKey: boolean): boolean {
  return onionAddrIsPubkey && descriptorSignedByKey;
}
