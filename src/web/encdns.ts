// Encrypted DNS — what an on-path observer can still see. Classic DNS (Do53) is
// plaintext on port 53, so every name you resolve is visible to your network, ISP,
// and anyone between. DoT, DoH and DoQ wrap the same DNS messages in TLS/QUIC so
// the names go opaque — but they differ in how much they still reveal: DoT/DoQ ride
// a dedicated port 853 that announces "this is DNS", while DoH hides inside ordinary
// HTTPS on 443. We never invent decrypted plaintext for the wrapped transports —
// the wire shows only the encrypted-record shape, per the project's honesty rule.

export type TransportId = 'Do53' | 'DoT' | 'DoH' | 'DoQ';

export interface Transport {
  id: TransportId;
  label: string;
  port: number;
  l4: string; // transport layer
  wrap: string; // what the DNS message is wrapped in
  encrypted: boolean;
  // what an on-path eavesdropper can learn:
  sees: { name: boolean; isDns: boolean; resolver: boolean };
  blurb: string;
}

export const TRANSPORTS: Transport[] = [
  {
    id: 'Do53', label: 'Classic DNS (Do53)', port: 53, l4: 'UDP / TCP', wrap: 'none', encrypted: false,
    sees: { name: true, isDns: true, resolver: true },
    blurb: 'Plaintext on port 53 — every name you look up is visible to your network, ISP and anyone on path. It is what DNS-based blocking filters on, and what Kaminsky cache-poisoning forges.',
  },
  {
    id: 'DoT', label: 'DNS over TLS (DoT)', port: 853, l4: 'TCP', wrap: 'TLS', encrypted: true,
    sees: { name: false, isDns: true, resolver: true },
    blurb: 'DNS messages inside TLS on a dedicated port 853. The names are hidden, but the dedicated port still says “this is DNS”, so a network can throttle or block it wholesale (RFC 7858).',
  },
  {
    id: 'DoH', label: 'DNS over HTTPS (DoH)', port: 443, l4: 'TCP', wrap: 'HTTPS', encrypted: true,
    sees: { name: false, isDns: false, resolver: true },
    blurb: 'DNS wrapped in ordinary HTTPS on port 443 — indistinguishable from web traffic, so it is the hardest to single out and block (RFC 8484). The resolver hostname can still leak via the TLS SNI unless Encrypted ClientHello hides it.',
  },
  {
    id: 'DoQ', label: 'DNS over QUIC (DoQ)', port: 853, l4: 'QUIC (UDP)', wrap: 'QUIC + TLS', encrypted: true,
    sees: { name: false, isDns: true, resolver: true },
    blurb: 'Like DoT but over QUIC on UDP 853: encrypted, 0-RTT resumption, and no head-of-line blocking between queries (RFC 9250). Same port-853 visibility as DoT.',
  },
];

export const byId = (id: TransportId): Transport => TRANSPORTS.find((t) => t.id === id)!;

export interface WireRow { label: string; value: string; opaque: boolean }

/** What an on-path observer actually captures for a lookup of `qname`. */
export function wireView(t: Transport, qname: string): WireRow[] {
  const head: WireRow = { label: t.l4, value: `→ resolver : ${t.port}`, opaque: false };
  if (!t.encrypted) {
    return [
      head,
      { label: 'DNS query', value: `A? ${qname}`, opaque: false },
      { label: 'DNS answer', value: `${qname}  A  93.184.216.34`, opaque: false },
    ];
  }
  return [
    head,
    { label: `${t.wrap} record`, value: '«encrypted application data» ‖ length ‖ auth tag', opaque: true },
  ];
}
