// Piece table, made visible. The document you see is stitched together from spans (pieces) into two immutable
// buffers: the read-only ORIGINAL and the append-only ADD buffer where everything you type lands. Insert some
// text and watch a piece split; delete and watch descriptors shrink — while the character data in both buffers
// never changes. Undo is just dropping the last operation, because nothing was ever overwritten. Each character
// below is tinted by which buffer it comes from. Real model from piecetable.ts.
import { useMemo, useState } from 'react';
import { PieceTable } from './piecetable';

type Op = { kind: 'ins'; pos: number; text: string } | { kind: 'del'; pos: number; count: number };
const INITIAL = 'The brown fox.';
const show = (s: string) => s.replace(/ /g, '·'); // make spaces visible

export function PieceTableSection() {
  const [ops, setOps] = useState<Op[]>([]);
  const [insPos, setInsPos] = useState(4);
  const [insText, setInsText] = useState('quick ');
  const [delPos, setDelPos] = useState(0);
  const [delCount, setDelCount] = useState(4);

  const pt = useMemo(() => {
    const t = new PieceTable(INITIAL);
    for (const o of ops) o.kind === 'ins' ? t.insert(o.pos, o.text) : t.delete(o.pos, o.count);
    return t;
  }, [ops]);

  const doIns = () => { if (insText) setOps((o) => [...o, { kind: 'ins', pos: insPos, text: insText }]); };
  const doDel = () => setOps((o) => [...o, { kind: 'del', pos: delPos, count: delCount }]);
  const undo = () => setOps((o) => o.slice(0, -1));
  const reset = () => setOps([]);

  const bufOf = (p: { buffer: string; start: number; len: number }) => (p.buffer === 'orig' ? pt.orig : pt.add).slice(p.start, p.start + p.len);

  return (
    <div className="ptb">
      <p className="ptb-intro">
        A text editor never really "inserts into the middle" of your file. The <strong>original</strong> buffer
        is loaded once and never changed; every keystroke is appended to a separate <strong>add</strong> buffer;
        and the document is just an ordered list of <strong>pieces</strong> — spans into those two buffers. Edit
        below and watch the pieces re-stitch while the character data stays put:
      </p>

      <div className="ptb-doc-wrap">
        <span className="ptb-doc-label">document</span>
        <div className="ptb-doc">
          {pt.pieces.map((p, i) => <span key={i} className={`ptb-span ${p.buffer}`}>{show(bufOf(p))}</span>)}
          {pt.length === 0 && <span className="ptb-doc-empty">(empty)</span>}
        </div>
      </div>

      <div className="ptb-controls">
        <div className="ptb-ctl">
          <span className="ptb-op ins">insert</span>
          <input type="text" className="ptb-in text" value={insText} onChange={(e) => setInsText(e.target.value)} />
          <label>at<input type="number" className="ptb-in num" value={insPos} onChange={(e) => setInsPos(+e.target.value)} /></label>
          <button type="button" className="ptb-go" onClick={doIns}>↵</button>
        </div>
        <div className="ptb-ctl">
          <span className="ptb-op del">delete</span>
          <label>at<input type="number" className="ptb-in num" value={delPos} onChange={(e) => setDelPos(+e.target.value)} /></label>
          <label>×<input type="number" className="ptb-in num" value={delCount} onChange={(e) => setDelCount(+e.target.value)} /></label>
          <button type="button" className="ptb-go" onClick={doDel}>✕</button>
        </div>
        <button type="button" className="ptb-undo" disabled={ops.length === 0} onClick={undo}>↶ undo</button>
        <button type="button" className="ptb-reset" onClick={reset}>reset</button>
      </div>

      <div className="ptb-buffers">
        <div className="ptb-buf orig">
          <div className="ptb-buf-h">original buffer <i>read-only</i></div>
          <div className="ptb-buf-text">{show(pt.orig) || '∅'}</div>
        </div>
        <div className="ptb-buf add">
          <div className="ptb-buf-h">add buffer <i>append-only</i></div>
          <div className="ptb-buf-text">{show(pt.add) || '∅'}</div>
        </div>
      </div>

      <div className="ptb-pieces-wrap">
        <span className="ptb-doc-label">pieces</span>
        <div className="ptb-pieces">
          {pt.pieces.map((p, i) => (
            <span key={i} className={`ptb-piece ${p.buffer}`}>{p.buffer} [{p.start}‥{p.start + p.len}) <i>“{show(bufOf(p))}”</i></span>
          ))}
          {pt.pieces.length === 0 && <span className="ptb-doc-empty">(no pieces)</span>}
        </div>
      </div>

      <div className="ptb-stats">
        <div className="ptb-stat"><span>pieces</span><b>{pt.pieces.length}</b></div>
        <div className="ptb-stat"><span>original bytes</span><b>{pt.orig.length}</b></div>
        <div className="ptb-stat"><span>add bytes (only grows)</span><b>{pt.add.length}</b></div>
        <div className="ptb-stat"><span>edits (undoable)</span><b>{ops.length}</b></div>
      </div>

      <p className="ptb-foot">
        One rule, <em>never overwrite</em>, cascades into cheap everything. Edits append a few bytes and splice a
        descriptor instead of shifting the file's tail. <strong>Undo and redo</strong> are nearly free: no bytes
        were destroyed, so you keep old versions of the piece list and the deleted text still sits in a buffer,
        merely unreferenced. The original file stays <strong>memory-mapped</strong> and read-only, so opening a huge
        file is instant, and because pieces are immutable spans you get cheap snapshots for collaborative editing
        and re-highlighting. The cost is random access: finding "the character at offset k" means walking the piece
        list, so editors layer a <strong>balanced tree</strong> (a red-black tree of pieces keyed by length and line
        count) to make position and line queries O(log n) — exactly what VS Code did when it replaced its line-array
        buffer with a piece tree to open gigabyte files. The list fragments over a long session, so editors compact
        periodically. Cousins solve the same problem differently: a <strong>gap buffer</strong> (Emacs) keeps a
        movable hole at the cursor, good for local typing and worse for scattered edits; a <strong>rope</strong> is
        a balanced tree of string chunks. (Crowley 1998; the VS Code text-buffer write-up.)
      </p>
    </div>
  );
}
