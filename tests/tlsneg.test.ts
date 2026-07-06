import { describe, it, expect } from 'vitest';
import { SUITES, negotiate, strip, isDowngrade, RANK, outcome, type Strength } from '../src/web/tlsneg';

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

describe('the Finished MAC is only as strong as the key exchange (FREAK/Logjam)', () => {
  const honest = negotiate(SUITES, SUITES)!;
  const forced = (cap: Strength) => negotiate(strip(SUITES, cap), SUITES)!;
  const dg = (cap: Strength) => isDowngrade(honest, forced(cap));

  it('no integrity: any downgrade sticks silently', () => {
    expect(outcome(forced('weak'), dg('weak'), false)).toBe('broken');
  });
  it('with the Finished MAC, a downgrade to a strong-KEX suite is DETECTED (attacker can’t forge it)', () => {
    const f = forced('weak'); // RC4/3DES over RSA-2048 — the record cipher is weak but the KEX is not
    expect(f.exportGrade).toBeFalsy();
    expect(outcome(f, dg('weak'), true)).toBe('detected');
  });
  it('but the Finished MAC is FORGED when forced to an EXPORT suite — the real FREAK/Logjam bypass', () => {
    const f = forced('broken');
    expect(f.exportGrade).toBe(true);                    // 40-bit RSA / 512-bit DH: the master secret is recoverable
    expect(outcome(f, dg('broken'), true)).toBe('forged'); // integrity present, and STILL bypassed
  });
  it('an untouched handshake is secure with or without integrity', () => {
    expect(outcome(honest, false, true)).toBe('secure');
    expect(outcome(honest, false, false)).toBe('secure');
  });
});
