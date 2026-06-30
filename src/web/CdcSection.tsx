// Content-defined chunking, made visible. The top line is the original file; edit the copy below — insert
// a character at the front, change a word — and watch the two strategies react. Fixed-size chunking cuts
// every N bytes, so a single insertion shifts every later boundary and every block turns "new" (red): the
// whole file must be re-sent. CDC cuts on content, so only the edited chunk changes; the rest stay green
// and dedupe for free. That gap is why incremental backup and rsync-style sync are cheap. Model from cdc.ts.
import { useMemo, useState } from 'react';
import { fixedChunks, cdcChunks, dedup, type Chunk } from './cdc';

const ORIGINAL = 'the quick brown fox jumps over the lazy dog and then keeps running far away into the night';
const OPTS = { minSize: 3, avgSize: 8, maxSize: 24 };
const enc = (s: string) => [...new TextEncoder().encode(s)];
const text = (bytes: number[], c: Chunk) => bytes.slice(c.start, c.start + c.len).map((b) => String.fromCharCode(b)).join('');

function Ribbon({ str, chunks, known }: { str: string; chunks: Chunk[]; known: Set<number> }) {
  const bytes = enc(str);
  return (
    <div className="cdc-ribbon">
      {chunks.map((c, i) => (
        <span key={i} className={`cdc-chunk ${known.has(c.hash) ? 'reused' : 'new'}`} title={known.has(c.hash) ? 'reused (already stored)' : 'new — must be sent'}>
          {text(bytes, c).replace(/ /g, '·')}
        </span>
      ))}
    </div>
  );
}

export function CdcSection() {
  const [edited, setEdited] = useState('X' + ORIGINAL);

  const view = useMemo(() => {
    const oa = enc(ORIGINAL), eb = enc(edited);
    const fixedA = fixedChunks(oa, 8), fixedB = fixedChunks(eb, 8);
    const cdcA = cdcChunks(oa, OPTS), cdcB = cdcChunks(eb, OPTS);
    return {
      fixedB, cdcB,
      fixedKnown: new Set(fixedA.map((c) => c.hash)),
      cdcKnown: new Set(cdcA.map((c) => c.hash)),
      fixedD: dedup(fixedA, fixedB),
      cdcD: dedup(cdcA, cdcB),
    };
  }, [edited]);

  const pct = (d: { bytesReused: number; bytesTotal: number }) => d.bytesTotal ? Math.round((d.bytesReused / d.bytesTotal) * 100) : 0;

  return (
    <div className="cdc">
      <p className="cdc-intro">
        To sync or back up a file efficiently, you split it into chunks and only store/send the chunks you
        haven't seen before (matched by hash). Everything rides on <strong>where you cut</strong>. Edit the
        copy below and watch each strategy: green = a chunk already stored (free), red = a new chunk that
        must be sent.
      </p>

      <div className="cdc-orig">
        <span className="cdc-tag">original</span>
        <code>{ORIGINAL.replace(/ /g, '·')}</code>
      </div>
      <label className="cdc-edit">
        <span className="cdc-tag">your edit</span>
        <input value={edited} onChange={(e) => setEdited(e.target.value)} spellCheck={false} />
      </label>

      <div className="cdc-method">
        <div className="cdc-mh">
          <b>Fixed-size chunking</b> — cut every 8 bytes
          <span className={`cdc-score ${pct(view.fixedD) < 50 ? 'bad' : 'ok'}`}>{view.fixedD.reused}/{view.fixedD.total} chunks · {pct(view.fixedD)}% bytes reused</span>
        </div>
        <Ribbon str={edited} chunks={view.fixedB} known={view.fixedKnown} />
      </div>

      <div className="cdc-method">
        <div className="cdc-mh">
          <b>Content-defined chunking</b> — cut where the rolling hash hits a boundary
          <span className={`cdc-score ${pct(view.cdcD) < 50 ? 'bad' : 'ok'}`}>{view.cdcD.reused}/{view.cdcD.total} chunks · {pct(view.cdcD)}% bytes reused</span>
        </div>
        <Ribbon str={edited} chunks={view.cdcB} known={view.cdcKnown} />
      </div>

      <p className="cdc-foot">
        Insert one character at the front and fixed chunking goes almost entirely red — every boundary
        shifted by one, so no chunk matches what was stored (the <strong>boundary-shift problem</strong>).
        CDC stays almost entirely green because its cut points are decided by a rolling hash over a small
        window of <em>content</em>, so they move with the bytes; only the chunk straddling the edit changes.
        Real systems (LBFS, restic, borg, ZFS, Dropbox) add a Rabin fingerprint, min/max chunk bounds to
        tame the geometric size distribution, and a secure hash (SHA-256) for the dedup key. This is also
        why rsync can update a huge file by sending only a few kilobytes. (Muthitacharoen et al., LBFS 2001.)
      </p>
    </div>
  );
}
