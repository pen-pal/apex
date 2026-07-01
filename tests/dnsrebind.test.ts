import { describe, it, expect } from 'vitest';
import { simulate, type Config } from '../src/web/dnsrebind';

const off: Config = { blockPrivateIP: false, dnsPinning: false, hostValidation: false };

describe('the attack with no defenses', () => {
  it('rebinds to 127.0.0.1 and exfiltrates the internal response', () => {
    const r = simulate(off);
    expect(r.success).toBe(true);
    expect(r.blockedBy).toBeNull();
    expect(r.steps.some((s) => s.ip === '127.0.0.1' && !s.blocked)).toBe(true); // the rebind happens
    expect(r.steps.at(-1)!.actor).toBe('attacker');                             // exfil is the final step
    expect(r.steps.every((s) => !s.blocked)).toBe(true);                        // nothing blocked
  });
});

describe('each defense stops it at its own layer', () => {
  it('blocking private-IP answers stops the rebind before it starts', () => {
    const r = simulate({ ...off, blockPrivateIP: true });
    expect(r.success).toBe(false);
    expect(r.blockedBy).toMatch(/private-IP/i);
    const b = r.steps.find((s) => s.blocked)!;
    expect(b.actor).toBe('attacker'); // blocked at the flip
  });
  it('DNS pinning sends the re-fetch back to the attacker, not inside', () => {
    const r = simulate({ ...off, dnsPinning: true });
    expect(r.success).toBe(false);
    expect(r.blockedBy).toMatch(/pinning/i);
    expect(r.steps.find((s) => s.blocked)!.ip).toBe('6.6.6.6 (attacker)'); // reused old IP
  });
  it('Host-header validation lets the request arrive but the service rejects it', () => {
    const r = simulate({ ...off, hostValidation: true });
    expect(r.success).toBe(false);
    expect(r.blockedBy).toMatch(/Host-header/i);
    expect(r.steps.find((s) => s.blocked)!.actor).toBe('internal'); // rejected at the service
  });
});

describe('defense ordering — the earliest layer wins', () => {
  it('reports the first defense in the chain when several are on', () => {
    expect(simulate({ blockPrivateIP: true, dnsPinning: true, hostValidation: true }).blockedBy).toMatch(/private-IP/i);
    expect(simulate({ blockPrivateIP: false, dnsPinning: true, hostValidation: true }).blockedBy).toMatch(/pinning/i);
    expect(simulate({ blockPrivateIP: false, dnsPinning: false, hostValidation: true }).blockedBy).toMatch(/Host-header/i);
  });
  it('any single defense is sufficient to stop the attack', () => {
    expect(simulate({ ...off, blockPrivateIP: true }).success).toBe(false);
    expect(simulate({ ...off, dnsPinning: true }).success).toBe(false);
    expect(simulate({ ...off, hostValidation: true }).success).toBe(false);
  });
});
