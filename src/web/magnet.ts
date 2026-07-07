// Magnet links & the infohash — trackerless torrents. A .torrent file needs a tracker AND ships the metadata file
// itself. A MAGNET link needs neither: it carries only the INFOHASH — the SHA-1 of the torrent's "info" dictionary
// (the piece list, sizes, names). The infohash is a CONTENT ADDRESS: it names the exact bytes, so any tampering
// yields a different hash, and it's all a client needs to (1) find peers via the DHT — get_peers(infohash), no
// tracker — and (2) fetch the metadata from those peers (BEP-9), verifying it against the infohash, then download
// the file (BEP-3). No central server to seize; the "address" is just a 160-bit number.

export type Magnet = { infohash: string; name?: string; trackers: string[] };

// Parse a magnet URI (BEP-9 xt=urn:btih:<40-hex or 32-base32>).
export function parseMagnet(uri: string): Magnet | null {
  if (!uri.startsWith('magnet:?')) return null;
  const params = new URLSearchParams(uri.slice('magnet:?'.length));
  const xt = params.get('xt') ?? '';
  const m = xt.match(/^urn:btih:([0-9a-fA-F]{40}|[0-9a-fA-F]{32})$/);
  if (!m) return null;
  return { infohash: m[1].toLowerCase(), name: params.get('dn') ?? undefined, trackers: params.getAll('tr') };
}

// A content address verifies: recompute the infohash of what you received and it must equal the one you asked for.
// (Here `hashOf` is supplied by the caller/test as the real hash; the model just checks equality — the point is that
// verification is possible at all, which is what makes an infohash tamper-evident.)
export function metadataVerifies(requestedInfohash: string, receivedInfohash: string): boolean {
  return requestedInfohash.toLowerCase() === receivedInfohash.toLowerCase();
}
