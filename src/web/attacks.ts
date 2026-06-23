// Models for "attacks, made visible" — the numbers are real and sourced, so the
// danger is legible rather than hand-waved. Educational/defensive only.

// Bandwidth Amplification Factors from US-CERT alert TA14-017 (UDP-based reflection
// & amplification), plus the 2018 memcached event (≈1.35 Tbps against GitHub).
export interface Reflector {
  id: string;
  name: string;
  baf: number; // bandwidth amplification factor (response ÷ request)
  source: string;
}
export const REFLECTORS: Reflector[] = [
  { id: 'memcached', name: 'Memcached (UDP 11211)', baf: 51000, source: 'GitHub 2018, ~1.35 Tbps' },
  { id: 'ntp', name: 'NTP monlist (UDP 123)', baf: 556.9, source: 'US-CERT TA14-017 / CVE-2013-5211' },
  { id: 'chargen', name: 'CharGen (UDP 19)', baf: 358.8, source: 'US-CERT TA14-017' },
  { id: 'dns', name: 'DNS ANY (UDP 53)', baf: 54, source: 'US-CERT TA14-017 (28–54×)' },
  { id: 'ssdp', name: 'SSDP / UPnP (UDP 1900)', baf: 30.8, source: 'US-CERT TA14-017' },
  { id: 'snmp', name: 'SNMP GetBulk (UDP 161)', baf: 6.3, source: 'US-CERT TA14-017' },
];

/** Victim-facing flood (Gbps) from an attacker's uplink (Mbps) through a reflector. */
export function floodGbps(uplinkMbps: number, baf: number): number {
  return (uplinkMbps * baf) / 1000;
}

// ---- SYN flood: the half-open connection table ------------------------------

export interface SynFloodModel {
  backlog: number; // SYN-RECV slots available
  filledSlots: number; // slots a flood holds at steady state
  saturated: boolean; // is the backlog full (legit clients rejected)?
  fillSeconds: number; // time for the flood to fill an empty backlog
}

/**
 * A spoofed SYN leaves a half-open entry that lingers until the SYN-ACK retries
 * time out. If synRate × timeout exceeds the backlog, the table stays full and
 * legitimate handshakes are dropped — until SYN cookies are enabled.
 */
export function synFlood(backlog: number, synRatePerSec: number, holdSeconds: number): SynFloodModel {
  const wouldHold = synRatePerSec * holdSeconds;
  const filledSlots = Math.min(backlog, Math.round(wouldHold));
  return {
    backlog,
    filledSlots,
    saturated: wouldHold >= backlog,
    fillSeconds: synRatePerSec > 0 ? backlog / synRatePerSec : Infinity,
  };
}
