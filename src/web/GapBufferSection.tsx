// The gap buffer, made visible. The whole document sits in one array with a run of empty slots (the gap) at the
// cursor. Type and the character drops into the gap — no shifting. Move the cursor and the gap slides there,
// copying characters across it (the shift counter shows the cost). Real logic from gapbuffer.ts.
import { useRef, useState } from 'react';
import { GapBuffer } from './gapbuffer';

export function GapBufferSection() {
  const gb = useRef(new GapBuffer('The gap buffer', 6));
  const [, force] = useState(0);
  const [ch, setCh] = useState('!');
  const [note, setNote] = useState('the gap (dashed) sits at the cursor');
  const r = () => force((x) => x + 1);
  const g = gb.current;

  const ins = () => { const s = g.shifts; g.insert(ch || '·'); setNote(`inserted '${ch || '·'}' into the gap — ${g.shifts - s} shifts (O(1))`); r(); };
  const bs = () => { g.deleteBack(); setNote('backspace — the character left of the cursor joins the gap'); r(); };
  const df = () => { g.deleteForward(); setNote('delete-forward — the character right of the cursor joins the gap'); r(); };
  const move = (pos: number) => { const s = g.shifts; g.moveTo(pos); setNote(`moved cursor to ${pos} — ${g.shifts - s} characters slid across the gap`); r(); };
  const reset = () => { gb.current = new GapBuffer('The gap buffer', 6); setNote('reset'); r(); };

  const cells = g.buf.map((c, i) => ({ c, region: i < g.gapStart ? 'before' : i < g.gapEnd ? 'gap' : 'after' }));

  return (
    <div className="gbf">
      <p className="gbf-intro">
        A flat string shifts every later byte when you insert. A <strong>gap buffer</strong> keeps the document in
        one array with a run of empty slots — the <strong>gap</strong> — right at the cursor. Typing drops a
        character into the gap (<strong>O(1)</strong>, no shifting). The only costly move is relocating the cursor:
        the gap slides there, copying the characters it passes over — <strong>O(distance)</strong>.
      </p>

      <div className="gbf-text">“{g.text().replace(/ /g, '␣')}”</div>

      <div className="gbf-buf">
        {cells.map((cell, i) => (
          <span key={i} className={`gbf-cell ${cell.region}`}>{cell.region === 'gap' ? '' : (cell.c === ' ' ? '␣' : cell.c)}</span>
        ))}
      </div>
      <div className="gbf-legend"><span className="gbf-lg before">text before</span><span className="gbf-lg gap">gap (cursor)</span><span className="gbf-lg after">text after</span></div>

      <div className="gbf-controls">
        <input className="gbf-in" value={ch} maxLength={1} onChange={(e) => setCh(e.target.value)} />
        <button type="button" className="gbf-btn" onClick={ins}>type →</button>
        <button type="button" className="gbf-btn" onClick={bs}>⌫ backspace</button>
        <button type="button" className="gbf-btn" onClick={df}>delete →</button>
        <label className="gbf-move">cursor <input type="range" min={0} max={g.length()} value={g.cursor()} onChange={(e) => move(+e.target.value)} /> <b>{g.cursor()}</b></label>
        <button type="button" className="gbf-btn ghost" onClick={reset}>reset</button>
      </div>

      <div className="gbf-caption">{note}</div>

      <div className="gbf-stats">
        <div className="gbf-stat"><span>length</span><b>{g.length()}</b></div>
        <div className="gbf-stat"><span>gap slots</span><b>{g.gapEnd - g.gapStart}</b></div>
        <div className="gbf-stat"><span>total shifts</span><b>{g.shifts}</b></div>
      </div>

      <p className="gbf-foot">
        The bet is locality, and it usually pays: real editing is bursts of insertions and deletions clustered at
        one point — typing a word, fixing a line — and all of those are O(1) because the gap is already there. You
        only pay when you jump the cursor far, and even then it's a single fast <code>memmove</code>, not a tree
        traversal. That simplicity is why Emacs has used a gap buffer since the 1970s. The weaknesses are the
        mirror image: many edit points far apart thrash the gap back and forth, and a naive gap buffer stores the
        whole file contiguously (harder for multi-gigabyte files or many cursors). That's where the alternatives
        come in — a <strong>rope</strong> makes every operation O(log n) at the cost of a tree, and a
        <strong> piece table</strong> never moves text at all, representing the document as a list of spans into an
        original + append buffer (which is why it gives cheap undo and is what VS Code uses). Three data structures,
        one question — where do you put the slack so editing doesn't have to shove the whole document around.
        (Emacs / Scintilla editing buffers.)
      </p>
    </div>
  );
}
