// Multicast & IGMP (RFC 2236) — delivering one stream to many receivers without
// flooding everyone. A multicast group is a 224.0.0.0/4 address; a host JOINs by
// sending an IGMP membership report and LEAVEs when done. An IGMP-snooping switch
// watches those reports to learn which of its PORTS have a member of each group, so
// a multicast frame is forwarded ONLY out ports that have a joined member (unlike a
// broadcast, which hits every port). The upstream router keeps pulling the stream
// onto the segment only while ≥1 member exists, and PRUNES the group when the last
// member leaves. Pure, deterministic model. Tested.

export interface Host { id: number; name: string; port: number }

/** Per-group membership: which host ids have joined. */
export type Membership = Record<string, Set<number>>; // group address → joined host ids

export function isMulticast(addr: string): boolean {
  const first = Number(addr.split('.')[0]);
  return first >= 224 && first <= 239; // 224.0.0.0 – 239.255.255.255
}

export function join(m: Membership, group: string, hostId: number): Membership {
  const next: Membership = { ...m, [group]: new Set(m[group] ?? []) };
  next[group].add(hostId);
  return next;
}

export function leave(m: Membership, group: string, hostId: number): Membership {
  const next: Membership = { ...m, [group]: new Set(m[group] ?? []) };
  next[group].delete(hostId);
  if (next[group].size === 0) delete next[group]; // last member → group pruned
  return next;
}

/** The switch ports that have ≥1 member of `group` (IGMP snooping result). */
export function memberPorts(m: Membership, group: string, hosts: Host[]): number[] {
  const members = m[group] ?? new Set<number>();
  const ports = new Set<number>();
  for (const h of hosts) if (members.has(h.id)) ports.add(h.port);
  return [...ports].sort((a, b) => a - b);
}

export interface Delivery {
  mode: 'multicast' | 'broadcast';
  delivered: number[]; // host ids that received the frame
  ports: number[]; // ports the switch forwarded out of
  pruned: boolean; // multicast: was the group empty (nothing forwarded)?
}

/** Forward a frame for `group`: multicast → only members; broadcast → everyone. */
export function forward(m: Membership, group: string, hosts: Host[], mode: 'multicast' | 'broadcast'): Delivery {
  if (mode === 'broadcast') {
    return { mode, delivered: hosts.map((h) => h.id), ports: [...new Set(hosts.map((h) => h.port))].sort((a, b) => a - b), pruned: false };
  }
  const members = m[group] ?? new Set<number>();
  const delivered = hosts.filter((h) => members.has(h.id)).map((h) => h.id);
  return { mode, delivered, ports: memberPorts(m, group, hosts), pruned: delivered.length === 0 };
}
