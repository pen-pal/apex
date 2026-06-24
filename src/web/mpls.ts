// MPLS label switching — forwarding by a short fixed-length label instead of a
// longest-prefix IP lookup at every hop. The ingress router (LER) classifies the
// packet into a forwarding-equivalence class and PUSHES a label; each core router
// (LSR) does one exact-match lookup in its label FIB and SWAPS the label for the next
// hop; the penultimate router POPS the label (penultimate-hop popping) so the egress
// does a single IP lookup. The label, not the destination, picks the path — which is
// what makes traffic-engineered tunnels and L3VPNs possible. Pure model (tested).

export type Action = 'push' | 'swap' | 'pop' | 'ip';

export interface Lsr {
  name: string;
  role: 'ingress' | 'core' | 'penultimate' | 'egress';
  // label FIB: incoming label → { outgoing label or 'pop', next hop }
  lfib: Record<number, { out: number | 'pop'; next: string }>;
}

export interface Hop { router: string; action: Action; inLabel: number | null; outLabel: number | null; next: string }

// A four-router LSP: PE1 (push) → P1 (swap) → P2 (penultimate pop) → PE2 (egress IP).
export const PATH: Lsr[] = [
  { name: 'PE1', role: 'ingress', lfib: { 0: { out: 100, next: 'P1' } } }, // 0 = "from IP, classify to FEC"
  { name: 'P1', role: 'core', lfib: { 100: { out: 200, next: 'P2' } } },
  { name: 'P2', role: 'penultimate', lfib: { 200: { out: 'pop', next: 'PE2' } } }, // PHP
  { name: 'PE2', role: 'egress', lfib: {} }, // does an IP lookup → CE
];

/** Trace the label through the LSP. The ingress pushes; cores swap; the penultimate
 *  pops; the egress forwards by IP. */
export function journey(path: Lsr[] = PATH): Hop[] {
  const hops: Hop[] = [];
  let label: number | null = null; // the label currently on the packet
  for (const r of path) {
    if (r.role === 'egress') { hops.push({ router: r.name, action: 'ip', inLabel: label, outLabel: null, next: 'CE2' }); label = null; continue; }
    const key: number = label ?? 0;
    const e: { out: number | 'pop'; next: string } | undefined = r.lfib[key];
    if (!e) { hops.push({ router: r.name, action: 'ip', inLabel: label, outLabel: null, next: '?' }); continue; }
    const action: Action = r.role === 'ingress' ? 'push' : e.out === 'pop' ? 'pop' : 'swap';
    const outLabel: number | null = e.out === 'pop' ? null : e.out;
    hops.push({ router: r.name, action, inLabel: label, outLabel, next: e.next });
    label = outLabel;
  }
  return hops;
}
