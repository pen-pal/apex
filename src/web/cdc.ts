// Content-Defined Chunking (CDC) — how rsync, restic, borg, Dropbox and ZFS dedup avoid re-sending data
// that barely changed. Split a file into chunks and store/transfer each chunk only once (keyed by its
// hash). The catch is WHERE to cut. Fixed-size chunking (every N bytes) is catastrophically fragile: insert
// ONE byte at the front and every subsequent boundary shifts, so every chunk hash changes and nothing
// dedupes — "the boundary-shift problem". CDC instead cuts where the *content* says to: roll a hash over a
// small sliding window and place a boundary whenever the low bits hit a target pattern. Because the
// decision depends only on local bytes, an edit perturbs just the chunk(s) it touches; every other
// boundary — and chunk — survives. That's what makes incremental backup and sync cheap. References:
// Muthitacharoen et al., LBFS (SOSP 2001); the Rabin-fingerprint CDC family.

export interface Chunk { start: number; len: number; hash: number }

const WINDOW = 4;     // rolling-hash window (bytes)
const BASE = 257;     // polynomial base

const fnv = (bytes: number[], start: number, len: number): number => {
  let h = 0x811c9dc5 >>> 0;
  for (let i = start; i < start + len; i++) { h ^= bytes[i]; h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
};

/** Fixed-size chunking: cut every `size` bytes, no matter the content. Simple, and fragile under edits. */
export function fixedChunks(bytes: number[], size: number): Chunk[] {
  const out: Chunk[] = [];
  for (let s = 0; s < bytes.length; s += size) {
    const len = Math.min(size, bytes.length - s);
    out.push({ start: s, len, hash: fnv(bytes, s, len) });
  }
  return out;
}

/** Content-defined chunking: a continuous rolling hash over a WINDOW-byte window places a boundary wherever
 *  (hash & mask) === 0, with min/max length guards. `avgSize` sets the mask (avgSize-1), so boundaries land
 *  on average every avgSize bytes. Boundaries depend only on local content → shift-resistant. */
export function cdcChunks(bytes: number[], opts: { minSize: number; avgSize: number; maxSize: number }): Chunk[] {
  const { minSize, avgSize, maxSize } = opts;
  const mask = avgSize - 1; // avgSize must be a power of two for an even distribution
  let bw = 1; for (let k = 0; k < WINDOW; k++) bw = Math.imul(bw, BASE) >>> 0; // BASE^WINDOW
  const out: Chunk[] = [];
  let start = 0, h = 0;
  for (let i = 0; i < bytes.length; i++) {
    h = (Math.imul(h, BASE) + bytes[i]) >>> 0;            // add the new byte
    if (i >= WINDOW) h = (h - Math.imul(bytes[i - WINDOW], bw)) >>> 0; // drop the byte leaving the window
    const len = i - start + 1;
    const hitBoundary = len >= minSize && i >= WINDOW && (h & mask) === 0;
    if (hitBoundary || len >= maxSize) {
      out.push({ start, len, hash: fnv(bytes, start, len) });
      start = i + 1; // keep rolling h continuously — that's what makes boundaries content-local
    }
  }
  if (start < bytes.length) out.push({ start, len: bytes.length - start, hash: fnv(bytes, start, bytes.length - start) });
  return out;
}

/** Dedup overlap between two chunk lists: how many of `b`'s chunks already exist in `a` (matched by hash),
 *  and the fraction of b's bytes that need not be stored/sent again. */
export function dedup(a: Chunk[], b: Chunk[]): { reused: number; total: number; bytesReused: number; bytesTotal: number } {
  const have = new Map<number, number>();
  for (const c of a) have.set(c.hash, (have.get(c.hash) ?? 0) + 1);
  let reused = 0, bytesReused = 0, bytesTotal = 0;
  const remaining = new Map(have);
  for (const c of b) {
    bytesTotal += c.len;
    const n = remaining.get(c.hash) ?? 0;
    if (n > 0) { reused++; bytesReused += c.len; remaining.set(c.hash, n - 1); }
  }
  return { reused, total: b.length, bytesReused, bytesTotal };
}
