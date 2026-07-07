// Censorship circumvention — how a blocked user still reaches Tor. A national firewall stacks three kinds of block,
// and each is defeated by one technique:
//   1. DEEP PACKET INSPECTION fingerprints Tor's TLS handshake → beaten by a PLUGGABLE TRANSPORT (obfs4) that makes
//      the stream look like uniformly random bytes with no recognisable protocol.
//   2. A BLOCKLIST of the public Tor relays (the directory is public) → beaten by a BRIDGE: an unlisted entry relay
//      handed out out-of-band, so it isn't on the list.
//   3. SNI FILTERING blocks connections whose TLS SNI names a forbidden host → beaten by DOMAIN FRONTING: the outer
//      SNI names a big CDN the censor won't dare block (collateral damage), the real host hides in the inner request.
// To pass a firewall doing all three you need all three techniques — layered, exactly like the real arms race.

export type Conn = { obfuscated: boolean; bridge: boolean; fronted: boolean };
export type Censor = { dpi: boolean; blocklist: boolean; sniFilter: boolean };

export type Verdict = { blocked: boolean; by: string | null; stage: number };

// Checked in path order (DPI first at the packet layer, then the relay blocklist, then the SNI). Returns the first
// check that stops the connection, or a clear pass.
export function verdict(c: Conn, z: Censor): Verdict {
  if (z.dpi && !c.obfuscated) return { blocked: true, stage: 0, by: 'DPI fingerprinted the Tor TLS handshake' };
  if (z.blocklist && !c.bridge) return { blocked: true, stage: 1, by: 'the entry relay is on the public blocklist' };
  if (z.sniFilter && !c.fronted) return { blocked: true, stage: 2, by: 'the TLS SNI names a blocked host' };
  return { blocked: false, stage: 3, by: null };
}

export const FULL_CENSOR: Censor = { dpi: true, blocklist: true, sniFilter: true };
