// Turn the builder form into a real Connection. Pure and testable. Only fields
// that actually thread through to bytes are exposed — IPs, ports, TTL, window,
// and the TCP flags — so every control provably changes the frame.
import { DEFAULT_CONNECTION } from '../core/builder';
import type { Connection } from '../core/types';

export interface FlagSet { SYN: boolean; ACK: boolean; PSH: boolean; RST: boolean; FIN: boolean }

export interface ConnForm {
  srcIp: string;
  dstIp: string;
  srcPort: string;
  dstPort: string;
  ttl: string;
  window: string;
  flags: FlagSet;
}

export const DEFAULT_FORM: ConnForm = {
  srcIp: DEFAULT_CONNECTION.srcIp.join('.'),
  dstIp: DEFAULT_CONNECTION.dstIp.join('.'),
  srcPort: String(DEFAULT_CONNECTION.srcPort),
  dstPort: String(DEFAULT_CONNECTION.dstPort),
  ttl: String(DEFAULT_CONNECTION.ttl),
  window: String(DEFAULT_CONNECTION.window),
  // DEFAULT_CONNECTION.flags = 0x18 = PSH + ACK
  flags: { SYN: false, ACK: true, PSH: true, RST: false, FIN: false },
};

function parseIp(s: string): number[] | null {
  const parts = s.trim().split('.');
  if (parts.length !== 4) return null;
  const out: number[] = [];
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const n = Number(p);
    if (n > 255) return null;
    out.push(n);
  }
  return out;
}

function parseRange(s: string, min: number, max: number): number | null {
  if (!/^\d+$/.test(s.trim())) return null;
  const n = Number(s.trim());
  return n >= min && n <= max ? n : null;
}

/** TCP flags byte: bit layout CWR ECE URG ACK PSH RST SYN FIN (MSB→LSB). */
export function flagsByte(f: FlagSet): number {
  return (f.ACK ? 0x10 : 0) | (f.PSH ? 0x08 : 0) | (f.RST ? 0x04 : 0) | (f.SYN ? 0x02 : 0) | (f.FIN ? 0x01 : 0);
}

/** Build a Connection from the form, falling back to defaults per invalid field. */
export function buildConnection(form: ConnForm): { conn: Connection; errors: Partial<Record<keyof ConnForm, string>> } {
  const errors: Partial<Record<keyof ConnForm, string>> = {};

  const srcIp = parseIp(form.srcIp);
  if (!srcIp) errors.srcIp = 'IPv4 a.b.c.d';
  const dstIp = parseIp(form.dstIp);
  if (!dstIp) errors.dstIp = 'IPv4 a.b.c.d';
  const srcPort = parseRange(form.srcPort, 0, 65535);
  if (srcPort == null) errors.srcPort = '0–65535';
  const dstPort = parseRange(form.dstPort, 0, 65535);
  if (dstPort == null) errors.dstPort = '0–65535';
  const ttl = parseRange(form.ttl, 1, 255);
  if (ttl == null) errors.ttl = '1–255';
  const window = parseRange(form.window, 0, 65535);
  if (window == null) errors.window = '0–65535';

  const conn: Connection = {
    ...DEFAULT_CONNECTION,
    srcIp: srcIp ?? DEFAULT_CONNECTION.srcIp,
    dstIp: dstIp ?? DEFAULT_CONNECTION.dstIp,
    srcPort: srcPort ?? DEFAULT_CONNECTION.srcPort,
    dstPort: dstPort ?? DEFAULT_CONNECTION.dstPort,
    ttl: ttl ?? DEFAULT_CONNECTION.ttl,
    window: window ?? DEFAULT_CONNECTION.window,
    flags: flagsByte(form.flags),
  };
  return { conn, errors };
}
