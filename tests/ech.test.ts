import { describe, it, expect } from 'vitest';
import { analyze, REAL_SNI, COVER_SNI, type Config } from '../src/web/ech';

// Independent oracle: which metadata channel identifies the destination. Without ECH the SNI is plaintext (blocked).
// With ECH the SNI shows only the cover, but the censor falls back to the plaintext DNS query, then to a unique
// destination IP; only when all three are closed (ECH + private DNS + shared front) is the request unblockable.
// Expected leak/blocked values follow from those rules.

const cfg = (o: Partial<Config> = {}): Config => ({ echOn: true, privateDns: true, sharedFront: true, ...o });

describe('the SNI channel', () => {
  it('without ECH the real SNI is visible and blocked', () => {
    const a = analyze(cfg({ echOn: false }));
    expect(a.visibleSni).toBe(REAL_SNI);
    expect(a.leak).toBe('sni');
    expect(a.blocked).toBe(true);
  });
  it('with ECH the SNI shows only the cover name', () => {
    expect(analyze(cfg()).visibleSni).toBe(COVER_SNI);
  });
});

describe('the fallback channels', () => {
  it('ECH but plaintext DNS → the query still leaks the name', () => {
    const a = analyze(cfg({ privateDns: false }));
    expect(a.leak).toBe('dns');
    expect(a.blocked).toBe(true);
    expect(a.dnsVisible).toBe(REAL_SNI);
  });
  it('ECH + private DNS but a unique IP → blocked by address', () => {
    const a = analyze(cfg({ sharedFront: false }));
    expect(a.leak).toBe('ip');
    expect(a.blocked).toBe(true);
  });
});

describe('all three channels closed', () => {
  it('ECH + private DNS + shared front is unblockable', () => {
    const a = analyze(cfg());
    expect(a.leak).toBeNull();
    expect(a.blocked).toBe(false);
    expect(a.dnsVisible).toBe('');
    expect(a.ipShared).toBe(true);
  });
});
