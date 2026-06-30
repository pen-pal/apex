import { describe, it, expect } from 'vitest';
import { fullMeshSessions, rrSessions, reflect, type Peer } from '../src/web/bgprr';

describe('the full-mesh scaling problem', () => {
  it('n routers need n(n-1)/2 iBGP sessions', () => {
    expect(fullMeshSessions(10)).toBe(45);
    expect(fullMeshSessions(100)).toBe(4950);
  });
  it('a route reflector collapses the mesh to far fewer sessions', () => {
    // 9 clients + 1 RR, no other non-clients: 9 spoke sessions vs 45 full mesh
    expect(rrSessions(9, 0)).toBe(9);
    expect(rrSessions(9, 0)).toBeLessThan(fullMeshSessions(10));
  });
  it('non-clients still mesh among themselves and the RR', () => {
    // 2 non-clients + RR form a 3-node mesh (3 sessions) plus the client spokes
    expect(rrSessions(5, 2)).toBe(5 + 3);
  });
});

const PEERS: Peer[] = [
  { id: 'c1', kind: 'client' }, { id: 'c2', kind: 'client' },
  { id: 'n1', kind: 'nonclient' }, { id: 'n2', kind: 'nonclient' },
];

describe('reflection rules (RFC 4456)', () => {
  it('a route from a CLIENT is reflected to all other clients AND non-clients', () => {
    expect(reflect('client', PEERS, 'c1').sort()).toEqual(['c2', 'n1', 'n2']);
  });
  it('a route from a NON-CLIENT is reflected only to clients', () => {
    expect(reflect('nonclient', PEERS, 'n1').sort()).toEqual(['c1', 'c2']);
  });
  it('a route from an eBGP peer goes to every iBGP peer', () => {
    expect(reflect('ebgp', PEERS, 'ext').sort()).toEqual(['c1', 'c2', 'n1', 'n2']);
  });
  it('a route is never reflected back to its source', () => {
    expect(reflect('client', PEERS, 'c1')).not.toContain('c1');
  });
});
