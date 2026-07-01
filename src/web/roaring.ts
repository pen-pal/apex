// Roaring bitmaps — how databases store a set of millions of integer IDs compactly AND intersect two of them
// at memory speed. A plain bitmap over a 32-bit key space is 512 MB whether you store 3 IDs or 3 billion; a
// sorted array is tiny for 3 IDs but slow to intersect. Roaring gets the best of both by splitting the key
// space into 2^16 "chunks" (the high 16 bits pick the chunk; the low 16 bits are the position inside it) and
// storing each chunk in whichever CONTAINER is smallest for its density:
//   • array container  — a sorted list of the low-16-bit values, when the chunk is sparse (≤ 4096 values)
//   • bitmap container — a flat 2^16-bit (8 KB) bitmap, when the chunk is dense
// (real Roaring adds a third "run" container for long consecutive spans; we model the two main ones.) Because
// every chunk is bounded to 65536 values, operations stay cache-friendly, and AND/OR run container-by-chunk —
// array∩array by merge, bitmap∩bitmap by word AND — so intersecting two huge sets touches only shared chunks.
// It's the workhorse index format in Lucene/Elasticsearch, Druid, ClickHouse, Spark. Reference: Lemire et al.,
// "Better bitmap performance with Roaring bitmaps" (2016).

const CHUNK = 65536;          // values per chunk (low 16 bits)
const ARRAY_MAX = 4096;       // above this, an array container is bigger than a bitmap → convert

type ArrayC = { kind: 'array'; values: number[] };          // sorted, distinct uint16
type BitmapC = { kind: 'bitmap'; words: Uint8Array };        // 8192 bytes = 65536 bits
type Container = ArrayC | BitmapC;

const hi = (key: number) => Math.floor(key / CHUNK);
const lo = (key: number) => key % CHUNK;

export class Roaring {
  private chunks = new Map<number, Container>();

  add(key: number): void {
    const h = hi(key), l = lo(key);
    let c = this.chunks.get(h);
    if (!c) { c = { kind: 'array', values: [] }; this.chunks.set(h, c); }
    if (c.kind === 'array') {
      const i = lowerBound(c.values, l);
      if (c.values[i] === l) return;             // already present
      c.values.splice(i, 0, l);
      if (c.values.length > ARRAY_MAX) this.chunks.set(h, toBitmap(c)); // densified → switch container
    } else {
      c.words[l >> 3] |= 1 << (l & 7);
    }
  }

  has(key: number): boolean {
    const c = this.chunks.get(hi(key)); if (!c) return false;
    const l = lo(key);
    return c.kind === 'array' ? c.values[lowerBound(c.values, l)] === l : (c.words[l >> 3] & (1 << (l & 7))) !== 0;
  }

  cardinality(): number {
    let n = 0;
    for (const c of this.chunks.values()) n += count(c);
    return n;
  }

  /** All present keys, ascending — for checking against a ground-truth set. */
  toArray(): number[] {
    const out: number[] = [];
    for (const h of [...this.chunks.keys()].sort((a, b) => a - b)) {
      const c = this.chunks.get(h)!;
      if (c.kind === 'array') for (const l of c.values) out.push(h * CHUNK + l);
      else for (let l = 0; l < CHUNK; l++) if (c.words[l >> 3] & (1 << (l & 7))) out.push(h * CHUNK + l);
    }
    return out;
  }

  /** Per-chunk container report — the whole point of Roaring: which representation each chunk chose. */
  containers(): { chunk: number; kind: 'array' | 'bitmap'; count: number; bytes: number }[] {
    return [...this.chunks.entries()].sort((a, b) => a[0] - b[0]).map(([chunk, c]) => ({
      chunk, kind: c.kind, count: count(c),
      bytes: c.kind === 'array' ? c.values.length * 2 : 8192, // uint16 each vs a flat 8 KB bitmap
    }));
  }

  static from(keys: number[]): Roaring { const r = new Roaring(); for (const k of keys) r.add(k); return r; }
  static or(a: Roaring, b: Roaring): Roaring { return Roaring.from([...a.toArray(), ...b.toArray()]); }
  static and(a: Roaring, b: Roaring): Roaring {
    const out = new Roaring(); for (const k of a.toArray()) if (b.has(k)) out.add(k); return out;
  }
}

function lowerBound(arr: number[], v: number): number {
  let lo2 = 0, hi2 = arr.length;
  while (lo2 < hi2) { const m = (lo2 + hi2) >> 1; if (arr[m] < v) lo2 = m + 1; else hi2 = m; }
  return lo2;
}
function toBitmap(a: ArrayC): BitmapC {
  const words = new Uint8Array(8192);
  for (const l of a.values) words[l >> 3] |= 1 << (l & 7);
  return { kind: 'bitmap', words };
}
function count(c: Container): number {
  if (c.kind === 'array') return c.values.length;
  let n = 0; for (const byte of c.words) n += popcount(byte); return n;
}
function popcount(b: number): number { let n = 0; while (b) { n += b & 1; b >>= 1; } return n; }
