// Magnet links & the infohash — trackerless torrents. A .torrent file needs a tracker AND ships the metadata file
// itself. A MAGNET link needs neither: it carries only the INFOHASH — the SHA-1 of the torrent's "info" dictionary
// (the piece list, sizes, names). The infohash is a CONTENT ADDRESS: it names the exact bytes, so any tampering
// yields a different hash, and it's all a client needs to (1) find peers via the DHT — get_peers(infohash), no
// tracker — and (2) fetch the metadata from those peers (BEP-9), verifying it against the infohash, then download
// the file (BEP-3). No central server to seize; the "address" is just a 160-bit number.
import { sha1 } from './sha1';
import { toHex } from './hashing';

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
export function metadataVerifies(requestedInfohash: string, receivedInfohash: string): boolean {
  return requestedInfohash.toLowerCase() === receivedInfohash.toLowerCase();
}

// ---- The real thing: derive the infohash from content, so tampering visibly changes the address. ----

type Bencodable = number | string | Uint8Array | Bencodable[] | { [k: string]: Bencodable };
const te = new TextEncoder();
const bytesOf = (s: string) => te.encode(s);
function cat(chunks: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}

// Bencode (BEP-3): integers as i<n>e, byte-strings as <len>:<bytes>, lists as l…e, dicts as d…e with keys sorted
// by raw byte order. This is the exact canonical encoding a real client hashes to get an infohash.
export function bencode(v: Bencodable): Uint8Array {
  if (typeof v === 'number') {
    if (!Number.isInteger(v)) throw new Error('bencode: integers only');
    return bytesOf(`i${v}e`);
  }
  if (typeof v === 'string') return bencode(bytesOf(v));
  if (v instanceof Uint8Array) return cat([bytesOf(`${v.length}:`), v]);
  if (Array.isArray(v)) return cat([bytesOf('l'), ...v.map(bencode), bytesOf('e')]);
  const parts: Uint8Array[] = [bytesOf('d')];
  for (const k of Object.keys(v).sort()) { parts.push(bencode(k)); parts.push(bencode(v[k])); }
  parts.push(bytesOf('e'));
  return cat(parts);
}

// Split the file into fixed-size pieces and SHA-1 each — this list is what the info dict commits to.
export function pieceHashes(data: Uint8Array, pieceLen: number): Uint8Array[] {
  const out: Uint8Array[] = [];
  for (let i = 0; i < data.length; i += pieceLen) out.push(sha1(data.slice(i, i + pieceLen)));
  return out;
}

// The single-file "info" dictionary (BEP-3), bencoded. `pieces` is the concatenation of the 20-byte piece SHA-1s.
export function infoDict(name: string, pieceLen: number, data: Uint8Array): Uint8Array {
  const pieces = cat(pieceHashes(data, pieceLen));
  return bencode({ length: data.length, name, 'piece length': pieceLen, pieces });
}

// The infohash = SHA-1 of the bencoded info dict. Flip one content bit → the piece hash changes → the info dict
// changes → the infohash changes. That is what "content address" means, and why a poisoned copy can't impersonate one.
export function infohashOf(name: string, pieceLen: number, data: Uint8Array): string {
  return toHex(sha1(infoDict(name, pieceLen, data)));
}

// A received piece is trusted only if its SHA-1 equals the hash the info dict already committed to.
export function pieceVerifies(piece: Uint8Array, expectedHashHex: string): boolean {
  return toHex(sha1(piece)) === expectedHashHex.toLowerCase();
}
