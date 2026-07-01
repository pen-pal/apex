// The Burrows-Wheeler Transform, made visible. Type a word; watch all its rotations get sorted, read
// the last column as the BWT, and see the inverse rebuild the original exactly. The clustering meter
// shows the point: the BWT itself compresses nothing, but it groups equal characters into runs that a
// move-to-front + RLE + entropy stage (bzip2) then crushes. Real transform from bwt.ts.
import { useMemo, useState } from 'react';
import { forward, inverse, adjacency, SENTINEL } from './bwt';

const PRESETS = ['banana', 'mississippi', 'abracadabra'];

export function BwtSection() {
  const [text, setText] = useState('banana');
  const clean = text.replace(/\$/g, '').slice(0, 14) || 'a';

  const fwd = useMemo(() => forward(clean), [clean]);
  const back = useMemo(() => inverse(fwd.bwt), [fwd]);
  const n = fwd.bwt.length;
  const inAdj = adjacency(clean + SENTINEL);
  const outAdj = adjacency(fwd.bwt);

  return (
    <div className="bwt">
      <div className="bwt-in">
        <label>string <input value={text} spellCheck={false} onChange={(e) => setText(e.target.value)} /></label>
        <div className="bwt-presets">{PRESETS.map((p) => <button key={p} type="button" onClick={() => setText(p)}>{p}</button>)}</div>
        <span className="bwt-note">a <code>$</code> sentinel is appended (it sorts before every letter)</span>
      </div>

      <div className="bwt-grids">
        <div className="bwt-grid">
          <div className="bwt-grid-h">all rotations of “{clean}$”</div>
          {fwd.rotations.map((r, i) => (
            <div key={i} className="bwt-rot">{[...r].map((ch, j) => <span key={j} className="bwt-ch">{ch}</span>)}</div>
          ))}
        </div>
        <div className="bwt-arrow">sort →</div>
        <div className="bwt-grid">
          <div className="bwt-grid-h">sorted — last column = BWT</div>
          {fwd.sorted.map((r, i) => (
            <div key={i} className={`bwt-rot ${i === fwd.originalRow ? 'orig' : ''}`}>
              {[...r].map((ch, j) => <span key={j} className={`bwt-ch ${j === 0 ? 'first' : ''} ${j === n - 1 ? 'last' : ''}`}>{ch}</span>)}
            </div>
          ))}
        </div>
      </div>

      <div className="bwt-out">
        <div className="bwt-out-row"><span className="bwt-lbl">BWT</span><code className="bwt-val big">{fwd.bwt}</code></div>
        <div className="bwt-out-row"><span className="bwt-lbl">inverse</span><code className="bwt-val">{back}{SENTINEL}</code><span className={`bwt-verify ${back === clean ? 'ok' : 'bad'}`}>{back === clean ? `✓ recovers “${clean}”` : '✗'}</span></div>
      </div>

      <div className="bwt-cluster">
        <div className="bwt-cluster-h">Why it helps compression — adjacent-equal runs</div>
        <div className="bwt-meters">
          <div className="bwt-meter"><span>input “{clean}$”</span><b>{inAdj}</b> runs</div>
          <div className="bwt-meter out"><span>BWT output</span><b>{outAdj}</b> runs</div>
        </div>
        <p>{outAdj > inAdj
          ? `The BWT raised the run count from ${inAdj} to ${outAdj} — characters that share a following context got grouped, which is exactly what move-to-front + run-length + Huffman then exploit.`
          : 'On a short or already-clustered string the effect is small; the gains show on real text with repeated contexts.'}</p>
      </div>

      <p className="bwt-foot">
        This is a <strong>bijection</strong>: nothing is lost, yet the output is far more compressible. The inverse here
        rebuilds the sorted-rotation table one column at a time (n sorts); real implementations use the <strong>LF-mapping</strong> to invert in
        O(n) without ever materialising the table. <strong>bzip2</strong> runs the BWT on ~900 KB blocks, then move-to-front, run-length and
        Huffman coding. The sentinel guarantees every rotation is unique so the sort — and the inverse — are unambiguous. (Burrows & Wheeler, 1994.)
      </p>
    </div>
  );
}
