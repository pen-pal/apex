import { describe, it, expect } from 'vitest';
import { SUITES, negotiate, strip, isDowngrade, RANK } from '../src/web/tlsneg';

const byId = (id: string) => SUITES.find((s) => s.id === id)!;

describe('cipher-suite negotiation', () => {
  it('picks the strongest mutually-supported suite', () => {
    const sel = negotiate(SUITES, SUITES);
    expect(sel!.id).toBe('TLS_AES_256_GCM_SHA384'); // the top of the list
    expect(sel!.strength).toBe('strong');
  });

  it('falls to a weaker suite when the server lacks the strong ones', () => {
    const legacyServer = SUITES.filter((s) => s.strength !== 'strong');
    expect(negotiate(SUITES, legacyServer)!.strength).toBe('legacy');
  });

  it('returns null when there is no overlap', () => {
    expect(negotiate([byId('TLS_AES_256_GCM_SHA384')], [byId('TLS_RSA_WITH_RC4_128_SHA')])).toBeNull();
  });
});

describe('the downgrade attack', () => {
  it('stripping the strong suites forces an export-grade, breakable suite', () => {
    const tampered = strip(SUITES, 'broken'); // attacker leaves only export ciphers
    const sel = negotiate(tampered, SUITES);
    expect(sel!.strength).toBe('broken');
    expect(sel!.attack).toMatch(/FREAK|Logjam/);
  });

  it('isDowngrade flags that the client was forced below its real best', () => {
    const honest = negotiate(SUITES, SUITES);
    const forced = negotiate(strip(SUITES, 'weak'), SUITES);
    expect(isDowngrade(honest, forced)).toBe(true);
    expect(isDowngrade(honest, honest)).toBe(false); // untouched: no downgrade
  });

  it('a higher cap leaves a stronger suite available', () => {
    expect(RANK[negotiate(strip(SUITES, 'legacy'), SUITES)!.strength]).toBeGreaterThan(
      RANK[negotiate(strip(SUITES, 'weak'), SUITES)!.strength],
    );
  });
});
