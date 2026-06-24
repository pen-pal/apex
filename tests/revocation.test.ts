import { describe, it, expect } from 'vitest';
import { METHODS, byId, status, browserAccepts, monitor, type CtEntry } from '../src/web/revocation';

describe('revocation methods', () => {
  it('only stapling spares the browser a call to the CA', () => {
    expect(byId('stapling').clientContactsCA).toBe(false);
    expect(byId('ocsp').clientContactsCA).toBe(true);
    expect(byId('crl').clientContactsCA).toBe(true);
  });
  it('OCSP is the one that leaks browsing to the CA', () => {
    expect(METHODS.filter((m) => m.privacy === 'leaks').map((m) => m.id)).toEqual(['ocsp']);
  });
  it('status flags a revoked serial', () => {
    const revoked = new Set([42]);
    expect(status(42, revoked)).toBe('revoked');
    expect(status(7, revoked)).toBe('good');
  });
});

describe('certificate transparency', () => {
  const log: CtEntry[] = [
    { serial: 1, domain: 'mybank.com', issuedBy: 'Legit CA', sct: true }, // I requested this
    { serial: 99, domain: 'mybank.com', issuedBy: 'Sketchy CA', sct: true }, // I did NOT — mis-issued
    { serial: 2, domain: 'other.com', issuedBy: 'Legit CA', sct: true },
  ];

  it('a cert without an SCT is rejected by browsers', () => {
    expect(browserAccepts({ serial: 5, domain: 'x.com', issuedBy: 'CA', sct: false })).toBe(false);
    expect(browserAccepts(log[0])).toBe(true);
  });

  it('monitoring my domain catches the cert I never requested', () => {
    const flagged = monitor(log, 'mybank.com', new Set([1]));
    expect(flagged).toHaveLength(1);
    expect(flagged[0].serial).toBe(99);
    expect(flagged[0].issuedBy).toBe('Sketchy CA');
  });

  it('no false positives when every cert for my domain was requested', () => {
    expect(monitor(log, 'other.com', new Set([2]))).toHaveLength(0);
  });
});
