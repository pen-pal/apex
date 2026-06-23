// IPv4 subnet math — the real bit arithmetic behind CIDR. A prefix length /n
// splits a 32-bit address into a network part (the high n bits, fixed) and a host
// part (the low 32-n bits, which vary). Everything here is exact integer math on
// the 32-bit address, tested against known examples. RFC 4632 (CIDR).

const M32 = 0xffffffff;

/** Parse "a.b.c.d" → unsigned 32-bit integer, or null if malformed. */
export function parseIp(s: string): number | null {
  const parts = s.trim().split('.');
  if (parts.length !== 4) return null;
  let v = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const n = Number(p);
    if (n > 255) return null;
    v = (v * 256 + n) >>> 0;
  }
  return v >>> 0;
}

/** Format a 32-bit integer as dotted-quad. */
export function formatIp(v: number): string {
  return [24, 16, 8, 0].map((sh) => (v >>> sh) & 0xff).join('.');
}

/** The /n netmask as a 32-bit integer (n=0 → 0.0.0.0, n=32 → 255.255.255.255). */
export function maskOf(prefix: number): number {
  return prefix === 0 ? 0 : (M32 << (32 - prefix)) >>> 0;
}

export interface Subnet {
  ok: boolean;
  error?: string;
  prefix: number;
  mask: string;
  wildcard: string;
  network: string;
  broadcast: string;
  firstHost: string;
  lastHost: string;
  totalAddresses: number;
  usableHosts: number;
  networkInt: number; // for ordering / visualization
  broadcastInt: number;
}

/** Compute the full description of a CIDR block "a.b.c.d/n". */
export function subnet(cidr: string): Subnet {
  const bad = (error: string): Subnet => ({
    ok: false, error, prefix: 0, mask: '', wildcard: '', network: '', broadcast: '',
    firstHost: '', lastHost: '', totalAddresses: 0, usableHosts: 0, networkInt: 0, broadcastInt: 0,
  });
  const m = cidr.trim().match(/^(\d+\.\d+\.\d+\.\d+)\s*\/\s*(\d+)$/);
  if (!m) return bad('Use a.b.c.d/n, e.g. 192.168.1.0/24');
  const ip = parseIp(m[1]);
  const prefix = Number(m[2]);
  if (ip === null) return bad('That is not a valid IPv4 address.');
  if (prefix < 0 || prefix > 32) return bad('Prefix length must be 0–32.');

  const mask = maskOf(prefix);
  const network = (ip & mask) >>> 0;
  const broadcast = (network | (~mask & M32)) >>> 0;
  const total = 2 ** (32 - prefix);
  // /31 (point-to-point, RFC 3021) and /32 (host) have no separate net/broadcast hosts
  const usable = prefix >= 31 ? total : total - 2;
  const firstHost = prefix >= 31 ? network : (network + 1) >>> 0;
  const lastHost = prefix >= 31 ? broadcast : (broadcast - 1) >>> 0;

  return {
    ok: true, prefix,
    mask: formatIp(mask),
    wildcard: formatIp(~mask & M32),
    network: formatIp(network),
    broadcast: formatIp(broadcast),
    firstHost: formatIp(firstHost),
    lastHost: formatIp(lastHost),
    totalAddresses: total,
    usableHosts: usable,
    networkInt: network,
    broadcastInt: broadcast,
  };
}

export interface SubnetBlock { network: string; broadcast: string; prefix: number; networkInt: number; usableHosts: number }

/**
 * Split a CIDR block into 2^(newPrefix-prefix) equal child subnets at newPrefix.
 * Returns null if newPrefix isn't larger than the block's prefix (or > 32).
 */
export function splitInto(cidr: string, newPrefix: number): SubnetBlock[] | null {
  const base = subnet(cidr);
  if (!base.ok || newPrefix <= base.prefix || newPrefix > 32) return null;
  const childSize = 2 ** (32 - newPrefix);
  const count = 2 ** (newPrefix - base.prefix);
  if (count > 1024) return null; // keep the visualization sane
  const blocks: SubnetBlock[] = [];
  for (let i = 0; i < count; i++) {
    const net = (base.networkInt + i * childSize) >>> 0;
    const bc = (net + childSize - 1) >>> 0;
    blocks.push({
      network: formatIp(net), broadcast: formatIp(bc), prefix: newPrefix, networkInt: net,
      usableHosts: newPrefix >= 31 ? childSize : childSize - 2,
    });
  }
  return blocks;
}
