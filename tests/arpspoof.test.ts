import { describe, it, expect } from 'vitest';
import { simulate, type Config } from '../src/web/arpspoof';

const off: Config = { staticArp: false, dai: false, tls: false };

describe('the attack with no defenses', () => {
  it('poisons the cache, establishes MITM, and exposes plaintext', () => {
    const r = simulate(off);
    expect(r.poisoned).toBe(true);
    expect(r.mitm).toBe(true);
    expect(r.contentExposed).toBe(true);
    expect(r.gatewayMacInCache).toBe('attacker');   // gateway IP now maps to the attacker
    expect(r.blockedBy).toBeNull();
    expect(r.steps.every((s) => !s.blocked)).toBe(true);
  });
});

describe('preventing the poisoning', () => {
  it('a static ARP entry makes the victim ignore the forged reply', () => {
    const r = simulate({ ...off, staticArp: true });
    expect(r.poisoned).toBe(false);
    expect(r.mitm).toBe(false);
    expect(r.gatewayMacInCache).toBe('gateway');
    expect(r.blockedBy).toMatch(/static arp/i);
    expect(r.steps.find((s) => s.blocked)!.actor).toBe('victim');
  });
  it('Dynamic ARP Inspection has the switch drop the forged reply', () => {
    const r = simulate({ ...off, dai: true });
    expect(r.poisoned).toBe(false);
    expect(r.blockedBy).toMatch(/dynamic arp inspection/i);
    expect(r.steps.find((s) => s.blocked)!.actor).toBe('switch');
  });
});

describe('TLS does not stop the MITM but protects the content', () => {
  it('the attacker is still in the path, but sees only ciphertext', () => {
    const r = simulate({ ...off, tls: true });
    expect(r.poisoned).toBe(true);       // ARP is still poisoned (layer 2)
    expect(r.mitm).toBe(true);           // attacker is in the path
    expect(r.contentExposed).toBe(false); // but can't read/modify the encrypted content
    expect(r.blockedBy).toBeNull();      // TLS mitigates, it doesn't "block" the poisoning
  });
});

describe('layered defenses — the earliest one wins', () => {
  it('static ARP (host) is reported before DAI (switch)', () => {
    expect(simulate({ staticArp: true, dai: true, tls: true }).blockedBy).toMatch(/static arp/i);
    expect(simulate({ staticArp: false, dai: true, tls: true }).blockedBy).toMatch(/dynamic arp inspection/i);
  });
  it('either L2 defense fully prevents the compromise', () => {
    for (const c of [{ ...off, staticArp: true }, { ...off, dai: true }]) {
      const r = simulate(c);
      expect(r.poisoned).toBe(false);
      expect(r.mitm).toBe(false);
      expect(r.contentExposed).toBe(false);
    }
  });
});
