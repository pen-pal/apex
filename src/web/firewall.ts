// Packet-filter firewall (iptables/netfilter), modelled honestly. A chain is an ORDERED list of rules; each packet
// walks it top to bottom and the FIRST rule that matches decides its fate (ACCEPT / DROP / REJECT). If no rule
// matches, the chain's default POLICY applies. That "first match wins" is the whole game: a broad ACCEPT placed above
// a specific DROP silently lets the bad traffic through, and the secure baseline is a default-DROP policy with
// explicit allows above it. Matching is real CIDR arithmetic (reuses subnet.ts).
import { parseIp, maskOf } from './subnet';

export type Action = 'ACCEPT' | 'DROP' | 'REJECT';
export type Proto = 'tcp' | 'udp';
export type Policy = 'ACCEPT' | 'DROP';
export type Rule = { proto: Proto | 'any'; src: string; dport: number | 'any'; action: Action; enabled?: boolean };
export type Packet = { proto: Proto; src: string; dport: number };

// Is `ip` inside `cidr`? Accepts 'any' / 0.0.0.0/0 (match all), an "a.b.c.d/n" block, or a bare address (= /32).
export function ipInCidr(ip: string, cidr: string): boolean {
  if (cidr === 'any' || cidr === '0.0.0.0/0') return true;
  const ipv = parseIp(ip);
  if (ipv === null) return false;
  const m = cidr.match(/^(\d+\.\d+\.\d+\.\d+)\/(\d+)$/);
  if (!m) {
    const bare = parseIp(cidr);
    return bare !== null && bare === ipv; // a bare IP is an exact (/32) match
  }
  const net = parseIp(m[1]);
  const pfx = Number(m[2]);
  if (net === null || pfx < 0 || pfx > 32) return false;
  const mask = maskOf(pfx);
  return ((ipv & mask) >>> 0) === ((net & mask) >>> 0);
}

// Does a rule match a packet? A disabled rule never matches; 'any' is a wildcard for proto and port.
export function matchRule(rule: Rule, pkt: Packet): boolean {
  if (rule.enabled === false) return false;
  if (rule.proto !== 'any' && rule.proto !== pkt.proto) return false;
  if (rule.dport !== 'any' && rule.dport !== pkt.dport) return false;
  return ipInCidr(pkt.src, rule.src);
}

// Walk the chain top-down: the first matching rule decides; otherwise the default policy. Returns the verdict and the
// index of the deciding rule (-1 when the policy decided).
export function evaluate(rules: Rule[], pkt: Packet, policy: Policy): { action: Action; matchedIndex: number } {
  for (let i = 0; i < rules.length; i++) {
    if (matchRule(rules[i], pkt)) return { action: rules[i].action, matchedIndex: i };
  }
  return { action: policy, matchedIndex: -1 };
}
