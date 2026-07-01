// Piece table — the data structure a real text editor (VS Code, and historically Word) uses to represent the
// document you're editing. The naive approach — keep the text in one big string/array and splice on every
// keystroke — is O(n) per edit (you shift everything after the cursor) and makes undo awkward. A piece table
// flips it around with two insights. (1) The ORIGINAL text is loaded once and NEVER mutated — it's read-only.
// (2) Everything you type goes into a separate APPEND-ONLY "add" buffer that also never has anything removed.
// The document itself is then just an ordered list of PIECES, each a (which-buffer, start, length) span into
// one of those two immutable buffers. Inserting text = append it to the add buffer and splice one descriptor
// into the piece list; deleting = shrink/split descriptors. The actual character data never moves. Because no
// bytes are ever overwritten, undo/redo is almost free (you keep old piece lists), edits are cheap, and the
// original file can even stay memory-mapped. The cost is that reading the Nth character means walking the piece
// list (editors keep a balanced tree / line cache over the pieces to make that fast too). This models the two
// buffers and the piece list directly. Reference: Crowley, "Data Structures for Text Sequences" (1998); the
// VS Code text-buffer reimplementation write-up.

export type BufferName = 'orig' | 'add';
export interface Piece { buffer: BufferName; start: number; len: number }

export class PieceTable {
  readonly orig: string;   // the immutable original buffer
  add = '';                // the append-only add buffer
  pieces: Piece[] = [];    // the document, as spans into orig/add

  constructor(text: string) {
    this.orig = text;
    if (text.length) this.pieces.push({ buffer: 'orig', start: 0, len: text.length });
  }

  private bufFor(b: BufferName): string { return b === 'orig' ? this.orig : this.add; }

  /** The current document text — walk the pieces and concatenate their spans. */
  getText(): string {
    return this.pieces.map((p) => this.bufFor(p.buffer).slice(p.start, p.start + p.len)).join('');
  }

  get length(): number { return this.pieces.reduce((n, p) => n + p.len, 0); }

  /** Ensure a piece boundary exists exactly at document position `pos`, splitting a piece if needed.
   *  Returns the piece index at which content from `pos` onward begins. */
  private splitAt(pos: number): number {
    if (pos <= 0) return 0;
    let acc = 0;
    for (let i = 0; i < this.pieces.length; i++) {
      const p = this.pieces[i];
      if (acc === pos) return i;                 // boundary already at the start of piece i
      if (acc + p.len === pos) return i + 1;     // boundary at the end of piece i
      if (acc + p.len > pos) {                    // pos is interior to piece i → split it
        const left = pos - acc;
        this.pieces.splice(i, 1,
          { buffer: p.buffer, start: p.start, len: left },
          { buffer: p.buffer, start: p.start + left, len: p.len - left });
        return i + 1;
      }
      acc += p.len;
    }
    return this.pieces.length;                    // pos at or past the end
  }

  /** Insert `text` at document position `pos`. Appends to the add buffer; never touches existing data. */
  insert(pos: number, text: string): void {
    if (text.length === 0) return;
    const addStart = this.add.length;
    this.add += text;                             // append-only
    const i = this.splitAt(Math.max(0, Math.min(pos, this.length)));
    this.pieces.splice(i, 0, { buffer: 'add', start: addStart, len: text.length });
  }

  /** Delete `count` characters starting at `pos`. Only descriptors change; no character data is removed. */
  delete(pos: number, count: number): void {
    if (count <= 0) return;
    const start = Math.max(0, Math.min(pos, this.length));
    const end = Math.max(0, Math.min(pos + count, this.length));
    if (end <= start) return;
    const i = this.splitAt(start);
    const j = this.splitAt(end);
    this.pieces.splice(i, j - i);                 // drop the descriptors covering [start, end)
  }
}
