// ICMP (RFC 792) — the internet's control & error channel. When something goes
// wrong forwarding an IP packet (TTL hit 0, no route, packet too big with DF set), a
// router sends back an ICMP message naming the problem. Tools like ping (Echo) and
// traceroute (Time Exceeded) are built on it. This is the canonical type/code table,
// with cross-links to the Apex sections that already show these messages in action.

export type Category = 'query' | 'error';

export interface IcmpCode { code: number; meaning: string }
export interface IcmpType {
  type: number;
  name: string;
  category: Category;
  codes: IcmpCode[];
  trigger: string;
  seenIn?: string; // a section id where Apex demonstrates this message
}

export const ICMP_TYPES: IcmpType[] = [
  {
    type: 0, name: 'Echo Reply', category: 'query', codes: [{ code: 0, meaning: 'Echo reply' }],
    trigger: 'Sent in response to an Echo Request — this is the “pong” of ping.',
  },
  {
    type: 3, name: 'Destination Unreachable', category: 'error',
    codes: [
      { code: 0, meaning: 'Net unreachable' },
      { code: 1, meaning: 'Host unreachable' },
      { code: 3, meaning: 'Port unreachable' },
      { code: 4, meaning: 'Fragmentation needed and DF set' },
    ],
    trigger: 'A router or host can’t deliver the packet — no route, no host, no listener on that port, or it’s too big to forward without fragmenting (code 4 drives Path-MTU Discovery).',
    seenIn: 'fragment',
  },
  {
    type: 4, name: 'Source Quench', category: 'error', codes: [{ code: 0, meaning: 'Source quench (deprecated)' }],
    trigger: 'A primitive “slow down” a congested router could send. Deprecated (RFC 6633) — congestion is handled by TCP and ECN now.',
    seenIn: 'congestion',
  },
  {
    type: 5, name: 'Redirect', category: 'error',
    codes: [
      { code: 0, meaning: 'Redirect for the network' },
      { code: 1, meaning: 'Redirect for the host' },
    ],
    trigger: 'A router tells a host “there’s a better next-hop for this destination — use that gateway instead”. Often disabled, since it’s abusable for traffic interception.',
  },
  {
    type: 8, name: 'Echo Request', category: 'query', codes: [{ code: 0, meaning: 'Echo request' }],
    trigger: 'The “ping” — asks the target to echo this payload back, measuring reachability and round-trip time.',
  },
  {
    type: 11, name: 'Time Exceeded', category: 'error',
    codes: [
      { code: 0, meaning: 'TTL exceeded in transit' },
      { code: 1, meaning: 'Fragment reassembly time exceeded' },
    ],
    trigger: 'A router decremented the TTL to 0 and dropped the packet (code 0) — exactly what traceroute exploits to map each hop. Code 1 fires when not all fragments of a datagram arrived in time.',
    seenIn: 'traceroute',
  },
  {
    type: 12, name: 'Parameter Problem', category: 'error', codes: [{ code: 0, meaning: 'Pointer indicates the error' }],
    trigger: 'The IP header itself is malformed (a bad field or option); the message points at the offending byte.',
  },
];

export const byCategory = (cat: Category): IcmpType[] => ICMP_TYPES.filter((t) => t.category === cat);
export const findType = (type: number): IcmpType | undefined => ICMP_TYPES.find((t) => t.type === type);
