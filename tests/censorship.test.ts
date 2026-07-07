import { describe, it, expect } from 'vitest';
import { verdict, FULL_CENSOR, type Conn } from '../src/web/censorship';

// Independent oracle: the Tor censorship arms race. A full firewall does DPI + relay-blocklist + SNI-filter, checked
// in path order; obfs4 defeats DPI, a bridge defeats the blocklist, domain fronting defeats SNI. Each defeats exactly
// one stage; you need all three to pass a full firewall. Asserted against the design, not the code.

const conn = (o: boolean, b: boolean, f: boolean): Conn => ({ obfuscated: o, bridge: b, fronted: f });

describe('censorship circumvention (Tor pluggable transports)', () => {
  it('plain Tor is blocked first by DPI', () => {
    const v = verdict(conn(false, false, false), FULL_CENSOR);
    expect(v.blocked).toBe(true);
    expect(v.stage).toBe(0);
    expect(v.by).toMatch(/DPI/);
  });
  it('obfs4 defeats DPI, but the blocklist stops it next', () => {
    expect(verdict(conn(true, false, false), FULL_CENSOR).stage).toBe(1);
  });
  it('obfs4 + bridge pass DPI and the blocklist; the SNI filter stops it', () => {
    expect(verdict(conn(true, true, false), FULL_CENSOR).stage).toBe(2);
  });
  it('all three techniques pass a full firewall', () => {
    const v = verdict(conn(true, true, true), FULL_CENSOR);
    expect(v.blocked).toBe(false);
    expect(v.stage).toBe(3);
  });
  it('against a DPI-only censor, obfs4 alone suffices', () => {
    expect(verdict(conn(true, false, false), { dpi: true, blocklist: false, sniFilter: false }).blocked).toBe(false);
  });
  it('checks are in path order — a bridge without obfs4 still dies at DPI first', () => {
    expect(verdict(conn(false, true, true), FULL_CENSOR).stage).toBe(0);
  });
});
