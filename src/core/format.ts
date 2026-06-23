import type { Field, ParsedHeader } from './types';

export const ipv4ToString = (v: number): string =>
  [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255].join('.');

export const macToString = (v: number): string => {
  const out: string[] = [];
  for (let i = 5; i >= 0; i--) out.push((Math.floor(v / 2 ** (8 * i)) & 255).toString(16).padStart(2, '0'));
  return out.join(':');
};

export const flagsToString = (v: number, labels: string[]): string => {
  const set: string[] = [];
  const n = labels.length;
  for (let i = 0; i < n; i++) if ((v >> (n - 1 - i)) & 1) set.push(labels[i]);
  return set.length ? set.join(', ') : 'none';
};

const hex2 = (b: number) => b.toString(16).padStart(2, '0');

/** IPv6 address from 16 bytes, with RFC 5952 :: compression of the longest zero run. */
export const ipv6ToString = (bytes: number[]): string => {
  const groups: number[] = [];
  for (let i = 0; i < 16; i += 2) groups.push(((bytes[i] ?? 0) << 8) | (bytes[i + 1] ?? 0));
  // longest run of zero groups (length >= 2) becomes "::"
  let best = { start: -1, len: 0 };
  for (let i = 0; i < 8; ) {
    if (groups[i] !== 0) { i++; continue; }
    let j = i;
    while (j < 8 && groups[j] === 0) j++;
    if (j - i > best.len) best = { start: i, len: j - i };
    i = j;
  }
  const hex = groups.map((g) => g.toString(16));
  if (best.len < 2) return hex.join(':');
  const head = hex.slice(0, best.start).join(':');
  const tail = hex.slice(best.start + best.len).join(':');
  return `${head}::${tail}`;
};

export const bytesToHex = (bytes: number[]): string => bytes.map(hex2).join(' ');

export function formatValue(f: Field, value: number, bytes?: number[]): string {
  switch (f.type) {
    case 'ipv4': return ipv4ToString(value);
    case 'ipv6': return ipv6ToString(bytes ?? []);
    case 'bytes': return bytesToHex(bytes ?? []);
    case 'mac': return macToString(value);
    case 'hex': return '0x' + value.toString(16).toUpperCase().padStart(Math.ceil(f.bits / 4), '0');
    case 'flags': return f.flagBits ? flagsToString(value, f.flagBits) : value.toString(2);
    case 'enum': return f.enumMap && f.enumMap[value] !== undefined ? `${value} (${f.enumMap[value]})` : String(value);
    default: return String(value);
  }
}

export function fieldMeaning(f: Field, value: number, header: ParsedHeader): string | undefined {
  if (f.decode) return f.decode(value, header);
  if (f.type === 'enum' && f.enumMap && f.enumMap[value] !== undefined) return f.enumMap[value];
  return f.note;
}
