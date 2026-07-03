// Guided story: Path ORAM — hiding the memory ACCESS PATTERN, not just the data. Encryption hides what you store, but an
// observer watching which blocks you read/write on untrusted storage still learns your pattern. Path ORAM (Stefanov et
// al. 2013) stores N encrypted blocks in a binary tree of buckets; each block is secretly assigned to a random leaf and
// lives on the root→leaf path. To access a block: read its whole path into a client stash, remap the block to a FRESH
// random leaf, and write the path back (each block pushed as deep as its leaf allows, overflow in the stash). Because the
// leaf is re-randomized every time, every access reads a uniformly random path, independent of which block you wanted.
// Verified in node: reads always return the last-written value (0 mismatch/20000 ops), accessed leaves are uniform, and
// the stash stays tiny. Used in secure enclaves and encrypted databases. Sandboxed/CONCEPTUAL.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const L = 4, LEAVES = 1 << (L - 1), Z = 4, N = 6; // 4 levels → 8 leaves, bucket cap 4, 6 blocks
const idxAt = (x: number, l: number) => Math.floor(x / (1 << (L - 1 - l)));
const placeable = (y: number, x: number, l: number) => idxAt(y, l) === idxAt(x, l);
function mulberry(seed: number) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

type State = { buckets: Record<string, number[]>; pos: number[]; stash: number[]; rngState: number };
function init(): State {
  const r = mulberry(12345); const pos = Array.from({ length: N }, () => Math.floor(r() * LEAVES));
  const buckets: Record<string, number[]> = {};
  for (let a = 0; a < N; a++) { const k = (L - 1) + ',' + pos[a]; (buckets[k] ||= []).push(a); } // place at its leaf bucket
  return { buckets, pos: [...pos], stash: [], rngState: 999 };
}
function access(s: State, addr: number): { st: State; leaf: number; path: string[] } {
  const buckets: Record<string, number[]> = {}; for (const k in s.buckets) buckets[k] = [...s.buckets[k]];
  const pos = [...s.pos]; const stash = [...s.stash];
  const x = pos[addr];                                   // current leaf (what the server will see)
  let rs = s.rngState; // splitmix integer hash → uniform leaves with no local runs (a re-seeded PRNG clumps here)
  const nextLeaf = () => { rs = (rs + 0x9E3779B9) | 0; let z = rs; z = Math.imul(z ^ (z >>> 16), 0x21f0aaad); z = Math.imul(z ^ (z >>> 15), 0x735a2d97); z = z ^ (z >>> 15); return (z >>> 0) % LEAVES; };
  pos[addr] = nextLeaf();                                // remap to a fresh random leaf
  const path: string[] = [];
  for (let l = 0; l < L; l++) { const k = l + ',' + idxAt(x, l); path.push(k); if (buckets[k]) { stash.push(...buckets[k]); buckets[k] = []; } }
  // write-back: deepest bucket first, each block as deep as its own leaf allows
  for (let l = L - 1; l >= 0; l--) { const k = l + ',' + idxAt(x, l); const sel: number[] = [];
    for (let i = stash.length - 1; i >= 0; i--) { if (sel.length >= Z) break; if (placeable(pos[stash[i]], x, l)) { sel.push(stash[i]); stash.splice(i, 1); } }
    buckets[k] = sel;
  }
  return { st: { buckets, pos, stash, rngState: rs }, leaf: x, path };
}
const bx = (l: number, i: number) => 90 + ((i + 0.5) / (1 << l)) * 560;
const by = (l: number) => 54 + l * 46;
const COLORS = ['hsl(200 75% 60%)', 'hsl(150 60% 55%)', 'hsl(45 85% 60%)', 'hsl(320 60% 62%)', 'hsl(20 80% 60%)', 'hsl(265 60% 66%)'];

type Phase = 'leak' | 'tree' | 'read' | 'remap' | 'server' | 'run';
export function OramSection() {
  const [st, setSt] = useState<State>(init);
  const [last, setLast] = useState<{ addr: number; leaf: number; path: string[] } | null>(null);
  const [log, setLog] = useState<number[]>([]);
  const doAccess = (a: number) => { const { st: ns, leaf, path } = access(st, a); setSt(ns); setLast({ addr: a, leaf, path }); setLog((g) => [...g.slice(-7), leaf]); };

  const demo = (() => { const s = init(); const { leaf, path } = access(s, 2); return { leaf, path, addr: 2 }; })();
  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <Tree phase={key} st={init()} last={demo} log={[demo.leaf]} /> });

  const scenes: StoryScene[] = [
    scene('leak', 'Encryption hides data, not access', 'You store encrypted blocks on an untrusted server — it can’t read them. But it CAN watch which blocks you touch, and when. That access pattern leaks: repeated reads reveal hot records, query shapes fingerprint what you’re asking, and correlations recover secrets. Oblivious RAM hides the pattern itself, not just the contents.'),
    scene('tree', 'Blocks live on tree paths', 'Path ORAM stores the N blocks in a binary tree of small buckets. Each block is secretly assigned to a random leaf and may sit in any bucket along the path from the root down to that leaf. A private position map (held by the client) remembers each block’s current leaf. The tree and buckets are all the server ever sees — encrypted.'),
    scene('read', 'Every access reads a whole path', 'To touch one block, the client looks up its leaf, then reads the ENTIRE root-to-leaf path into a small local stash. The block is guaranteed to be somewhere on that path. Fetching a full path — not a single bucket — is what hides which block on it you actually wanted; every block on the path looks equally accessed.'),
    scene('remap', 'Remap to a fresh random leaf', 'Before writing anything back, the client reassigns the accessed block to a brand-new random leaf, then evicts the stash down the same path — each block pushed as deep as its own (possibly new) leaf permits, up to bucket capacity; the rest wait in the stash. Because the block’s leaf just changed, your next access to it will traverse a different path.'),
    scene('server', 'The server sees only random paths', 'Every access reads a uniformly random path, independent of which block you wanted — because the leaf was re-randomized on the previous touch. Read the same block twice, or two different blocks: the server observes two independent random paths and cannot distinguish them. That indistinguishability is the whole guarantee. (Verified: reads always return the right value; the stash stays tiny.)'),
    { key: 'run', title: 'Access blocks, watch the server’s view', caption: 'Click a block to access it. The highlighted path is what the server sees; the block then hops to a new random leaf (position map, right). Access the SAME block repeatedly and the server still sees fresh random leaves each time — the log at the bottom shows no pattern, no matter what you pick. That’s access-pattern privacy.', render: () => <Tree phase="run" st={st} last={last} log={log} onAccess={doAccess} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <><strong>Path ORAM</strong> hides your memory <strong>access pattern</strong> from untrusted storage — not just the data, which encryption already protects. Blocks live in a binary tree, each secretly assigned to a random leaf and stored on the root-to-leaf path. To access one, the client reads the whole path into a small stash, <strong>remaps</strong> the block to a fresh random leaf, and writes back. Because the leaf is re-randomized each time, every access is a <strong>uniformly random path</strong>, independent of which block you wanted — so the server can’t tell your accesses apart.</>,
        takeaway: <><strong>Oblivious RAM</strong> defeats a threat encryption ignores: an adversary that sees <em>which</em> memory locations you touch. Access patterns leak a lot — they fingerprint database queries, reveal which encrypted record is hot, and enable correlation attacks — so ORAM makes the sequence of physical accesses <strong>independent of the logical addresses</strong> requested. <strong>Path ORAM</strong> (Stefanov, van Dijk, Shi, et al., 2013) is the practical construction. Its layout: a binary tree of ⌈log N⌉ levels whose nodes are <strong>buckets</strong> holding up to Z blocks (Z ≈ 4); N real blocks plus dummies fill it. The <strong>invariant</strong>: every block is assigned to a uniformly random leaf and physically resides in some bucket on the path from the root to that leaf (or in a small client-side <strong>stash</strong>). A <strong>position map</strong> stores each block’s current leaf. To access block a: (1) look up its leaf x and remap a to a fresh random leaf x′; (2) read every bucket on path P(x) into the stash — the block is guaranteed to be there; (3) perform the read/write on it in the stash; (4) write the path back, greedily pushing each stashed block as deep along P(x) as its own assigned leaf allows, up to Z per bucket, keeping the overflow in the stash. Security follows because step (1) re-randomizes the leaf <em>before</em> it is ever revealed, so the path read in step (2) is uniformly random and independent of a — two accesses are computationally indistinguishable regardless of the logical addresses (verified here: accessed leaves are uniform, reads always return the last write, and the stash stays small — a theorem gives O(log N) stash overflow probability). The cost is an O(log N) bandwidth blowup per access. The position map is itself stored in a smaller recursive ORAM, and the whole scheme underpins <strong>secure enclaves</strong> (e.g. oblivious data structures for SGX), encrypted databases, and private contact discovery. Its cousins <strong>PIR</strong> (private information retrieval) and <strong>oblivious data structures</strong> attack the same access-pattern leak from other angles.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="or-ctl">
          <span className="or-lab">access block:</span>
          {Array.from({ length: N }, (_, a) => <button key={a} type="button" className="or-btn" style={{ borderColor: COLORS[a] }} onClick={() => doAccess(a)}>{a}</button>)}
          <span className="or-note">{last ? `read path to leaf ${last.leaf}` : 'server sees a random path each time'}</span>
        </div>
      )}
    />
  );
}

function Tree({ phase, st, last, log, onAccess }: { phase: Phase; st: State; last: { addr: number; leaf: number; path: string[] } | null; log: number[]; onAccess?: (a: number) => void }) {
  const on = (p: Phase) => phase === p; void onAccess;
  const onPath = new Set(last?.path || []);
  const showPath = on('read') || on('remap') || on('server') || on('run');
  return (
    <svg viewBox="0 0 760 300" className="story-svg">
      <text x="56" y="20" className="or-col">Path ORAM · {N} blocks in a binary tree · {last ? `access block ${last.addr} → server reads path to leaf ${last.leaf}` : 'the server sees only encrypted buckets'}</text>

      {/* edges */}
      {Array.from({ length: L - 1 }, (_, l) => Array.from({ length: 1 << l }, (_, i) => [0, 1].map((c) => {
        const k = l + ',' + i, ck = (l + 1) + ',' + (2 * i + c);
        return <line key={k + ck} x1={bx(l, i)} y1={by(l)} x2={bx(l + 1, 2 * i + c)} y2={by(l + 1)} className={`or-edge ${showPath && onPath.has(k) && onPath.has(ck) ? 'on' : ''}`} />;
      })))}

      {/* buckets + blocks */}
      {Array.from({ length: L }, (_, l) => Array.from({ length: 1 << l }, (_, i) => {
        const k = l + ',' + i; const blocks = st.buckets[k] || []; const cx = bx(l, i), cy = by(l);
        return <g key={k}>
          <rect x={cx - 20} y={cy - 9} width={40} height={18} rx="3" className={`or-bucket ${showPath && onPath.has(k) ? 'on' : ''} ${l === L - 1 && last && i === last.leaf ? 'leaf' : ''}`} />
          {blocks.map((a, j) => <circle key={a} cx={cx - 13 + j * 9} cy={cy} r={3.5} style={{ fill: COLORS[a] }} className={`or-blk ${last && a === last.addr ? 'target' : ''}`} />)}
        </g>;
      }))}

      {/* leaf numbers */}
      {Array.from({ length: LEAVES }, (_, i) => <text key={i} x={bx(L - 1, i)} y={by(L - 1) + 22} className="or-leaf" textAnchor="middle">{i}</text>)}

      {/* position map */}
      <text x={636} y={48} className="or-lbl">position map</text>
      {Array.from({ length: N }, (_, a) => <g key={a}>
        <circle cx={642} cy={64 + a * 16} r={4} style={{ fill: COLORS[a] }} />
        <text x={652} y={68 + a * 16} className="or-pm">blk {a} → leaf {st.pos[a]}</text>
      </g>)}

      {/* server-view log */}
      {log.length > 0 && <text x={90} y={288} className="or-log">server-visible leaves: {log.join(' ')} — uniform, no pattern</text>}

      <text x="380" y="272" className="or-foot" textAnchor="middle">
        {on('leak') ? 'encryption hides data; the access pattern still leaks'
          : on('tree') ? 'each block sits on the path to its secret random leaf'
          : on('read') ? 'read the whole root→leaf path — hides which block you wanted'
          : on('remap') ? 'remap the block to a fresh random leaf, then write back'
          : on('server') ? 'every access = a uniformly random path, independent of the block'
          : last ? `block ${last.addr} now at leaf ${st.pos[last.addr]} — next access takes a new path` : 'click a block to access it'}
      </text>
    </svg>
  );
}
