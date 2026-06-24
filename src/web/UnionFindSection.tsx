// Union-Find, made visible. Click two elements to union their sets and watch the disjoint
// groups merge and the component count drop; a connectivity check shows whether two
// elements share a root. The grouping reflects path compression and union by rank. Real
// DSU in unionfind.ts (tested).
import { useMemo, useState } from 'react';
import { create, union, connected, groups, find, type DSU } from './unionfind';

const N = 10;
const COLORS = ['hsl(212 60% 55%)', 'hsl(150 50% 45%)', 'hsl(28 80% 55%)', 'hsl(265 55% 58%)', 'hsl(0 65% 58%)', 'hsl(190 55% 45%)', 'hsl(45 75% 50%)', 'hsl(330 55% 55%)', 'hsl(95 45% 45%)', 'hsl(255 40% 55%)'];

function clone(d: DSU): DSU { return { parent: [...d.parent], rank: [...d.rank], count: d.count }; }

export function UnionFindSection() {
  const [dsu, setDsu] = useState<DSU>(() => create(N));
  const [sel, setSel] = useState<number[]>([]);
  const [a, setA] = useState(0);
  const [b, setB] = useState(7);

  const grp = useMemo(() => groups(dsu), [dsu]);
  const rootColor = useMemo(() => { const m: Record<number, string> = {}; Object.keys(grp).forEach((r, i) => (m[+r] = COLORS[i % COLORS.length])); return m; }, [grp]);
  const colorOf = (i: number) => rootColor[find(clone(dsu), i)] ?? '#ccc';

  const click = (i: number) => {
    const next = [...sel, i];
    if (next.length === 2) {
      const d = clone(dsu); union(d, next[0], next[1]); setDsu(d); setSel([]);
    } else setSel(next);
  };
  const reset = () => { setDsu(create(N)); setSel([]); };

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Union-Find — are these two in the same group?</h2></div>
        <p className="jsec-sub">
          Union-Find tracks a collection of disjoint sets and answers two questions in nearly constant time: <strong>union</strong>
          (merge the sets of two elements) and <strong>find/connected</strong> (do two elements share a root?). Each element points at a
          parent; the root names the set. Click two elements to union them:
        </p>

        <div className="uf-elements">
          {Array.from({ length: N }, (_, i) => (
            <button key={i} className={`uf-el ${sel.includes(i) ? 'sel' : ''}`} style={{ borderColor: colorOf(i), background: sel.includes(i) ? colorOf(i) : `${colorOf(i).replace(')', ' / 0.14)').replace('hsl', 'hsla')}` }} onClick={() => click(i)}>{i}</button>
          ))}
        </div>
        <div className="uf-bar"><button onClick={reset} className="uf-reset">reset</button><span className="uf-count">{dsu.count} component{dsu.count === 1 ? '' : 's'}</span></div>

        <div className="uf-groups">
          {Object.entries(grp).map(([root, members]) => (
            <div key={root} className="uf-group" style={{ borderColor: rootColor[+root] }}>
              <span className="uf-grootlabel">root {root}</span>
              {members.sort((x, y) => x - y).map((m) => <span key={m} className="uf-member" style={{ background: rootColor[+root] }}>{m}</span>)}
            </div>
          ))}
        </div>

        <div className="uf-check">
          <span>connected?</span>
          <select value={a} onChange={(e) => setA(+e.target.value)}>{Array.from({ length: N }, (_, i) => <option key={i} value={i}>{i}</option>)}</select>
          <span>&amp;</span>
          <select value={b} onChange={(e) => setB(+e.target.value)}>{Array.from({ length: N }, (_, i) => <option key={i} value={i}>{i}</option>)}</select>
          <span className={`uf-verdict ${connected(clone(dsu), a, b) ? 'yes' : 'no'}`}>{connected(clone(dsu), a, b) ? '✓ same set' : '✗ different sets'}</span>
        </div>

        <p className="uf-foot">
          Two tricks make it effectively O(1) per operation: <strong>union by rank</strong> always hangs the shorter tree under the
          taller so trees stay shallow, and <strong>path compression</strong> re-points every node touched during a find straight at the
          root — so the next query is instant. The amortized cost is the inverse Ackermann function α(n), which is ≤ 4 for any n in the
          universe. It’s the engine of Kruskal’s minimum-spanning-tree algorithm, network-connectivity queries, “friend circles,” and
          connected-component labeling in image processing.
        </p>
      </section>
    </div>
  );
}
