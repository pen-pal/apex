// Guided story: how `diff` works (the algorithm behind git diff, code review, patch). It finds the smallest set of
// line inserts/deletes that turns the old file into the new — by finding the LONGEST common subsequence (the lines
// that didn't change); everything else is a delete or an insert. Pictured as a shortest path through an edit graph:
// diagonal = a free match/keep, right = delete, down = insert. Real LCS diff (verified in node: valid minimal edit
// scripts). Myers' O(ND) is the fast version git uses. Distinct from the edit-distance (Levenshtein) section.
import { useMemo, useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const OLD = ['import os', 'x = load()', 'print(x)', 'save(x)'];
const NEWV: Record<string, string[]> = {
  edit: ['import os', 'import sys', 'x = load()', 'log(x)', 'save(x)'],
  add: ['import os', 'x = load()', 'validate(x)', 'print(x)', 'save(x)'],
  del: ['import os', 'x = load()', 'save(x)'],
  rewrite: ['import sys', 'y = fetch()', 'print(y)'],
};
type Step = { op: 'keep' | 'del' | 'ins'; v: string };
function diff(a: string[], b: string[]): { script: Step[]; path: [number, number][]; lcs: number } {
  const N = a.length, M = b.length;
  const dp = Array.from({ length: N + 1 }, () => new Array(M + 1).fill(0));
  for (let i = N - 1; i >= 0; i--) for (let j = M - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const script: Step[] = []; const path: [number, number][] = [[0, 0]]; let i = 0, j = 0;
  while (i < N && j < M) {
    if (a[i] === b[j]) { script.push({ op: 'keep', v: a[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { script.push({ op: 'del', v: a[i] }); i++; }
    else { script.push({ op: 'ins', v: b[j] }); j++; }
    path.push([i, j]);
  }
  while (i < N) { script.push({ op: 'del', v: a[i++] }); path.push([i, j]); }
  while (j < M) { script.push({ op: 'ins', v: b[j++] }); path.push([i, j]); }
  return { script, path, lcs: dp[0][0] };
}

type Phase = 'what' | 'lcs' | 'graph' | 'walk' | 'why' | 'run';

export function DiffSection() {
  const [variant, setVariant] = useState('edit');
  const newv = NEWV[variant];
  const model = useMemo(() => diff(OLD, newv), [newv]);

  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <Diff phase={key} newv={NEWV.edit} m={diff(OLD, NEWV.edit)} /> });

  const scenes: StoryScene[] = [
    scene('what', 'What changed between two versions?', 'A diff answers that with the smallest set of line inserts and deletes that turns the old file into the new one — what git shows you and what a code review hangs its comments on. The hard part is “smallest”: many edit scripts get from old to new, and you want the one with the fewest changes.'),
    scene('lcs', 'Keep as much as possible', 'The lines that didn’t change form a subsequence common to both files. Find the LONGEST common subsequence and everything outside it must be a deletion (in the old, not the new) or an insertion (in the new, not the old). Maximize the kept lines and you minimize the changed ones.'),
    scene('graph', 'It’s a path through a grid', 'Lay the old file across the top and the new file down the side. Wherever two lines match there’s a diagonal step you can take for free — a “keep.” A step right deletes an old line; a step down inserts a new one. A diff is any path from the top-left corner to the bottom-right; the best diff is the path with the most diagonals.'),
    scene('walk', 'Walk the path → the diff', 'Follow the best path and read it off: each diagonal is an unchanged line, each rightward step a deletion (−), each downward step an insertion (+). That’s the diff you see. Filling the whole grid is O(N·M); Myers’ 1986 algorithm finds the same shortest path in O(N·D) — D being the number of edits, usually tiny — which is why git diffs huge files instantly.'),
    scene('why', 'Everywhere you look', 'This same LCS alignment powers git diff, code review, the patch tool, three-way merges, and even bioinformatics lining up DNA. Minimizing edits gives the smallest, most readable diff — and it’s why moving a block reads as a clean delete-here plus insert-there rather than a tangle of changed lines.'),
    { key: 'run', title: 'Change the new version', caption: 'Pick a different edit to the file and watch the diff and its path through the grid recompute. An edit to a line becomes a delete + insert; a moved block becomes a delete here and an insert there; a full rewrite keeps almost nothing. The green path always takes every diagonal (matching line) it can.', render: () => <Diff phase="run" newv={newv} m={model} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>A diff answers “what changed between these two versions?” with the smallest set of line inserts and deletes that turns the old file into the new one — what git shows you and what code review hangs its comments on. The hard part is “smallest”: countless edit scripts get from A to B, and you want the one with the fewest changes, which means keeping as many lines unchanged as possible.</>,
        takeaway: <>The lines that didn’t change form a subsequence common to both files; find the <strong>longest common subsequence</strong> and everything outside it must be a deletion (in the old, not the new) or an insertion (in the new, not the old) — so maximizing kept lines minimizes the diff. Picture a grid with the old file across the top and the new file down the side: a diagonal step where two lines match is a free “keep,” a step right is a delete, a step down is an insert, and the best diff is the corner-to-corner path with the most diagonals. Filling the whole grid is O(N·M); <strong>Myers’ 1986 algorithm</strong> finds the same shortest path in O(N·D) where D is the number of edits (usually tiny), which is why git diffs huge files instantly. The identical LCS alignment is how bioinformatics lines up DNA sequences and how three-way merge decides what each side changed.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="dif-ctl">
          {[['edit', 'edit a line'], ['add', 'insert a line'], ['del', 'delete a line'], ['rewrite', 'rewrite']].map(([id, lbl]) => (
            <button key={id} type="button" className={`dif-pick ${variant === id ? 'on' : ''}`} onClick={() => setVariant(id)}>{lbl}</button>
          ))}
          <span className="dif-live">{model.script.filter((x) => x.op === 'del').length} − · {model.script.filter((x) => x.op === 'ins').length} + · {model.lcs} kept</span>
        </div>
      )}
    />
  );
}

function Diff({ phase, newv, m }: { phase: Phase; newv: string[]; m: ReturnType<typeof diff> }) {
  const on = (p: Phase) => phase === p;
  const N = OLD.length, M = newv.length;
  // edit graph coords
  const gx0 = 470, gy0 = 84, cell = 52;
  const gx = (i: number) => gx0 + i * cell, gy = (j: number) => gy0 + j * cell;
  const showGraph = on('graph') || on('walk') || on('why') || on('run');
  const showPath = on('walk') || on('why') || on('run');
  const trunc = (s: string) => (s.length > 16 ? s.slice(0, 15) + '…' : s);
  return (
    <svg viewBox="0 0 900 480" className="story-svg">
      {/* the diff output */}
      <text x="60" y="46" className="dif-col">the diff</text>
      {m.script.map((st, i) => (
        <g key={i}>
          <rect x="50" y={60 + i * 34} width="380" height="28" rx="4" className={`dif-row ${st.op}`} />
          <text x="64" y={79 + i * 34} className={`dif-sign ${st.op}`}>{st.op === 'del' ? '−' : st.op === 'ins' ? '+' : ' '}</text>
          <text x="88" y={79 + i * 34} className={`dif-line ${st.op}`}>{trunc(st.v)}</text>
        </g>
      ))}

      {/* the edit graph */}
      {showGraph && <>
        <text x={gx(0)} y="66" className="dif-col">edit graph — old → , new ↓</text>
        {/* grid + match diagonals */}
        {Array.from({ length: N + 1 }, (_, i) => <line key={'v' + i} x1={gx(i)} y1={gy(0)} x2={gx(i)} y2={gy(M)} className="dif-grid" />)}
        {Array.from({ length: M + 1 }, (_, j) => <line key={'h' + j} x1={gx(0)} y1={gy(j)} x2={gx(N)} y2={gy(j)} className="dif-grid" />)}
        {OLD.map((la, i) => newv.map((lb, j) => la === lb && <line key={i + '-' + j} x1={gx(i)} y1={gy(j)} x2={gx(i + 1)} y2={gy(j + 1)} className="dif-match" />))}
        {/* the chosen path */}
        {showPath && m.path.slice(1).map((p, i) => {
          const [px, py] = m.path[i], [qx, qy] = p; const diag = qx > px && qy > py;
          return <line key={'p' + i} x1={gx(px)} y1={gy(py)} x2={gx(qx)} y2={gy(qy)} className={`dif-path ${diag ? 'keep' : qx > px ? 'del' : 'ins'}`} />;
        })}
        {showPath && <><circle cx={gx(0)} cy={gy(0)} r="4" className="dif-node" /><circle cx={gx(N)} cy={gy(M)} r="4" className="dif-node end" /></>}
        {/* axis labels */}
        {OLD.map((la, i) => <text key={'ax' + i} x={gx(i) + cell / 2} y={gy(0) - 6} className="dif-axis" textAnchor="middle">{trunc(la).slice(0, 6)}</text>)}
      </>}

      <text x="450" y="452" className="dif-foot" textAnchor="middle">
        {on('what') ? 'the fewest inserts + deletes that turn the old file into the new'
          : on('lcs') ? 'longest common subsequence = the lines to keep; the rest is + / −'
          : on('graph') ? 'diagonal = matching line (free keep); right = delete; down = insert'
          : on('walk') ? 'the shortest corner-to-corner path, favouring diagonals, is the diff'
          : on('why') ? 'git diff, patch, 3-way merge, DNA alignment — all the same LCS math'
          : `${m.script.filter((x) => x.op === 'del').length} deletions, ${m.script.filter((x) => x.op === 'ins').length} insertions, ${m.lcs} lines kept`}
      </text>
    </svg>
  );
}
