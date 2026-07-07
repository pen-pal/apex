import { describe, it, expect } from 'vitest';
import { ipInCidr, matchRule, evaluate, type Rule, type Packet } from '../src/web/firewall';

// Independent oracle: netfilter/iptables semantics — CIDR containment by mask arithmetic, and "first matching rule
// wins, else default policy." Expected values are computed from the rules of IP addressing and the documented
// firewall traversal order, never from the implementation.

describe('ipInCidr (CIDR containment)', () => {
  it('matches inside the block and rejects outside', () => {
    expect(ipInCidr('192.168.1.5', '192.168.1.0/24')).toBe(true);
    expect(ipInCidr('192.168.1.255', '192.168.1.0/24')).toBe(true);
    expect(ipInCidr('192.168.2.1', '192.168.1.0/24')).toBe(false);
  });
  it('/32 is an exact host, /0 and "any" match everything', () => {
    expect(ipInCidr('10.0.0.7', '10.0.0.7/32')).toBe(true);
    expect(ipInCidr('10.0.0.8', '10.0.0.7/32')).toBe(false);
    expect(ipInCidr('8.8.8.8', '0.0.0.0/0')).toBe(true);
    expect(ipInCidr('8.8.8.8', 'any')).toBe(true);
  });
  it('a bare address is treated as /32', () => {
    expect(ipInCidr('10.0.0.7', '10.0.0.7')).toBe(true);
    expect(ipInCidr('10.0.0.9', '10.0.0.7')).toBe(false);
  });
  it('respects the prefix boundary (a.b.c.d/8)', () => {
    expect(ipInCidr('10.4.5.6', '10.0.0.0/8')).toBe(true);
    expect(ipInCidr('11.0.0.1', '10.0.0.0/8')).toBe(false);
  });
});

describe('matchRule (proto/port/src wildcards)', () => {
  const pkt: Packet = { proto: 'tcp', src: '203.0.113.9', dport: 22 };
  it("'any' proto and port are wildcards", () => {
    expect(matchRule({ proto: 'any', src: 'any', dport: 'any', action: 'DROP' }, pkt)).toBe(true);
  });
  it('a mismatching proto or port fails', () => {
    expect(matchRule({ proto: 'udp', src: 'any', dport: 'any', action: 'DROP' }, pkt)).toBe(false);
    expect(matchRule({ proto: 'tcp', src: 'any', dport: 80, action: 'DROP' }, pkt)).toBe(false);
  });
  it('a disabled rule never matches', () => {
    expect(matchRule({ proto: 'any', src: 'any', dport: 'any', action: 'DROP', enabled: false }, pkt)).toBe(false);
  });
});

describe('evaluate: first matching rule wins, else the default policy', () => {
  const office = '10.0.0.0/8';
  const sshFromOffice: Packet = { proto: 'tcp', src: '10.2.3.4', dport: 22 };
  const sshFromInternet: Packet = { proto: 'tcp', src: '203.0.113.9', dport: 22 };

  it('the default policy decides when nothing matches', () => {
    expect(evaluate([], sshFromInternet, 'DROP')).toEqual({ action: 'DROP', matchedIndex: -1 });
    expect(evaluate([], sshFromInternet, 'ACCEPT')).toEqual({ action: 'ACCEPT', matchedIndex: -1 });
  });

  it('secure ordering: allow SSH from office, then default-DROP blocks the internet', () => {
    const rules: Rule[] = [{ proto: 'tcp', src: office, dport: 22, action: 'ACCEPT' }];
    expect(evaluate(rules, sshFromOffice, 'DROP').action).toBe('ACCEPT');
    expect(evaluate(rules, sshFromInternet, 'DROP').action).toBe('DROP');
  });

  it('the classic order bug: a broad ACCEPT above a specific DROP lets the attacker in', () => {
    const buggy: Rule[] = [
      { proto: 'tcp', src: 'any', dport: 22, action: 'ACCEPT' }, // broad allow — matches first
      { proto: 'tcp', src: '203.0.113.0/24', dport: 22, action: 'DROP' }, // never reached
    ];
    expect(evaluate(buggy, sshFromInternet, 'DROP')).toEqual({ action: 'ACCEPT', matchedIndex: 0 });

    // Swap the order and the specific DROP now wins — same rules, opposite outcome.
    const fixed: Rule[] = [buggy[1], buggy[0]];
    expect(evaluate(fixed, sshFromInternet, 'DROP')).toEqual({ action: 'DROP', matchedIndex: 0 });
  });
});
