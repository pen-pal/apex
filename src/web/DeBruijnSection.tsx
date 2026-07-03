// Guided story: de Bruijn graph genome assembly — reconstruct a sequence from short overlapping fragments. Shred into
// k-mers; make each (k−1)-mer a node and each k-mer a directed edge (prefix→suffix); then assembly is an Eulerian path
// (walk every edge once), found by Hierholzer, and reading the last letter of each node spells the sequence back.
// Verified in node: distinct k-mers reconstruct the original exactly; the hard part is repeats — a repeated (k−1)-mer
// branches the graph so several Eulerian paths are valid (ambiguous). The idea behind Velvet/SPAdes. Sandboxed.
import { useEffect, useMemo, useRef, useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

function assemble(S: string, k: number) {
  const kmers: string[] = []; for (let i = 0; i + k <= S.length; i++) kmers.push(S.slice(i, i + k));
  const adj = new Map<string, string[]>(), indeg = new Map<string, number>(), outdeg = new Map<string, number>(); const nodeSet = new Set<string>();
  for (const m of kmers) { const a = m.slice(0, k - 1), b = m.slice(1); nodeSet.add(a); nodeSet.add(b); if (!adj.has(a)) adj.set(a, []); adj.get(a)!.push(b); outdeg.set(a, (outdeg.get(a) || 0) + 1); indeg.set(b, (indeg.get(b) || 0) + 1); }
  let start = kmers.length ? kmers[0].slice(0, k - 1) : ''; for (const n of nodeSet) if ((outdeg.get(n) || 0) - (indeg.get(n) || 0) === 1) { start = n; break; }
  const adj2 = new Map([...adj].map(([kk, v]) => [kk, [...v]])); const stack = [start], path: string[] = [];
  while (stack.length) { const v = stack[stack.length - 1]; const nb = adj2.get(v); if (nb && nb.length) stack.push(nb.pop()!); else path.push(stack.pop()!); }
  path.reverse();
  let recon = path[0] || ''; for (let i = 1; i < path.length; i++) recon += path[i].slice(-1);
  // count how many (k-1)-mers repeat (in+out degree > expected) — the source of ambiguity
  const repeats = [...nodeSet].filter((n) => (outdeg.get(n) || 0) > 1).length;
  // layout: each unique node at its first index in the path
  const firstIdx = new Map<string, number>(); path.forEach((n, i) => { if (!firstIdx.has(n)) firstIdx.set(n, i); });
  return { kmers, nodes: [...nodeSet], path, recon, ok: recon === S, repeats, firstIdx };
}

const OX = 80, WIDTH = 760, ROWY = 150;
type Phase = 'fragments' | 'graph' | 'euler' | 'walk' | 'repeats' | 'run';

export function DeBruijnSection() {
  const [k, setK] = useState(4);
  const S = 'quick_brown';
  const A = useMemo(() => assemble(S, k), [k]);
  const step = useRef(0); const [, tick] = useState(0);
  useEffect(() => { step.current = 0; }, [k]);
  useEffect(() => {
    let raf = 0; let f = 0; const loop = () => { f++; if (f % 22 === 0) { step.current = (step.current + 1) % (A.path.length + 6); tick((t) => (t + 1) % 100000); } raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf);
  }, [A.path.length]);

  const REPSTR = 'GACGGCGGCGCACT'; const REP = assemble(REPSTR, 3); // repeated (k−1)-mers → the assembler picks a valid but DIFFERENT superstring (ambiguous)
  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <DB phase={key} A={key === 'repeats' ? REP : assemble(S, 4)} src={key === 'repeats' ? REPSTR : S} k={key === 'repeats' ? 3 : 4} step={key === 'walk' ? step.current : 999} /> });

  const scenes: StoryScene[] = [
    scene('fragments', 'Reassemble from fragments', 'A DNA sequencer never reads a whole chromosome — it reads millions of short, overlapping fragments. Reassembling the original from them is genome assembly: a jigsaw where the pieces overlap. de Bruijn graphs turn that jigsaw into a clean graph problem.'),
    scene('graph', 'k-mers become a graph', 'Chop the sequence into every length-k substring (a k-mer). Make each (k−1)-character overlap a node, and each k-mer a directed edge from its first k−1 letters to its last k−1. Overlapping k-mers automatically share nodes, so the graph stitches the fragments together by their overlaps.'),
    scene('euler', 'Assembly is an Eulerian path', 'Now the reconstruction is exactly a path that uses every edge once — an Eulerian path. (Not every NODE once — that would be the Hamiltonian path, which is NP-hard. Using every edge is the easy one.) Euler’s rule: it exists when the graph is connected and every node’s in-degree equals its out-degree, bar one start and one end.'),
    scene('walk', 'Walk it, and the sequence spells out', 'Hierholzer’s algorithm finds an Eulerian path in linear time: follow unused edges until stuck, then splice in detours. Walk the path and read off the last letter of each node in turn — the original sequence reassembles itself, letter by letter. Every k-mer used exactly once.'),
    scene('repeats', 'Repeats are the hard part', 'Here’s the real difficulty. When a (k−1)-mer occurs more than once (here “CG”, “GC”, and “GG” each recur), its node gains extra edges and the graph branches — and now several different Eulerian paths are all valid. The assembler walks a real one, but it may not be the true sequence (the orange reconstruction differs). This is why assembly needs longer reads or larger k: to break the repeats apart.'),
    { key: 'run', title: 'Assemble it yourself', caption: 'The k-mers of the sequence build the graph; the Eulerian walk (highlighted) reassembles it below, letter by letter. Shrink k and watch (k−1)-mers start to repeat, branch the graph, and turn the reconstruction ambiguous — grow k and it snaps back to the exact original. Read length versus repeats, the whole story of assembly.', render: () => <DB phase="run" A={A} src={S} k={k} step={step.current} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>A DNA sequencer can’t read a whole chromosome — it reads millions of short, overlapping fragments, and <strong>genome assembly</strong> reconstructs the original from them. The <strong>de Bruijn graph</strong> makes it a clean graph problem: chop everything into k-length pieces (<strong>k-mers</strong>), make each (k−1)-character overlap a node and each k-mer a directed edge, and then reassembly is exactly finding a path that walks every edge once — an <strong>Eulerian path</strong>. Follow it and the original sequence spells itself back out.</>,
        takeaway: <>Genome assembly reconstructs a long sequence from short overlapping reads. The de Bruijn approach (Pevzner et al.) shreds all reads into their <strong>k-mers</strong>, then builds a graph where each distinct (k−1)-mer is a node and each k-mer is a directed edge from its prefix (first k−1 letters) to its suffix (last k−1) — so overlapping k-mers automatically share nodes. A candidate assembly is a walk using every edge exactly once: an <strong>Eulerian path</strong>. Euler’s theorem says one exists iff the graph is connected and every node has equal in- and out-degree except at most a start (out−in = +1) and end (in−out = +1); <strong>Hierholzer’s algorithm</strong> finds it in linear time by walking unused edges until stuck and splicing in sub-tours. Reading the last character of each node along the path spells the sequence back (verified here: when the k-mers are all distinct, the reconstruction equals the original exactly, each k-mer used once). The hard part — and the central difficulty of real assembly — is <strong>repeats</strong>: when the same (k−1)-mer occurs more than once, the graph gains branch points and several different Eulerian paths become equally valid, so the true sequence can’t be recovered from the k-mers alone (verified: a string with repeated k-mers reassembles into a valid but different superstring). That’s why assembly quality hinges on read length and k — longer reads and larger k separate repeats and make the path unique. de Bruijn assembly (Velvet, SPAdes, and most modern assemblers) turned assembly from an intractable overlap (Hamiltonian-path) problem into a linear-time Eulerian-path one — a rare case where the harder-sounding graph problem is the easy one.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <label className="dbj-ctl">k = <input type="range" min={3} max={6} value={k} onChange={(e) => setK(+e.target.value)} /><b>{k}</b> · {A.kmers.length} k-mers · <span className={A.ok ? 'dbj-ok' : 'dbj-bad'}>{A.ok ? 'reconstructed exactly ✓' : 'ambiguous — repeats branch the graph'}</span></label>
      )}
    />
  );
}

function DB({ phase, A, src, k, step }: { phase: Phase; A: ReturnType<typeof assemble>; src: string; k: number; step: number }) {
  const on = (p: Phase) => phase === p;
  const showGraph = !on('fragments');
  const nx = (n: string) => OX + (A.firstIdx.get(n)! / Math.max(1, A.path.length - 1)) * WIDTH;
  const walked = Math.min(step, A.path.length - 1);
  const reconSoFar = on('walk') ? (A.path[0] || '') + A.path.slice(1, walked + 1).map((n) => n.slice(-1)).join('') : A.recon;
  return (
    <svg viewBox="0 0 900 300" className="story-svg">
      <text x="60" y="22" className="dbj-col">sequence “{src}” · k={k} · {A.kmers.length} k-mers → {A.nodes.length} nodes{showGraph && !on('graph') ? ` · Eulerian path (${A.path.length - 1} edges)` : ''}</text>

      {/* the source fragments / k-mers */}
      {(on('fragments') || on('graph')) && <>
        <text x={OX} y={62} className="dbj-lbl">{on('fragments') ? 'overlapping fragments (k-mers)' : 'each k-mer = an edge; each (k−1)-overlap = a node'}</text>
        {A.kmers.slice(0, 12).map((m, i) => <text key={i} x={OX + i * 62} y={84} className="dbj-kmer">{m}</text>)}
      </>}

      {/* graph: edges then nodes, laid left→right in Euler order */}
      {showGraph && <>
        {A.path.slice(0, -1).map((n, i) => { const a = n, b = A.path[i + 1]; const x1 = nx(a), x2 = nx(b), lit = on('walk') && i < walked;
          const backward = x2 < x1; const my = ROWY - (backward ? 46 : 0);
          return <path key={i} d={backward ? `M ${x1} ${ROWY - 12} Q ${(x1 + x2) / 2} ${my - 20} ${x2} ${ROWY - 12}` : `M ${x1 + 14} ${ROWY} L ${x2 - 14} ${ROWY}`} className={`dbj-edge ${lit ? 'lit' : ''}`} markerEnd={lit ? 'url(#dbjarrL)' : 'url(#dbjarr)'} fill="none" />; })}
        {A.nodes.map((n) => <g key={n}><circle cx={nx(n)} cy={ROWY} r="13" className="dbj-node" /><text x={nx(n)} y={ROWY + 4} className="dbj-nlbl" textAnchor="middle">{n}</text></g>)}
        <defs>
          <marker id="dbjarr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="hsl(220 20% 50%)" /></marker>
          <marker id="dbjarrL" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="hsl(150 65% 58%)" /></marker>
        </defs>
      </>}

      {/* reconstruction */}
      {(on('walk') || on('run') || on('euler') || on('repeats')) && <>
        <text x={OX} y={ROWY + 78} className="dbj-lbl">reconstruction:</text>
        <text x={OX + 108} y={ROWY + 78} className={`dbj-recon ${A.ok ? '' : 'amb'}`}>{reconSoFar || '…'}</text>
        {!on('walk') && <text x={OX} y={ROWY + 100} className={`dbj-status ${A.ok ? 'ok' : 'bad'}`}>{A.ok ? '✓ equals the original — each k-mer used once' : `≠ original — ${A.repeats} repeated (k−1)-mer${A.repeats === 1 ? '' : 's'} branch the graph → several valid paths`}</text>}
      </>}

      <text x="450" y="292" className="dbj-foot" textAnchor="middle">
        {on('fragments') ? 'reassemble the sequence from short overlapping pieces'
          : on('graph') ? 'k-mers → edges, (k−1)-overlaps → shared nodes'
          : on('euler') ? 'walk every EDGE once (Eulerian) — not every node (Hamiltonian)'
          : on('walk') ? 'Hierholzer walks the path → the sequence spells out'
          : on('repeats') ? 'a repeated (k−1)-mer branches the graph → ambiguous assembly'
          : A.ok ? 'distinct k-mers → one Eulerian path → the exact original' : 'repeats → multiple valid paths → grow k to disambiguate'}
      </text>
    </svg>
  );
}
