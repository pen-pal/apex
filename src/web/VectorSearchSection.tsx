// Guided story: graph-based approximate nearest-neighbor search (HNSW) — how vector databases / RAG find the nearest
// embeddings among millions. Build a proximity graph (each vector linked to a few nearest neighbors), then navigate:
// hop toward the query, keeping the best `ef` candidates (beam search). HNSW stacks layers (sparse top for long jumps,
// dense below) for O(log n) at scale. Real best-first search verified in node: recall@1 rises ~62%→100% as ef 1→16,
// visiting ~25–50% of the 64 vectors. Pairs with the word2vec story (embeddings are the vectors). Sandboxed/CONCEPTUAL, 2-D.
import { useMemo, useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const N = 64, K = 6;
function build() {
  let s = 12345; const rnd = () => { s = (s * 1103515245 + 12345) >>> 0; return (s >>> 8) / (1 << 24); };
  const pts = Array.from({ length: N }, () => [8 + rnd() * 84, 8 + rnd() * 84] as [number, number]);
  const d2 = (a: number[], b: number[]) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
  const nbr = pts.map((p, i) => pts.map((q, j) => [j, d2(p, q)] as [number, number]).filter(([j]) => j !== i).sort((a, b) => a[1] - b[1]).slice(0, K).map(([j]) => j));
  return { pts, nbr, d2 };
}
const G = build();
function search(q: number[], entry: number, ef: number) {
  const vis = new Set([entry]); const cand: [number, number][] = [[entry, G.d2(G.pts[entry], q)]]; let res: [number, number][] = [[entry, G.d2(G.pts[entry], q)]]; const path = [entry];
  while (cand.length) {
    cand.sort((a, b) => a[1] - b[1]); const [c, cd] = cand.shift()!; const worst = res.length ? Math.max(...res.map((r) => r[1])) : Infinity;
    if (cd > worst && res.length >= ef) break;
    if (path[path.length - 1] !== c) path.push(c);
    for (const nb of G.nbr[c]) { if (vis.has(nb)) continue; vis.add(nb); const dd = G.d2(G.pts[nb], q); cand.push([nb, dd]); res.push([nb, dd]); res.sort((a, b) => a[1] - b[1]); if (res.length > ef) res.length = ef; }
  }
  res.sort((a, b) => a[1] - b[1]); return { found: res[0][0], visited: vis, path };
}
const trueNN = (q: number[]) => { let t = 0, td = Infinity; for (let i = 0; i < N; i++) { const dd = G.d2(G.pts[i], q); if (dd < td) { td = dd; t = i; } } return t; };
const sx = (x: number) => 90 + x * 6.6, sy = (y: number) => 40 + y * 3.9;

type Phase = 'nearest' | 'graph' | 'navigate' | 'candidates' | 'layers' | 'run';

export function VectorSearchSection() {
  const [qx, setQx] = useState(52);
  const [ef, setEf] = useState(1);
  const Q: [number, number] = [qx, 46];
  const res = useMemo(() => search(Q, 3, ef), [qx, ef]);
  const tnn = trueNN(Q);

  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <VS phase={key} q={[52, 46]} res={search([52, 46], 3, key === 'candidates' ? 4 : 1)} tnn={trueNN([52, 46])} /> });

  const scenes: StoryScene[] = [
    scene('nearest', 'Find the nearest vector', 'An embedding turns text or an image into a vector where nearby means similar (the word2vec idea). Semantic search — and the retrieval step of RAG — is then just: given a query vector, find the nearest stored vectors. Comparing the query to every one is exact, but hopeless at millions or billions of vectors.'),
    scene('graph', 'Link each vector to its neighbors', 'Build a proximity graph: connect each vector to a handful of its nearest neighbors, so every edge joins two similar items. Now the vectors aren’t a flat list — they’re a network you can walk, each step staying among things that are alike.'),
    scene('navigate', 'Navigate toward the query', 'Start at some entry vector and repeatedly hop to whichever neighbor sits closest to the query. Like following signposts, the walk homes in on the query’s neighborhood — reaching it in a few hops while touching only a tiny fraction of the vectors.'),
    scene('candidates', 'Keep the best few (ef)', 'Pure greedy can stall in a local pocket and miss the true nearest. So the real search keeps the best ef candidates at once and expands them all — a beam search. Bigger ef explores more and finds the true nearest more often; it’s the one knob that trades recall for speed.'),
    scene('layers', 'Layers for the long jumps (HNSW)', 'HNSW stacks the graph in layers: a sparse top layer whose long edges leap across the whole space, and denser layers below to refine. Search top-down — coarse leaps, then fine steps. That hierarchy keeps the cost near O(log n) even for billions of high-dimensional vectors.'),
    { key: 'run', title: 'Search the graph', caption: 'Move the query and watch the search walk the graph to the nearest vector, lighting up the few it visits. Turn ef up and it keeps more candidates — visiting a bit more, but landing on the true nearest (ringed green) more reliably. This is the retrieval behind every vector database.', render: () => <VS phase="run" q={Q} res={res} tnn={tnn} ef={ef} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>Embeddings turn text, images, or audio into vectors where nearness means similarity (the word2vec idea). Semantic search — and the retrieval in <strong>RAG</strong> — is then just: given a query vector, find the nearest stored vectors. Comparing the query to every one is exact but far too slow at millions of vectors. <strong>Graph-based approximate nearest neighbor</strong>, of which <strong>HNSW</strong> is the standard, navigates a graph of the vectors to find the nearest ones while touching only a tiny fraction.</>,
        takeaway: <>Build a <strong>proximity graph</strong>: connect each vector to a handful of its nearest neighbors, so edges join similar items. To answer a query, start at an entry vector and <strong>navigate</strong> — repeatedly move to the neighbor closest to the query — homing in while visiting a small fraction of the data. Pure greedy can stall in a local pocket, so the real search keeps a set of the best <code>ef</code> candidates and expands them (a beam search); ef is the single knob trading recall for speed — verified here rising from ~62% recall at ef=1 to 100% at ef=16, while visiting roughly a quarter to a half of the vectors. <strong>HNSW</strong> (Hierarchical Navigable Small World) adds layers: a sparse top layer whose long edges let the search leap across the space, and denser layers below to refine, searched top-down — keeping the cost near O(log n) even for billions of high-dimensional vectors. That’s why it underpins vector databases (FAISS, Milvus, pgvector, Pinecone) and the retrieval step of most RAG systems. It trades exactness for speed — approximate, not guaranteed nearest — but at recall high enough that the gap rarely matters.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="ann-ctl">
          <label className="ann-lbl">query<input type="range" min={10} max={92} value={qx} onChange={(e) => setQx(+e.target.value)} /></label>
          <label className="ann-lbl">ef<input type="range" min={1} max={16} value={ef} onChange={(e) => setEf(+e.target.value)} /><b>{ef}</b></label>
          <span className="ann-live">visited {res.visited.size}/{N} · {res.found === tnn ? 'found true nearest ✓' : 'approximate (missed by a little)'}</span>
        </div>
      )}
    />
  );
}

function VS({ phase, q, res, tnn, ef }: { phase: Phase; q: number[]; res: ReturnType<typeof search>; tnn: number; ef?: number }) {
  const on = (p: Phase) => phase === p;
  const showGraph = !on('nearest');
  const showSearch = on('navigate') || on('candidates') || on('run');
  return (
    <svg viewBox="0 0 900 440" className="story-svg">
      <text x="60" y="28" className="ann-col">{N} vectors · nearest-neighbor search{showSearch ? ` · visited ${res.visited.size}/${N}${ef ? ` · ef ${ef}` : ''}` : ''}</text>

      {/* graph edges */}
      {showGraph && G.pts.map((p, i) => G.nbr[i].filter((j) => j > i).map((j) => (
        <line key={`${i}-${j}`} x1={sx(p[0])} y1={sy(p[1])} x2={sx(G.pts[j][0])} y2={sy(G.pts[j][1])} className="ann-edge" />
      )))}

      {/* search path */}
      {showSearch && res.path.slice(1).map((c, i) => (
        <line key={'p' + i} x1={sx(G.pts[res.path[i]][0])} y1={sy(G.pts[res.path[i]][1])} x2={sx(G.pts[c][0])} y2={sy(G.pts[c][1])} className="ann-path" />
      ))}

      {/* points */}
      {G.pts.map((p, i) => {
        const visited = showSearch && res.visited.has(i);
        const found = showSearch && i === res.found;
        return <circle key={i} cx={sx(p[0])} cy={sy(p[1])} r={found ? 7 : visited ? 5 : 3.5} className={`ann-pt ${found ? 'found' : visited ? 'vis' : ''}`} />;
      })}
      {/* true NN ring (when search shown and it differs, or always in run) */}
      {showSearch && res.found !== tnn && <circle cx={sx(G.pts[tnn][0])} cy={sy(G.pts[tnn][1])} r="8" className="ann-truenn" />}

      {/* query */}
      <g transform={`translate(${sx(q[0])},${sy(q[1])})`}><path d="M0,-9 L9,0 L0,9 L-9,0 Z" className="ann-query" /></g>
      <text x={sx(q[0]) + 13} y={sy(q[1]) + 4} className="ann-qlbl">query</text>

      <text x="450" y="428" className="ann-foot" textAnchor="middle">
        {on('nearest') ? 'find the nearest vector to the query — brute force checks all of them'
          : on('graph') ? 'each vector linked to its nearest neighbors — a walkable network'
          : on('navigate') ? 'hop to the neighbor closest to the query, a few steps to arrive'
          : on('candidates') ? 'keep the best ef candidates → land on the true nearest more often'
          : on('layers') ? 'HNSW: sparse top layer leaps far, dense layers refine — O(log n) at scale'
          : res.found === tnn ? `visited ${res.visited.size}/${N} → true nearest found` : `visited ${res.visited.size}/${N} → approximate (raise ef)`}
      </text>
    </svg>
  );
}
