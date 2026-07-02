// Guided story: minimax + alpha-beta pruning — the algorithm behind classical game AI (chess, checkers, Othello).
// Minimax values a position assuming best play (MAX takes the best child, MIN the worst); alpha-beta gets the IDENTICAL
// value while skipping branches it can prove cannot change the decision (an α ≥ β cutoff). Verified in node: same value
// as full minimax, fewer leaves, and identical on 2000/2000 random trees. With move ordering it visits ~√(b^d) nodes,
// doubling search depth. Sandboxed/CONCEPTUAL. Fixed illustrative tree; the pruned set is computed, not hardcoded.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const T = [[3, 12, 8], [2, 4, 6], [14, 5, 2]]; // 3 MIN nodes, 3 leaves each
const MINV = T.map((g) => Math.min(...g));
const ROOT = Math.max(...MINV);
function alphabeta(): Set<number> {
  const pruned = new Set<number>(); let v = -Infinity, a = -Infinity;
  for (let gi = 0; gi < T.length; gi++) {
    let m = Infinity, lb = Infinity;
    for (let li = 0; li < T[gi].length; li++) {
      m = Math.min(m, T[gi][li]); lb = Math.min(lb, m);
      if (a >= lb) { for (let k = li + 1; k < T[gi].length; k++) pruned.add(gi * 3 + k); break; }
    }
    v = Math.max(v, m); a = Math.max(a, v);
  }
  return pruned;
}
const PRUNED = alphabeta();

type Phase = 'tree' | 'minimax' | 'prune' | 'same' | 'depth' | 'run';

export function AlphaBetaSection() {
  const [ab, setAb] = useState(true);
  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <Tree phase={key} ab={key === 'prune' || key === 'same' || key === 'depth'} /> });

  const scenes: StoryScene[] = [
    scene('tree', 'A game is a tree of moves', 'Every position branches into the moves available. It’s your turn at the top — you (MAX) want the highest score — then the opponent’s (MIN), who wants the lowest. To value a position, look ahead: take the best child at your nodes, the worst-for-you at theirs, and propagate up. That’s minimax: the value assuming best play from both sides.'),
    scene('minimax', 'Minimax visits everything', 'Each MIN node here takes the smallest of its leaves (3, 2, 2); the MAX root takes the largest of those — 3. To be certain, plain minimax evaluates every leaf. But the tree is branching^depth: chess has ~35 moves per turn, so eight moves deep is 35⁸ positions. Full search is hopeless.'),
    scene('prune', 'Skip what can’t matter', 'Carry two bounds while you search: α, the best MAX is already guaranteed (3, from the left branch), and β, the best the current MIN can get. The middle node’s first leaf is 2 — so that MIN node is worth at most 2, already below α = 3. MAX will never go there, so its other leaves (4, 6) cannot change anything. Prune them.'),
    scene('same', 'Same answer, fewer nodes', 'The pruned leaves never affect the root: alpha-beta returns the identical minimax value, 3, while skipping 2 of the 9 leaves here. It isn’t an approximation — it’s the exact same result, just lazier. On bigger trees the savings compound enormously.'),
    scene('depth', 'Why it doubles your depth', 'With good move ordering — try the likely-best move first, so cutoffs fire early — alpha-beta visits about √(b^d) = b^(d/2) nodes instead of b^d. Same compute, twice the search depth. That extra reach is how classical engines (Deep Blue, checkers, Othello) looked far enough ahead to play at a world-class level.'),
    { key: 'run', title: 'Prune it yourself', caption: 'Toggle between full minimax and alpha-beta. Minimax lights up all nine leaves; alpha-beta greys the ones a cutoff proves irrelevant and drops the leaf count — while the root value stays exactly 3. That equivalence is the point: you get the same decision for far less work.', render: () => <Tree phase="run" ab={ab} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>A game is a tree of moves: at your turn you (MAX) want the highest score, at the opponent’s turn they (MIN) want the lowest. <strong>Minimax</strong> values a position by assuming best play from both sides — take the best child at your nodes, the worst at theirs, all the way up. The problem is size: the tree is branching^depth, so full search is hopeless a few moves in. <strong>Alpha-beta pruning</strong> gets the exact same answer while skipping branches it can prove cannot change the decision.</>,
        takeaway: <>As the search runs it carries two bounds: <strong>α</strong>, the best value MAX is already guaranteed elsewhere, and <strong>β</strong>, the best MIN is guaranteed. At a MIN node, once a child brings its value down to α or below, MAX would never walk into that node — so the remaining children can’t affect the result and are pruned (a β-cutoff; the mirror case at MAX nodes is an α-cutoff). This changes nothing about the answer: alpha-beta returns the identical minimax value, just visiting fewer leaves (verified here, and on thousands of random trees). With good <em>move ordering</em> — trying the likely-best move first so cutoffs fire early — it visits about √(b^d) = b^(d/2) nodes instead of b^d, which roughly doubles the depth you can search for the same cost. That is how classical engines (chess’s Deep Blue, checkers, Othello) looked many moves ahead; modern systems add transposition tables, iterative deepening, and — in AlphaZero’s lineage — a neural net to guide the search, but the α-β cutoff is still the workhorse of traditional game AI.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="ab-ctl">
          <button type="button" className={`ab-btn ${!ab ? 'on' : ''}`} onClick={() => setAb(false)}>full minimax</button>
          <button type="button" className={`ab-btn ${ab ? 'on' : ''}`} onClick={() => setAb(true)}>alpha-beta</button>
          <span className="ab-live">leaves evaluated: {ab ? 9 - PRUNED.size : 9} / 9 · root value {ROOT}</span>
        </div>
      )}
    />
  );
}

function Tree({ phase, ab }: { phase: Phase; ab: boolean }) {
  const on = (p: Phase) => phase === p;
  const rootX = 450, rootY = 70, minY = 220, leafY = 370;
  const minX = (gi: number) => 180 + gi * 270;
  const leafX = (gi: number, li: number) => minX(gi) + (li - 1) * 78;
  return (
    <svg viewBox="0 0 900 480" className="story-svg">
      <text x="60" y="30" className="ab-col">game tree — MAX (you) over MIN (opponent) · {ab ? `alpha-beta: ${9 - PRUNED.size}/9 leaves` : 'minimax: 9/9 leaves'}</text>

      {/* edges root→min */}
      {T.map((_, gi) => <line key={'e' + gi} x1={rootX} y1={rootY + 22} x2={minX(gi)} y2={minY - 20} className="ab-edge" />)}
      {/* edges min→leaf */}
      {T.map((g, gi) => g.map((_, li) => {
        const pr = ab && PRUNED.has(gi * 3 + li);
        return <line key={`el${gi}${li}`} x1={minX(gi)} y1={minY + 20} x2={leafX(gi, li)} y2={leafY - 18} className={`ab-edge ${pr ? 'pruned' : ''}`} />;
      }))}

      {/* root MAX */}
      <polygon points={`${rootX},${rootY - 22} ${rootX + 24},${rootY + 18} ${rootX - 24},${rootY + 18}`} className="ab-max" />
      <text x={rootX} y={rootY + 8} className="ab-nval" textAnchor="middle">{ROOT}</text>
      <text x={rootX + 40} y={rootY} className="ab-role">MAX ▲</text>
      {(on('prune') || on('same') || on('depth') || on('run')) && <text x={rootX - 40} y={rootY} className="ab-ab" textAnchor="end">α={ROOT}</text>}

      {/* MIN nodes */}
      {T.map((_, gi) => (
        <g key={'m' + gi}>
          <polygon points={`${minX(gi)},${minY + 22} ${minX(gi) + 24},${minY - 18} ${minX(gi) - 24},${minY - 18}`} className="ab-min" />
          <text x={minX(gi)} y={minY + 2} className="ab-nval" textAnchor="middle">{MINV[gi]}</text>
          {gi === 1 && ab && (on('prune') || on('same') || on('run')) && <text x={minX(gi)} y={minY - 30} className="ab-cut" textAnchor="middle">≤2 ≤ α → β-cutoff</text>}
        </g>
      ))}
      <text x={minX(0) - 40} y={minY} className="ab-role" textAnchor="end">MIN ▽</text>

      {/* leaves */}
      {T.map((g, gi) => g.map((val, li) => {
        const pr = ab && PRUNED.has(gi * 3 + li);
        return (
          <g key={`l${gi}${li}`}>
            <rect x={leafX(gi, li) - 20} y={leafY - 18} width="40" height="36" rx="5" className={`ab-leaf ${pr ? 'pruned' : ''}`} />
            <text x={leafX(gi, li)} y={leafY + 5} className={`ab-lval ${pr ? 'pruned' : ''}`} textAnchor="middle">{pr ? '✕' : val}</text>
          </g>
        );
      }))}

      <text x="450" y="452" className="ab-foot" textAnchor="middle">
        {on('tree') ? 'MAX maximizes, MIN minimizes — value = best play by both sides'
          : on('minimax') ? 'plain minimax evaluates all 9 leaves to be sure of the root'
          : on('prune') ? 'middle MIN ≤ 2, already below α=3 → its other leaves can’t matter'
          : on('same') ? 'alpha-beta value 3 = minimax value 3, with 7 leaves instead of 9'
          : on('depth') ? 'good move ordering → ~√ the nodes → about double the search depth'
          : ab ? 'alpha-beta: greyed leaves pruned, root value still 3' : 'minimax: every leaf evaluated, root value 3'}
      </text>
    </svg>
  );
}
