// Edit distance, made visible. Two words fill a DP grid; each cell is the cost to align
// the prefixes, and the highlighted backtrace path from the bottom-right shows the actual
// insert/delete/substitute/match operations. Edit either word and watch the grid and the
// alignment recompute. Real DP in editdistance.ts (tested against kitten→sitting etc.).
import { useMemo, useState } from 'react';
import { editDistance, type Op } from './editdistance';

const OP_LABEL: Record<Op, string> = { match: 'keep', substitute: 'substitute', insert: 'insert', delete: 'delete' };
const OP_CLASS: Record<Op, string> = { match: 'm', substitute: 's', insert: 'i', delete: 'd' };

export function EditDistanceSection() {
  const [a, setA] = useState('kitten');
  const [b, setB] = useState('sitting');
  const r = useMemo(() => editDistance(a, b), [a, b]);

  // mark the cells on one optimal backtrace path
  const pathCells = useMemo(() => {
    const set = new Set<string>();
    let i = a.length, j = b.length;
    const dp = r.table;
    set.add(`${i},${j}`);
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && a[i - 1] === b[j - 1] && dp[i][j] === dp[i - 1][j - 1]) { i--; j--; }
      else if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + 1) { i--; j--; }
      else if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) { i--; }
      else { j--; }
      set.add(`${i},${j}`);
    }
    return set;
  }, [a, b, r]);

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Edit distance — how far apart are two strings?</h2></div>
        <p className="jsec-sub">
          The Levenshtein distance is the fewest single-character <strong>inserts</strong>, <strong>deletes</strong>, and
          <strong> substitutions</strong> to turn one word into another. Dynamic programming fills a grid where each cell is the cost to
          align the two prefixes — match carries the diagonal, otherwise take 1 + the cheapest neighbour. The corner is the answer; the
          path back to the origin is the alignment.
        </p>

        <div className="lev-io">
          <label>string A <input value={a} onChange={(e) => setA(e.target.value)} spellCheck={false} /></label>
          <label>string B <input value={b} onChange={(e) => setB(e.target.value)} spellCheck={false} /></label>
          <span className="lev-dist">distance = <b>{r.distance}</b></span>
        </div>

        <div className="lev-gridwrap">
          <table className="lev-grid">
            <thead>
              <tr><th></th><th className="lev-h">∅</th>{[...b].map((ch, j) => <th key={j} className="lev-h">{ch}</th>)}</tr>
            </thead>
            <tbody>
              {r.table.map((row, i) => (
                <tr key={i}>
                  <th className="lev-h">{i === 0 ? '∅' : a[i - 1]}</th>
                  {row.map((v, j) => (
                    <td key={j} className={`lev-cell ${pathCells.has(`${i},${j}`) ? 'path' : ''} ${i > 0 && j > 0 && a[i - 1] === b[j - 1] ? 'diag' : ''}`}>{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="lev-align">
          <div className="lev-alabel">alignment:</div>
          <div className="lev-ops">
            {r.edits.map((e, k) => (
              <span key={k} className={`lev-op ${OP_CLASS[e.op]}`} title={OP_LABEL[e.op]}>
                <span className="lev-oa">{e.a || '–'}</span>
                <span className="lev-oarrow">{e.op === 'match' ? '=' : '→'}</span>
                <span className="lev-ob">{e.b || '–'}</span>
              </span>
            ))}
          </div>
        </div>

        <p className="lev-foot">
          The same grid, with the recurrence tweaked, gives the longest common subsequence (the heart of <code>diff</code>), DNA/protein
          alignment (Needleman-Wunsch / Smith-Waterman), and approximate search (“did you mean…?”). It needs only the previous row to
          advance, so memory drops to O(min(m,n)) — though recovering the path then needs Hirschberg’s divide-and-conquer trick.
          Weighting the operations differently (e.g. a cheap transposition) gives Damerau-Levenshtein, better for typos.
        </p>
      </section>
    </div>
  );
}
