// TLS cipher-suite negotiation and the downgrade attack. The client offers a list
// of suites in preference order; the server picks the strongest it also supports.
// An active attacker who can edit the ClientHello strips the strong options, forcing
// a weak or export-grade suite the attacker can then break — FREAK, Logjam, POODLE,
// Sweet32 all worked this way. The defense is integrity over the whole handshake:
// TLS's Finished MAC covers the transcript, and a 1.3 server stamps a downgrade
// sentinel into ServerRandom, so any tampering is detected. Pure model (tested).

export type Strength = 'strong' | 'legacy' | 'weak' | 'broken';
export const RANK: Record<Strength, number> = { strong: 3, legacy: 2, weak: 1, broken: 0 };

export interface Suite {
  id: string;
  fs: boolean; // forward secrecy (ephemeral key exchange)?
  enc: string;
  strength: Strength;
  attack?: string; // the historical break this suite enables
}

// Strongest → weakest. Real suite names.
export const SUITES: Suite[] = [
  { id: 'TLS_AES_256_GCM_SHA384', fs: true, enc: 'AES-256-GCM', strength: 'strong' },
  { id: 'TLS_CHACHA20_POLY1305_SHA256', fs: true, enc: 'ChaCha20-Poly1305', strength: 'strong' },
  { id: 'TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256', fs: true, enc: 'AES-128-GCM', strength: 'strong' },
  { id: 'TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA', fs: true, enc: 'AES-128-CBC + SHA1', strength: 'legacy', attack: 'CBC/SHA-1: BEAST, Lucky13' },
  { id: 'TLS_RSA_WITH_AES_128_CBC_SHA', fs: false, enc: 'AES-128-CBC + SHA1', strength: 'legacy', attack: 'RSA key exchange: no forward secrecy' },
  { id: 'TLS_RSA_WITH_3DES_EDE_CBC_SHA', fs: false, enc: '3DES-CBC', strength: 'weak', attack: 'Sweet32 (64-bit block birthday)' },
  { id: 'TLS_RSA_WITH_RC4_128_SHA', fs: false, enc: 'RC4', strength: 'weak', attack: 'RC4 keystream biases' },
  { id: 'TLS_RSA_EXPORT_WITH_RC4_40_MD5', fs: false, enc: 'RC4-40 (export)', strength: 'broken', attack: 'FREAK — 40-bit RSA export' },
  { id: 'TLS_DHE_RSA_EXPORT_WITH_DES40_CBC_SHA', fs: true, enc: 'DES-40 (export)', strength: 'broken', attack: 'Logjam — 512-bit export DH' },
];

/** The server picks the strongest suite that appears in BOTH lists. */
export function negotiate(offered: Suite[], serverSupports: Suite[]): Suite | null {
  const ids = new Set(serverSupports.map((s) => s.id));
  const mutual = offered.filter((s) => ids.has(s.id));
  if (mutual.length === 0) return null;
  return mutual.reduce((best, s) => (RANK[s.strength] > RANK[best.strength] ? s : best));
}

/** An on-path attacker rewrites the ClientHello, dropping anything stronger than `cap`. */
export function strip(offered: Suite[], cap: Strength): Suite[] {
  return offered.filter((s) => RANK[s.strength] <= RANK[cap]);
}

/** Was the client forced below what it would have gotten untouched? Integrity (the
 *  Finished MAC over the transcript) is what lets the endpoints notice. */
export function isDowngrade(unmolested: Suite | null, actual: Suite | null): boolean {
  if (!unmolested || !actual) return false;
  return RANK[actual.strength] < RANK[unmolested.strength];
}
