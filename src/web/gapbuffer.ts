// The gap buffer — the simplest fast way to edit text, and what Emacs has used for decades. Keep the whole
// document in one array, but leave a GAP of unused slots right where the cursor is. Typing a character drops it
// into the gap and shrinks the gap by one — O(1), no shifting. Backspace just grows the gap leftward; delete-
// forward grows it rightward. The only expensive operation is MOVING the cursor: to edit somewhere else you slide
// the gap there, copying the characters you pass over from one side of the gap to the other — O(distance). So a
// gap buffer is perfect for the overwhelmingly common case (a burst of edits clustered at one point: typing a
// word, a line) and merely okay when the cursor jumps around a large file. The logical text is just "everything
// before the gap" followed by "everything after the gap"; the gap itself holds garbage the reader skips. When the
// gap fills up, the buffer grows (allocate bigger, re-open a gap) — amortized O(1) like a dynamic array. It's the
// opposite trade from a rope (a tree, O(log n) everywhere) and a piece table (spans into an append-only log):
// the gap buffer bets that edits have locality, and wins big when they do. This models the array + gap, insert/
// delete/move-cursor, and the shift cost. Reference: the Emacs and Scintilla editing buffers.

export class GapBuffer {
  buf: (string | null)[];
  gapStart: number; gapEnd: number; // the gap is the half-open range [gapStart, gapEnd)
  shifts = 0;                        // characters copied across the gap (the cost of moving the cursor)

  constructor(text = '', gapSize = 8) {
    this.buf = [...text, ...Array(gapSize).fill(null)];
    this.gapStart = text.length;     // cursor (and gap) start at the end
    this.gapEnd = this.buf.length;
  }

  /** The logical document: text before the gap + text after it (the gap is skipped). */
  text(): string { return this.buf.slice(0, this.gapStart).join('') + this.buf.slice(this.gapEnd).join(''); }
  length(): number { return this.gapStart + (this.buf.length - this.gapEnd); }
  cursor(): number { return this.gapStart; }

  private grow(): void {
    const extra = Math.max(8, this.buf.length);       // double-ish (amortized O(1))
    const after = this.buf.slice(this.gapEnd);
    this.buf = [...this.buf.slice(0, this.gapStart), ...Array(extra).fill(null), ...after];
    this.gapEnd = this.gapStart + extra;
  }

  /** Move the gap (cursor) to logical position `pos`, sliding characters across it — O(|pos - cursor|). */
  moveTo(pos: number): void {
    pos = Math.max(0, Math.min(pos, this.length()));
    if (this.gapStart === this.gapEnd) { this.gapStart = this.gapEnd = pos; return; } // empty gap: buffer is packed, reposition is free
    while (this.gapStart > pos) { this.gapStart--; this.gapEnd--; this.buf[this.gapEnd] = this.buf[this.gapStart]; this.buf[this.gapStart] = null; this.shifts++; }
    while (this.gapStart < pos) { this.buf[this.gapStart] = this.buf[this.gapEnd]; this.buf[this.gapEnd] = null; this.gapStart++; this.gapEnd++; this.shifts++; }
  }

  /** Insert a character at the cursor — O(1) (just fill a gap slot). */
  insert(ch: string): void { if (this.gapStart === this.gapEnd) this.grow(); this.buf[this.gapStart++] = ch; }
  /** Backspace: swallow the character left of the cursor into the gap. */
  deleteBack(): void { if (this.gapStart > 0) { this.gapStart--; this.buf[this.gapStart] = null; } }
  /** Delete-forward: swallow the character right of the cursor. */
  deleteForward(): void { if (this.gapEnd < this.buf.length) { this.buf[this.gapEnd] = null; this.gapEnd++; } }
}
