// WireGuard's cryptokey routing. A WireGuard peer is a Curve25519 public key plus a list of AllowedIPs, and that one
// list does two jobs at once: OUTBOUND it is the route (a destination IP is sent, encrypted, to whichever peer's
// AllowedIPs covers it — longest prefix wins), and INBOUND it is the ACL (a packet decrypted with a peer's key is only
// accepted if its source IP is inside that peer's AllowedIPs, so a peer can't spoof addresses that belong to another).
// One list, cryptographically bound to a key, replaces the routing table and firewall of a traditional VPN. The
// handshake and ciphers (Noise IK over Curve25519, ChaCha20-Poly1305) are real WireGuard but out of scope here; this
// models the routing/ACL decision, which is the part that trips people up.

export interface Peer { name: string; pubkey: string; allowedIps: string[] }

const ipToInt = (ip: string): number =>
  ip.split('.').reduce((acc, oct) => (acc * 256 + (parseInt(oct, 10) & 0xff)) >>> 0, 0) >>> 0;

// Does `ip` fall inside CIDR `base/len`?  len 0 matches everything (a full-tunnel 0.0.0.0/0 peer).
export function inCidr(ip: string, cidr: string): boolean {
  const [base, lenStr] = cidr.split('/');
  const len = parseInt(lenStr, 10);
  const mask = len === 0 ? 0 : (0xffffffff << (32 - len)) >>> 0;
  return ((ipToInt(ip) & mask) >>> 0) === ((ipToInt(base) & mask) >>> 0);
}

const prefixLen = (cidr: string): number => parseInt(cidr.split('/')[1], 10);

export interface Route { peer: Peer; cidr: string }

// Outbound: pick the peer whose AllowedIPs contains the destination by the LONGEST (most specific) prefix. null = no
// peer covers it, so WireGuard drops the packet (unlike a default route, there is nowhere to send it).
export function routeOutbound(peers: Peer[], destIp: string): Route | null {
  let best: Route | null = null;
  for (const peer of peers) {
    for (const cidr of peer.allowedIps) {
      if (inCidr(destIp, cidr) && (best === null || prefixLen(cidr) > prefixLen(best.cidr))) {
        best = { peer, cidr };
      }
    }
  }
  return best;
}

// Inbound: a packet arrived decrypted under `peer`'s key, claiming source `srcIp`. Accept only if that source is inside
// the same peer's AllowedIPs — otherwise it's a spoof (a source that peer has no right to send) and is dropped.
export function acceptInbound(peer: Peer, srcIp: string): boolean {
  return peer.allowedIps.some((cidr) => inCidr(srcIp, cidr));
}

export const DEFAULT_PEERS = (): Peer[] => [
  { name: 'laptop', pubkey: 'HIgo…3n8=', allowedIps: ['10.0.0.2/32'] },
  { name: 'office-gw', pubkey: 'xTIB…9pk=', allowedIps: ['10.0.0.3/32', '192.168.1.0/24'] },
];
