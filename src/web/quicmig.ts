// QUIC connection migration — why a QUIC download survives you walking out of wifi onto cellular, while a
// TCP one dies. The root difference is HOW the receiver finds the connection an arriving packet belongs to.
// TCP demuxes on the 4-tuple (src IP, src port, dst IP, dst port); change your IP and the tuple no longer
// matches any socket — the connection is gone, and you pay a full reconnect (TCP + TLS handshake + slow
// start). QUIC puts an explicit CONNECTION ID in every packet header, independent of addresses, so the same
// connection is recognized from a brand-new IP. To stop an attacker from redirecting a flow by spoofing a
// source address, the server first PATH-VALIDATES the new address (PATH_CHALLENGE → PATH_RESPONSE) and is
// anti-amplification-limited until it does. The client can also rotate to a fresh connection ID per path so
// observers can't link the two networks to one user. Reference: RFC 9000 §9 (Connection Migration).

export type Proto = 'tcp' | 'quic';
export interface Endpoint { ip: string; port: number }

/** The key the receiver uses to find the connection for an incoming packet. */
export function demuxKey(proto: Proto, client: Endpoint, server: Endpoint, connId: string): string {
  return proto === 'tcp'
    ? `${client.ip}:${client.port}->${server.ip}:${server.port}` // 4-tuple
    : `cid:${connId}`;                                            // connection ID, address-independent
}

export interface Recovery { rtts: number; reconnect: boolean; resetCwnd: boolean; steps: string[] }
export interface MigrateResult {
  proto: Proto; oldKey: string; newKey: string; matched: boolean; survives: boolean; recovery: Recovery;
}

/** A client's network changes (new IP/port). Does the existing connection survive, and at what cost? */
export function migrate(proto: Proto, oldClient: Endpoint, newClient: Endpoint, server: Endpoint, connId: string): MigrateResult {
  const oldKey = demuxKey(proto, oldClient, server, connId);
  const newKey = demuxKey(proto, newClient, server, connId);
  const matched = oldKey === newKey;

  const recovery: Recovery = matched
    ? {
        // QUIC: same connection ID → recognized. Validate the new path, then keep going. Congestion control
        // resets to be cautious on the unknown path, but there is NO handshake and data need not stop.
        rtts: 1, reconnect: false, resetCwnd: true,
        steps: [
          'client sends app packets with the SAME connection ID from the new address',
          'server recognizes the connection ID, but the source address is new',
          'server → PATH_CHALLENGE (random token) to the new address (anti-amplification limited until validated)',
          'client → PATH_RESPONSE (echoes the token), proving it owns the new path',
          'server validates the path and migrates; resets the congestion controller for the new link',
        ],
      }
    : {
        // TCP: the 4-tuple changed → no matching socket → the connection is dead. Full reconnect.
        rtts: 2, reconnect: true, resetCwnd: true,
        steps: [
          'packet arrives with a new 4-tuple → no matching socket → RST / silently dropped',
          'application must open a NEW connection',
          'TCP handshake (SYN / SYN-ACK / ACK) — 1 RTT',
          'TLS 1.3 handshake — 1 RTT',
          'congestion window resets to the initial window — slow start from scratch',
        ],
      };

  return { proto, oldKey, newKey, matched, survives: matched, recovery };
}
