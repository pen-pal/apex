// The rsync algorithm — how you sync a changed file to a remote copy by sending only the DIFFERENCES, without
// either side knowing in advance what changed, and without transferring the whole file to compare. It's the
// engine of `rsync`, of backup tools, and of how Dropbox-style sync avoids re-uploading a 2 GB file because you
// edited one line. The clever part is that the two machines never see each other's data up front. The RECEIVER
// (which holds the OLD file) chops it into fixed-size blocks and, for each, computes two checksums: a cheap
// ROLLING (weak) one and an expensive STRONG one, and ships just that little table of checksums to the sender.
// The SENDER (which holds the NEW file) then slides a block-sized window one byte at a time across its file,
// updating the rolling checksum in O(1) per step (that's the whole trick — the weak checksum can be updated by
// subtracting the byte leaving the window and adding the byte entering it, à la Rabin/Adler). Whenever the
// rolling value matches one in the table, it confirms with the strong checksum, and on a real match emits
// "copy block N from the file you already have" and jumps the window forward a full block; otherwise it emits
// the single literal byte and rolls on. The result is a compact stream of COPY references and literal runs that
// the receiver replays against its old file to rebuild the new one exactly — moving only the bytes that are
// genuinely new, even when edits shift everything downstream. This models the checksums, the rolling window,
// and the delta. Reference: Tridgell & Mackerras, "The rsync algorithm" (1996).

const M = 65536;
export type Op = { type: 'copy'; block: number } | { type: 'literal'; data: string };

/** Weak rolling checksum of s[start .. start+len) computed from scratch (the rsync a/b construction). */
export function weak(s: string, start: number, len: number): number {
  let a = 0, b = 0;
  for (let k = 0; k < len; k++) { const x = s.charCodeAt(start + k); a = (a + x) % M; b = (b + (len - k) * x) % M; }
  return (a + M * b) >>> 0;
}

/** Strong checksum (a stand-in for MD5/xxHash) to confirm a weak match isn't a collision. */
export function strong(s: string, start: number, len: number): number {
  let h = 2166136261 >>> 0;
  for (let k = 0; k < len; k++) { h ^= s.charCodeAt(start + k); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}

/** The receiver's block-checksum table: weak → list of {block index, strong}. */
export function blockTable(old: string, B: number): Map<number, { j: number; st: number }[]> {
  const table = new Map<number, { j: number; st: number }[]>();
  const n = Math.floor(old.length / B);
  for (let j = 0; j < n; j++) {
    const w = weak(old, j * B, B);
    (table.get(w) ?? table.set(w, []).get(w)!).push({ j, st: strong(old, j * B, B) });
  }
  return table;
}

/** Sender: slide over `next`, matching blocks of `old` via the rolling checksum, and emit the delta. */
export function computeDelta(old: string, next: string, B: number): Op[] {
  const table = blockTable(old, B);
  const delta: Op[] = [];
  let lit = '';
  let i = 0, a = 0, b = 0;
  const s = () => (a + M * b) >>> 0;
  const recompute = (pos: number) => { a = 0; b = 0; for (let k = 0; k < B; k++) { const x = next.charCodeAt(pos + k); a = (a + x) % M; b = (b + (B - k) * x) % M; } };
  if (next.length >= B) recompute(0);

  while (i < next.length) {
    if (i + B <= next.length) {
      const cands = table.get(s());
      const hit = cands ? cands.find((c) => c.st === strong(next, i, B)) : undefined;
      if (hit) {
        if (lit) { delta.push({ type: 'literal', data: lit }); lit = ''; }
        delta.push({ type: 'copy', block: hit.j });
        i += B;
        if (i + B <= next.length) recompute(i);
      } else {
        const out = next.charCodeAt(i);
        lit += next[i];
        if (i + B < next.length) { // roll the window one byte forward
          const inp = next.charCodeAt(i + B);
          a = ((a - out + inp) % M + M) % M;
          b = ((b - B * out + a) % M + M) % M;
        }
        i++;
      }
    } else { lit += next[i]; i++; }
  }
  if (lit) delta.push({ type: 'literal', data: lit });
  return delta;
}

/** Receiver: replay the delta against the old file to rebuild the new one. */
export function reconstruct(old: string, delta: Op[], B: number): string {
  let out = '';
  for (const op of delta) out += op.type === 'copy' ? old.slice(op.block * B, op.block * B + B) : op.data;
  return out;
}

/** Bytes actually transferred: literal bytes + a few bytes per copy reference (vs the whole new file). */
export function transferred(delta: Op[], copyRefBytes = 4): number {
  return delta.reduce((n, op) => n + (op.type === 'literal' ? op.data.length : copyRefBytes), 0);
}
