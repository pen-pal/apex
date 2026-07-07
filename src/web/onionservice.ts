// Onion (hidden) services — a server reachable by its .onion address with NO public IP, so neither side learns the
// other's location. The .onion address IS the service's public key (self-authenticating). Connection uses a
// rendezvous protocol: the service publishes a signed descriptor (its intro points) to the DHT; a client fetches it,
// picks a rendezvous relay, and asks — via an introduction point — the service to meet there; both build Tor circuits
// to the rendezvous, which only ever sees two circuits, never two IPs. Modelled: the mutual-anonymity property.

export type RelayRole = { role: string; seesClientIp: boolean; seesServiceIp: boolean };

// Who learns what in a fully-built onion-service connection (each side reaches the rendezvous over its own 3-hop circuit).
export function rendezvousKnowledge(): RelayRole[] {
  return [
    { role: 'introduction point', seesClientIp: false, seesServiceIp: false }, // carries only the "meet me" signal
    { role: 'rendezvous point', seesClientIp: false, seesServiceIp: false },    // splices two circuits; sees neither IP
    { role: "client's guard", seesClientIp: true, seesServiceIp: false },
    { role: "service's guard", seesClientIp: false, seesServiceIp: true },
  ];
}

// Mutual anonymity: no single relay sees BOTH the client's and the service's IP.
export function mutuallyAnonymous(k: RelayRole[]): boolean {
  return !k.some((r) => r.seesClientIp && r.seesServiceIp);
}

// The .onion address is self-authenticating: it's derived from the service's public key, so a client can verify the
// descriptor's signature against the address itself — no certificate authority needed.
export function selfAuthenticates(onionAddrIsPubkey: boolean, descriptorSignedByKey: boolean): boolean {
  return onionAddrIsPubkey && descriptorSignedByKey;
}
