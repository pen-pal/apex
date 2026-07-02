// The rsync algorithm, made visible. Edit the old and new files; the sender rolls a window over the new file,
// matching whole blocks of the old one by rolling checksum, and emits a delta of COPY-block and LITERAL-bytes
// ops. The new file is redrawn tinted by source — green where a block was reused from the copy you already have,
// amber where genuinely new bytes had to be sent — and a bar shows how few bytes actually cross the wire. Real
// model from rsync.ts.
import { useMemo, useState } from 'react';
import { computeDelta, reconstruct, transferred } from './rsync';

export function RsyncSection() {
  const [oldF, setOldF] = useState('The quick brown fox jumps over the lazy dog by the river.');
  const [newF, setNewF] = useState('The quick brown cat jumps over the lazy dog by the river tonight.');
  const [B, setB] = useState(6);

  const { delta, ok, sent } = useMemo(() => {
    const delta = computeDelta(oldF, newF, B);
    return { delta, ok: reconstruct(oldF, delta, B) === newF, sent: transferred(delta) };
  }, [oldF, newF, B]);

  const copied = delta.filter((o) => o.type === 'copy').length * B;
  const literalBytes = delta.reduce((n, o) => n + (o.type === 'literal' ? o.data.length : 0), 0);
  const savedPct = newF.length ? Math.round((1 - sent / newF.length) * 100) : 0;

  return (
    <div className="rsy">
      <p className="rsy-intro">
        Sync a changed file by sending only the differences — without either side seeing the other's data first.
        The receiver (holding the <strong>old</strong> file) sends block checksums; the sender rolls a window
        over the <strong>new</strong> file, matching whole blocks by a checksum it updates one byte at a time,
        and emits <span className="rsy-k copy">COPY</span> references and <span className="rsy-k lit">LITERAL</span>
        runs. Edit the files:
      </p>

      <div className="rsy-files">
        <label className="rsy-file">old file <i>(receiver has this)</i><textarea value={oldF} onChange={(e) => setOldF(e.target.value)} rows={3} /></label>
        <label className="rsy-file">new file <i>(sender wants to send this)</i><textarea value={newF} onChange={(e) => setNewF(e.target.value)} rows={3} /></label>
      </div>

      <label className="rsy-bslider">block size = <b>{B}</b> bytes<input type="range" min={3} max={16} value={B} onChange={(e) => setB(+e.target.value)} /></label>

      <div className="rsy-recon">
        <span className="rsy-recon-label">new file, tinted by source:</span>
        <div className="rsy-recon-text">
          {delta.map((op, i) => op.type === 'copy'
            ? <span key={i} className="rsy-seg copy" title={`copied block ${op.block} from the old file`}>{oldF.slice(op.block * B, op.block * B + B)}</span>
            : <span key={i} className="rsy-seg lit" title="literal bytes sent over the wire">{op.data}</span>)}
        </div>
      </div>

      <div className="rsy-delta">
        <span className="rsy-recon-label">delta ({delta.length} ops):</span>
        <div className="rsy-ops">
          {delta.map((op, i) => op.type === 'copy'
            ? <span key={i} className="rsy-op copy">COPY #{op.block}</span>
            : <span key={i} className="rsy-op lit">LIT “{op.data.length > 12 ? op.data.slice(0, 12) + '…' : op.data}”</span>)}
        </div>
      </div>

      <div className="rsy-bar">
        <div className="rsy-bar-track">
          <div className="rsy-bar-copied" style={{ width: `${(copied / Math.max(1, newF.length)) * 100}%` }} />
          <div className="rsy-bar-lit" style={{ width: `${(literalBytes / Math.max(1, newF.length)) * 100}%` }} />
        </div>
      </div>

      <div className="rsy-stats">
        <div className="rsy-stat ok"><span>reused from old</span><b>{copied} B</b></div>
        <div className="rsy-stat warn"><span>literal bytes sent</span><b>{literalBytes} B</b></div>
        <div className="rsy-stat"><span>total on the wire</span><b>{sent} B</b></div>
        <div className={`rsy-stat ${savedPct > 0 ? 'ok' : ''}`}><span>vs full file ({newF.length} B)</span><b>{savedPct}% saved</b></div>
      </div>
      {!ok && <div className="rsy-err">reconstruction mismatch (shouldn't happen)</div>}

      <p className="rsy-foot">
        Two ideas make this work. The first is the <strong>rolling checksum</strong>: to try matching a block at
        every byte offset you'd normally re-hash a whole window each step (O(n·B)), but the weak checksum here
        (rsync uses an Adler-style sum) can be updated in O(1) by subtracting the byte that leaves the window and
        adding the one that enters — so scanning the whole file is O(n). The second is the <strong>two-tier
        check</strong>: the weak checksum is fast but collides, so a candidate match is confirmed with a strong
        hash (MD5/xxHash) before trusting it — cheap filtering, expensive confirmation only on hits. Its key
        property is <strong>edit resilience</strong>: because the sender searches at every offset (not just block
        boundaries), inserting or deleting a few bytes near the start doesn't ruin the rest — the window simply
        re-aligns and keeps matching the shifted blocks, so an edit costs bytes proportional to the edit, not the
        file. That's why rsync, <code>zsync</code>, Dropbox's delta sync, Git's packfile deltas, and backup dedup
        all lean on rolling hashes. It's the same rolling-hash primitive as Rabin–Karp search and content-defined
        chunking — here aimed at "what parts of this file does the other side already have?" (Tridgell &amp;
        Mackerras, 1996.)
      </p>
    </div>
  );
}
