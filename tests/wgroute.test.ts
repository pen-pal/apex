import { describe, it, expect } from 'vitest';
import { inCidr, routeOutbound, acceptInbound, DEFAULT_PEERS, type Peer } from '../src/web/wgroute';

// Independent oracle: CIDR containment and WireGuard's cryptokey-routing rules. Outbound, a destination goes to the
// peer whose AllowedIPs covers it by the longest prefix (or is dropped if none does). Inbound, a packet decrypted with
// a peer's key is accepted only if its source is in that same peer's AllowedIPs. Expected results are worked out by
// hand from the addresses (laptop: 10.0.0.2/32; office-gw: 10.0.0.3/32 + 192.168.1.0/24).

describe('inCidr', () => {
  it('matches host and subnet CIDRs correctly', () => {
    expect(inCidr('10.0.0.2', '10.0.0.2/32')).toBe(true);
    expect(inCidr('10.0.0.3', '10.0.0.2/32')).toBe(false);
    expect(inCidr('192.168.1.50', '192.168.1.0/24')).toBe(true);
    expect(inCidr('192.168.2.50', '192.168.1.0/24')).toBe(false);
    expect(inCidr('8.8.8.8', '0.0.0.0/0')).toBe(true); // full tunnel matches everything
  });
});

describe('outbound cryptokey routing', () => {
  const peers = DEFAULT_PEERS();
  it('routes a destination to the peer whose AllowedIPs covers it', () => {
    expect(routeOutbound(peers, '10.0.0.2')?.peer.name).toBe('laptop');
    expect(routeOutbound(peers, '192.168.1.50')?.peer.name).toBe('office-gw');
    expect(routeOutbound(peers, '10.0.0.3')?.peer.name).toBe('office-gw');
  });
  it('drops a destination no peer covers (not a full-tunnel config)', () => {
    expect(routeOutbound(peers, '8.8.8.8')).toBeNull();
  });
  it('longest prefix wins when two peers overlap', () => {
    const overlap: Peer[] = [
      { name: 'wide', pubkey: 'a', allowedIps: ['10.0.0.0/8'] },
      { name: 'narrow', pubkey: 'b', allowedIps: ['10.1.2.0/24'] },
    ];
    expect(routeOutbound(overlap, '10.1.2.9')?.peer.name).toBe('narrow'); // /24 beats /8
    expect(routeOutbound(overlap, '10.9.9.9')?.peer.name).toBe('wide');   // only /8 covers it
  });
});

describe('inbound source ACL (anti-spoof)', () => {
  const [laptop, office] = DEFAULT_PEERS();
  it('accepts a source inside the peer’s AllowedIPs', () => {
    expect(acceptInbound(office, '192.168.1.50')).toBe(true);
    expect(acceptInbound(laptop, '10.0.0.2')).toBe(true);
  });
  it('rejects a source that belongs to a different peer (spoof)', () => {
    expect(acceptInbound(office, '10.0.0.2')).toBe(false);  // laptop's address, arriving on office's key
    expect(acceptInbound(laptop, '192.168.1.50')).toBe(false);
  });
});
