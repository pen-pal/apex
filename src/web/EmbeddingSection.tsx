// Guided story: word embeddings (word2vec) — words become vectors where meaning is geometry. Trained so words in
// similar contexts get similar vectors; consistent relationships fall out as consistent directions, so analogies
// become arithmetic: king − man + woman ≈ queen. A 2-D illustrative space (real embeddings are hundreds of dims),
// with hand-crafted vectors verified in node: all four analogies land on the expected word, and the gender direction
// (woman−man) is parallel to (queen−king), cosine 1.000. Pairs with the attention story (embeddings are its input).
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const E: Record<string, [number, number]> = {
  man: [0.10, 0.10], woman: [0.14, 0.90], king: [0.90, 0.16], queen: [0.94, 0.92],
  prince: [0.68, 0.20], princess: [0.72, 0.86], boy: [0.06, 0.26], girl: [0.10, 0.74],
};
const WORDS = Object.keys(E);
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function nearest(v: number[], exclude: string[]) { let best = WORDS[0], bd = 1e9; for (const w of WORDS) { if (exclude.includes(w)) continue; const d = dist(v, E[w]); if (d < bd) { bd = d; best = w; } } return best; }
const ANALOGIES: [string, string, string][] = [['king', 'man', 'woman'], ['queen', 'woman', 'man'], ['prince', 'boy', 'girl'], ['king', 'prince', 'princess']];

const OX = 150, W = 600, OY = 400, H = 320;
const sx = (e: number) => OX + e * W, sy = (e: number) => OY - e * H;

type Phase = 'vectors' | 'similar' | 'directions' | 'arithmetic' | 'geometry' | 'run';

export function EmbeddingSection() {
  const [ai, setAi] = useState(0);
  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <Emb phase={key} ai={0} /> });

  const scenes: StoryScene[] = [
    scene('vectors', 'Words become vectors', 'A word2vec model turns every word into a vector of numbers, trained so that words used in similar contexts end up with similar vectors — you shall know a word by the company it keeps. Plot them and related words land near each other, with no dictionary ever consulted.'),
    scene('similar', 'Similarity is distance', 'Closeness in the space means closeness in meaning: king sits near queen and prince (royalty), man near boy (male). Nothing labelled these groups — they fell out of counting which words appear near which, across billions of sentences.'),
    scene('directions', 'Directions carry meaning', 'Here is the striking part. The arrow from man to woman — call it the “gender” direction — is the very same arrow from king to queen, and from boy to girl. One consistent direction in the space encodes a single concept: “make it female.”'),
    scene('arithmetic', 'Analogies become arithmetic', 'So you can do algebra on meaning. Start at king, subtract man, add woman — following that gender arrow — and you land almost exactly on queen. king − man + woman ≈ queen. The four words form a parallelogram in the embedding space.'),
    scene('geometry', 'Meaning as geometry', 'Gender is one direction; plural, tense, and even “capital-of” are others. Because relationships are consistent directions, search, recommendation, and the input layer of every language model all rest on this: words arrive as vectors whose geometry already encodes how they relate — learned from nothing but text statistics.'),
    { key: 'run', title: 'Do algebra on words', caption: 'Pick an analogy and watch a − b + c land on its nearest word. The subtraction cancels one attribute and the addition swaps in another; the result lands in the right cluster because each attribute is its own consistent direction. Real embeddings do this across hundreds of dimensions at once.', render: () => <Emb phase="run" ai={ai} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>A word embedding turns each word into a vector, trained so that words used in similar contexts end up with similar vectors — the distributional idea that you know a word by the company it keeps. Plot them and related words cluster, with no dictionary involved. The striking result is that <strong>directions carry meaning</strong>: the arrow from “man” to “woman” is the same as the arrow from “king” to “queen,” so relationships become vector arithmetic and <strong>king − man + woman ≈ queen</strong>.</>,
        takeaway: <>Training slides each word’s vector so it predicts (or is predicted by) its neighbours in real text; words that share contexts converge to nearby vectors, and — remarkably — consistent semantic relationships fall out as consistent <em>directions</em>. Gender is one direction, plural another, “capital-of” another, so analogies are computable: take king’s vector, subtract man’s, add woman’s, and the result sits almost exactly on queen (both pairs share the same gender arrow, so it’s a parallelogram in the space). Similarity is the angle between vectors (cosine), and nearest-neighbour search finds related words. All of it is learned from raw co-occurrence counts — no labels, no dictionary — which is why embeddings became the universal input representation: they drive semantic search and recommendations, and every large language model begins by mapping tokens to vectors whose geometry already encodes how words relate. (Real embeddings live in hundreds of dimensions; this is a 2-D illustration of the same geometry.)</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="emb-ctl">
          {ANALOGIES.map(([a, b, c], i) => <button key={i} type="button" className={`emb-pick ${ai === i ? 'on' : ''}`} onClick={() => setAi(i)}>{a} − {b} + {c}</button>)}
          <span className="emb-live">→ {nearest([E[ANALOGIES[ai][0]][0] - E[ANALOGIES[ai][1]][0] + E[ANALOGIES[ai][2]][0], E[ANALOGIES[ai][0]][1] - E[ANALOGIES[ai][1]][1] + E[ANALOGIES[ai][2]][1]], ANALOGIES[ai])}</span>
        </div>
      )}
    />
  );
}

function Emb({ phase, ai }: { phase: Phase; ai: number }) {
  const on = (p: Phase) => phase === p;
  const [a, b, c] = ANALOGIES[ai];
  const result = [E[a][0] - E[b][0] + E[c][0], E[a][1] - E[b][1] + E[c][1]];
  const near = nearest(result, [a, b, c]);
  const genderPairs: [string, string][] = [['man', 'woman'], ['king', 'queen'], ['boy', 'girl']];
  const showDir = on('directions');
  const showAna = on('arithmetic') || on('run');
  return (
    <svg viewBox="0 0 900 480" className="story-svg">
      <text x="60" y="34" className="emb-col">word embedding space — 2-D illustration (real: hundreds of dims)</text>
      {/* faint axes labels */}
      <text x={OX} y={OY + 26} className="emb-axis">← commoner</text><text x={OX + W} y={OY + 26} className="emb-axis" textAnchor="end">royal →</text>
      <text x={OX - 16} y={OY} className="emb-axis" textAnchor="end">male</text><text x={OX - 16} y={sy(1) + 6} className="emb-axis" textAnchor="end">female</text>

      {/* gender-direction arrows (parallel) */}
      {showDir && genderPairs.map(([p, q], i) => (
        <line key={i} x1={sx(E[p][0])} y1={sy(E[p][1])} x2={sx(E[q][0])} y2={sy(E[q][1])} className="emb-dir" markerEnd="url(#embarrow)" />
      ))}

      {/* analogy: parallelogram + result */}
      {showAna && <>
        <line x1={sx(E[b][0])} y1={sy(E[b][1])} x2={sx(E[c][0])} y2={sy(E[c][1])} className="emb-ana" markerEnd="url(#embarrow)" />
        <line x1={sx(E[a][0])} y1={sy(E[a][1])} x2={sx(result[0])} y2={sy(result[1])} className="emb-ana res" markerEnd="url(#embarrow)" />
        <circle cx={sx(result[0])} cy={sy(result[1])} r="13" className="emb-target" />
        <text x={sx(result[0])} y={sy(result[1]) - 18} className="emb-reslbl" textAnchor="middle">{a} − {b} + {c} ≈ {near}</text>
      </>}

      {/* word points */}
      {WORDS.map((w) => {
        const hot = showAna && (w === a || w === b || w === c || w === near);
        return (
          <g key={w}>
            <circle cx={sx(E[w][0])} cy={sy(E[w][1])} r={hot ? 7 : 5} className={`emb-pt ${w === near && showAna ? 'near' : ''}`} />
            <text x={sx(E[w][0]) + 10} y={sy(E[w][1]) + 4} className={`emb-word ${hot ? 'hot' : ''}`}>{w}</text>
          </g>
        );
      })}

      <defs><marker id="embarrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="hsl(280 60% 66%)" /></marker></defs>

      <text x="450" y="452" className="emb-foot" textAnchor="middle">
        {on('vectors') ? 'each word is a vector; similar-context words get similar vectors'
          : on('similar') ? 'nearby = similar meaning — royalty clusters, genders separate'
          : on('directions') ? 'man→woman, king→queen, boy→girl: the same “gender” direction'
          : on('arithmetic') ? `${a} − ${b} + ${c} lands on ${near} — a parallelogram in the space`
          : on('geometry') ? 'relationships are directions; meaning becomes geometry, learned from text'
          : `${a} − ${b} + ${c} ≈ ${near} · each attribute is its own direction`}
      </text>
    </svg>
  );
}
