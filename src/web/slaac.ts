// IPv6 stateless address autoconfiguration (SLAAC, RFC 4862) + address architecture
// (RFC 4291) + canonical text form (RFC 5952). A host with no DHCP server mints its
// own addresses: it derives a 64-bit interface identifier from its MAC via the
// Modified EUI-64 rule (RFC 4291 §2.5.1 / Appendix A), prepends the link-local prefix
// fe80::/64 and any global /64 prefix a router advertises, and computes the
// solicited-node multicast address it must join for Duplicate Address Detection.
// Pure, tested against hand-verified vectors.

export type Hextets = number[]; // exactly 8 × 16-bit groups

/** Parse an IPv6 text address (incl. "::") into 8 hextets. */
export function parse(addr: string): Hextets {
  const s = addr.toLowerCase().trim();
  if (s === '::') return [0, 0, 0, 0, 0, 0, 0, 0];
  let head: string[], tail: string[];
  if (s.includes('::')) {
    const [h, t] = s.split('::');
    head = h ? h.split(':') : [];
    tail = t ? t.split(':') : [];
    const missing = 8 - head.length - tail.length;
    const groups = [...head, ...Array(missing).fill('0'), ...tail];
    return groups.map((g) => parseInt(g || '0', 16) & 0xffff);
  }
  return s.split(':').map((g) => parseInt(g, 16) & 0xffff);
}

/** Canonical RFC 5952 text: lowercase, no leading zeros, longest zero run → "::"
 *  (only for runs ≥ 2; leftmost wins on a tie). */
export function compress(g: Hextets): string {
  let bestStart = -1, bestLen = 0, curStart = -1, curLen = 0;
  for (let i = 0; i < 8; i++) {
    if (g[i] === 0) {
      if (curStart === -1) curStart = i;
      curLen++;
      if (curLen > bestLen) { bestLen = curLen; bestStart = curStart; }
    } else { curStart = -1; curLen = 0; }
  }
  if (bestLen < 2) return g.map((h) => h.toString(16)).join(':');
  const head = g.slice(0, bestStart).map((h) => h.toString(16)).join(':');
  const tail = g.slice(bestStart + bestLen).map((h) => h.toString(16)).join(':');
  return `${head}::${tail}`;
}

export interface Eui64 {
  flippedFirstByte: number; // the MAC's first octet after flipping the U/L bit
  bytes: number[];          // 8-byte interface identifier
  iid: Hextets;             // same, as 4 × 16-bit groups
}

/** Modified EUI-64: split the 48-bit MAC, insert FF:FE in the middle, and flip the
 *  Universal/Local bit (bit 0x02 of the first octet). */
export function eui64(mac: string): Eui64 {
  const b = mac.split(/[:-]/).map((x) => parseInt(x, 16) & 0xff);
  const first = b[0] ^ 0x02; // flip U/L bit: locally-set MAC → universal interface id
  const bytes = [first, b[1], b[2], 0xff, 0xfe, b[3], b[4], b[5]];
  const iid = [0, 2, 4, 6].map((i) => (bytes[i] << 8) | bytes[i + 1]);
  return { flippedFirstByte: first, bytes, iid };
}

/** Prepend a /64 prefix's first four hextets to an interface identifier. */
export const withPrefix = (prefix: Hextets, iid: Hextets): Hextets => [...prefix.slice(0, 4), ...iid];

export const linkLocal = (iid: Hextets): Hextets => [0xfe80, 0, 0, 0, ...iid];

/** Solicited-node multicast ff02::1:ffXX:XXXX from the low 24 bits of an address. */
export function solicitedNode(g: Hextets): Hextets {
  return [0xff02, 0, 0, 0, 0, 1, 0xff00 | (g[6] & 0xff), g[7]];
}

export interface Classification { type: string; prefix: string; scope?: string; note?: string }

const MCAST_SCOPE: Record<number, string> = {
  1: 'interface-local', 2: 'link-local', 4: 'admin-local', 5: 'site-local', 8: 'organization-local', 0xe: 'global',
};

/** Classify an IPv6 address by its leading bits (RFC 4291). */
export function classify(g: Hextets): Classification {
  const allZero = g.every((h) => h === 0);
  if (allZero) return { type: 'Unspecified', prefix: '::/128', note: 'a source address before one is assigned (used during DAD)' };
  if (g[0] === 0 && g[1] === 0 && g[2] === 0 && g[3] === 0 && g[4] === 0 && g[5] === 0 && g[6] === 0 && g[7] === 1)
    return { type: 'Loopback', prefix: '::1/128', note: 'the node itself' };
  const h0 = g[0];
  if ((h0 & 0xff00) === 0xff00)
    return { type: 'Multicast', prefix: 'ff00::/8', scope: MCAST_SCOPE[h0 & 0x000f] ?? `scope ${(h0 & 0xf).toString(16)}` };
  if ((h0 & 0xffc0) === 0xfe80) return { type: 'Link-local unicast', prefix: 'fe80::/10', scope: 'link-local', note: 'auto-configured, never routed off-link' };
  if ((h0 & 0xfe00) === 0xfc00) return { type: 'Unique local (ULA)', prefix: 'fc00::/7', scope: 'global (private)', note: 'the IPv6 analogue of RFC 1918 private space' };
  if ((h0 & 0xe000) === 0x2000) {
    const doc = h0 === 0x2001 && g[1] === 0x0db8;
    return { type: 'Global unicast', prefix: '2000::/3', scope: 'global', note: doc ? '2001:db8::/32 is the documentation range' : 'publicly routable' };
  }
  return { type: 'Reserved / other', prefix: '—' };
}
