import { describe, it, expect } from 'vitest';
import { TRANSPORTS, byId, wireView } from '../src/web/encdns';

describe('encrypted DNS transports', () => {
  it('uses the standardised ports', () => {
    expect(byId('Do53').port).toBe(53);
    expect(byId('DoT').port).toBe(853);
    expect(byId('DoH').port).toBe(443);
    expect(byId('DoQ').port).toBe(853);
  });

  it('only Do53 exposes the query name', () => {
    expect(byId('Do53').sees.name).toBe(true);
    for (const id of ['DoT', 'DoH', 'DoQ'] as const) expect(byId(id).sees.name).toBe(false);
  });

  it('only DoH hides that the traffic is DNS at all', () => {
    expect(byId('DoH').sees.isDns).toBe(false); // looks like HTTPS
    expect(byId('Do53').sees.isDns).toBe(true);
    expect(byId('DoT').sees.isDns).toBe(true); // dedicated port 853 gives it away
  });

  it('the resolver address is always visible (you connect to it)', () => {
    for (const t of TRANSPORTS) expect(t.sees.resolver).toBe(true);
  });
});

describe('what is on the wire', () => {
  it('Do53 leaks the readable query and answer', () => {
    const rows = wireView(byId('Do53'), 'example.com');
    expect(rows.some((r) => r.value.includes('A? example.com') && !r.opaque)).toBe(true);
    expect(rows.every((r) => !r.opaque)).toBe(true); // nothing encrypted
  });

  it('the encrypted transports show only an opaque record (no invented plaintext)', () => {
    for (const id of ['DoT', 'DoH', 'DoQ'] as const) {
      const rows = wireView(byId(id), 'example.com');
      expect(rows.some((r) => r.opaque)).toBe(true);
      expect(rows.some((r) => r.value.includes('example.com'))).toBe(false); // the name never appears
    }
  });
});
