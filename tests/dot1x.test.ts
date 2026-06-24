import { describe, it, expect } from 'vitest';
import { exchange, portAuthorized } from '../src/web/dot1x';

describe('802.1X EAP exchange', () => {
  const ok = exchange('accept');
  const no = exchange('reject');

  it('starts with EAPOL and ends with EAP-Success / EAP-Failure', () => {
    expect(ok[0].label).toBe('EAPOL-Start');
    expect(ok[ok.length - 1].label).toBe('EAP-Success');
    expect(no[no.length - 1].label).toBe('EAP-Failure');
  });

  it('the authenticator translates EAPOL ↔ RADIUS (supplicant link is EAPOL, server link is RADIUS)', () => {
    for (const m of ok) {
      const onSupplicantLink = m.from === 'supplicant' || m.to === 'supplicant';
      const onServerLink = m.from === 'radius' || m.to === 'radius';
      if (onSupplicantLink) expect(m.proto).toBe('EAPOL');
      if (onServerLink) expect(m.proto).toBe('RADIUS');
    }
  });

  it('the supplicant never talks to RADIUS directly (the authenticator relays)', () => {
    for (const m of ok) {
      expect(m.from === 'supplicant' && m.to === 'radius').toBe(false);
      expect(m.from === 'radius' && m.to === 'supplicant').toBe(false);
    }
  });

  it('the port stays UNAUTHORIZED until EAP-Success, then opens', () => {
    // every message before the last is unauthorized; only EAP-Success authorizes
    for (let i = 0; i < ok.length - 1; i++) expect(ok[i].port).toBe('unauthorized');
    expect(ok[ok.length - 1].port).toBe('authorized');
    expect(portAuthorized(ok)).toBe(true);
  });

  it('a rejected device never opens the port', () => {
    expect(no.every((m) => m.port === 'unauthorized')).toBe(true);
    expect(portAuthorized(no)).toBe(false);
  });

  it('only the RADIUS server issues the verdict (Accept/Reject)', () => {
    expect(ok.some((m) => m.from === 'radius' && m.label.includes('Access-Accept'))).toBe(true);
    expect(no.some((m) => m.from === 'radius' && m.label.includes('Access-Reject'))).toBe(true);
  });
});
