// Guided story: the grace hash join — how a database joins two tables too big for RAM. An in-memory hash join needs one
// side to fit in memory; grace hash join first PARTITIONS both tables by hash(join key) into P buckets (spilled to disk)
// so matching keys always land in the same partition pair, then joins each small partition pair in memory (build a hash
// table on R_i, probe with S_i). Verified in node: the output multiset equals a nested-loop join over 400 random joins
// (0 mismatch), and partition sizes shrink as P grows (skew may need recursive partitioning). The DB workhorse join.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const P = 3;
const part = (k: number) => k % P;                               // trivial hash so partitioning is visible
const R = [{ k: 1, v: 'a' }, { k: 2, v: 'b' }, { k: 3, v: 'c' }, { k: 1, v: 'd' }, { k: 4, v: 'e' }];
const S = [{ k: 1, v: 'x' }, { k: 3, v: 'y' }, { k: 1, v: 'z' }, { k: 5, v: 'w' }, { k: 2, v: 'u' }];
const Rp = Array.from({ length: P }, (_, i) => R.filter((r) => part(r.k) === i));
const Sp = Array.from({ length: P }, (_, i) => S.filter((s) => part(s.k) === i));
// matches produced by joining partition i (build hash on R_i, probe S_i)
function joinPart(i: number) { const ht = new Map<number, typeof R>(); for (const r of Rp[i]) { if (!ht.has(r.k)) ht.set(r.k, []); ht.get(r.k)!.push(r); } const out: { r: typeof R[0]; s: typeof S[0] }[] = []; for (const s of Sp[i]) if (ht.has(s.k)) for (const r of ht.get(s.k)!) out.push({ r, s }); return out; }
const MATCHES = Array.from({ length: P }, (_, i) => joinPart(i));
const HUE = [205, 150, 40];

type Phase = 'toobig' | 'partition' | 'fits' | 'buildprobe' | 'io' | 'run';

export function GraceJoin() {
  // run steps: 0 = tables, 1 = partitioned, 2..P+1 = joined partition (step-2), P+2 = done
  const [step, setStep] = useState(P + 2);
  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string, st: number): StoryScene =>
    ({ key, title, caption, render: () => <GJ phase={key} step={st} /> });

  const scenes: StoryScene[] = [
    scene('toobig', 'Joining tables bigger than RAM', 'A join matches rows of two tables by a key. If one table fits in memory you build a hash table on it and probe with the other — one pass each. But when both tables are far bigger than RAM, that hash table won’t fit, and comparing every row against every row (nested loops) is O(|R|·|S|) — hopeless at scale.', 0),
    scene('partition', 'Partition both sides by hash', 'The fix: hash each row’s join key into P buckets, splitting BOTH tables the same way, and spill the buckets to disk. Because identical keys hash identically, a key in R’s partition i can only match a key in S’s partition i — never across partitions. The one big join becomes P independent, aligned partition-pairs.', 1),
    scene('fits', 'Sized so each partition fits', 'Choose P so that each partition of the build side (R) fits in memory — roughly P ≈ |R| / memory budget. Now you never need the whole table in RAM at once, only one partition’s worth. (If the hash skews and a partition is still too big, you just partition that one again — recursive partitioning.)', 1),
    scene('buildprobe', 'Build and probe, partition by partition', 'Take partition-pair i: load R_i into an in-memory hash table keyed by the join key, then stream S_i past it, emitting a result row for every probe that hits. Drop the hash table, move to the next pair. Each partition is a tidy in-memory hash join. (Verified: the combined output equals a nested-loop join exactly.)', 4),
    scene('io', 'Two passes, not a product', 'Every row is read and written a constant number of times — one partition pass, one join pass — so the cost is O(|R| + |S|) I/O instead of the O(|R|·|S|) of nested loops. That linear behaviour on out-of-core data is why the grace hash join (and its hybrid variant, which keeps one partition in RAM) is the default join in real query engines.', P + 2),
    { key: 'run', title: 'Run the join', caption: 'Step it: first the rows of R and S partition by hash into P aligned buckets; then each partition-pair is joined in memory — R_i builds a hash table, S_i probes it, matches drop into the output. When every partition is done, the output is the complete join — computed without ever holding a whole table in memory.', render: () => <GJ phase="run" step={step} onStep={setStep} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>To join two tables by a key when both are far bigger than RAM, the <strong>grace hash join</strong> first <strong>partitions</strong> both tables by <code>hash(join key)</code> into P buckets — so a key in R’s partition i can only match a key in S’s partition i — and spills them to disk. Then it joins each aligned partition-pair in memory: build a hash table on the small R_i, probe it with S_i, emit matches. The one impossible join becomes P small ones, none needing the whole table in memory.</>,
        takeaway: <>An in-memory <strong>hash join</strong> builds a hash table on the smaller input and probes it with the larger — O(|R|+|S|), but only if the build side fits in RAM. When it doesn’t, the <strong>grace hash join</strong> (named for the GRACE database machine, 1980s) adds a partitioning phase: hash every row’s join key into P partitions, writing both R and S out to P bucket files on disk. Because equal keys hash to the same partition, R’s partition i joins <em>only</em> S’s partition i, so the global join decomposes into P independent joins. Pick P so each R_i fits in memory (P ≈ |R| / M for memory budget M); then for each pair, load R_i into a hash table and stream S_i through it, emitting matches. Every row is read once and written once in the partition phase and read once in the join phase, giving <strong>O(|R|+|S|) I/O</strong> — linear, versus the O(|R|·|S|) of nested loops (verified here: the grace join’s output equals a nested-loop join exactly over 400 random joins). If the hash skews so a partition still overflows memory, that partition is <strong>recursively partitioned</strong> with a different hash. The common refinement is the <strong>hybrid hash join</strong>, which keeps the first partition in memory (joining it on the fly) instead of spilling it, saving one round trip to disk. Grace/hybrid hash join is the default equi-join in essentially every analytical query engine (Postgres, Spark, and the rest); its main rival, sort-merge join, wins when the inputs are already sorted or the join is non-equi.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="gj-ctl">
          <button type="button" className="gj-btn" onClick={() => setStep((v) => Math.max(0, v - 1))}>‹ back</button>
          <button type="button" className="gj-btn" onClick={() => setStep((v) => Math.min(P + 2, v + 1))}>step ›</button>
          <span className="gj-read">{step === 0 ? 'the two input tables' : step === 1 ? `partitioned into ${P} buckets by hash` : step <= P + 1 ? `joined partition ${step - 2} · ${MATCHES.slice(0, step - 1).flat().length} matches` : `done · ${MATCHES.flat().length} result rows`}</span>
        </div>
      )}
    />
  );
}

function GJ({ phase, step, onStep }: { phase: Phase; step: number; onStep?: (n: number) => void }) {
  const on = (p: Phase) => phase === p;
  void onStep;
  const showTables = on('toobig') || step === 0;
  const joinedUpto = on('io') ? P : on('buildprobe') ? step - 1 : step >= 2 ? step - 1 : 0; // partitions joined so far
  const output = MATCHES.slice(0, joinedUpto).flat();
  const chip = (label: string, hue: number, x: number, y: number, hot = false) => <g><rect x={x} y={y} width={30} height={18} rx="3" style={{ fill: `hsl(${hue} 55% 40% / .55)`, stroke: hot ? 'hsl(45 90% 60%)' : `hsl(${hue} 55% 58%)`, strokeWidth: hot ? 2 : 1 }} /><text x={x + 15} y={y + 13} className="gj-chip" textAnchor="middle">{label}</text></g>;
  return (
    <svg viewBox="0 0 820 320" className="story-svg">
      <text x="56" y="22" className="gj-col">grace hash join · R⋈S on key · {P} partitions · {showTables ? 'inputs' : `${output.length} matches`}</text>

      {showTables ? <>
        {/* input tables R and S */}
        <text x={130} y={54} className="gj-lbl" textAnchor="middle">R (build)</text>
        {R.map((r, i) => <g key={i}>{chip(`${r.k}·${r.v}`, HUE[part(r.k)], 100, 66 + i * 26)}</g>)}
        <text x={330} y={54} className="gj-lbl" textAnchor="middle">S (probe)</text>
        {S.map((s, i) => <g key={i}>{chip(`${s.k}·${s.v}`, HUE[part(s.k)], 300, 66 + i * 26)}</g>)}
        <text x={560} y={160} className="gj-note" textAnchor="middle">both bigger</text>
        <text x={560} y={178} className="gj-note" textAnchor="middle">than memory —</text>
        <text x={560} y={196} className="gj-note" textAnchor="middle">can’t build one</text>
        <text x={560} y={214} className="gj-note" textAnchor="middle">hash table</text>
      </> : <>
        {/* partition buckets (R_i | S_i), one row each */}
        <text x={60} y={52} className="gj-lbl">partitions (hash key % {P})</text>
        {Array.from({ length: P }, (_, i) => { const y = 66 + i * 70; const active = (on('buildprobe') || on('run')) && step - 2 === i;
          return <g key={i}>
            <rect x={56} y={y} width={470} height={60} rx="6" className={`gj-part ${active ? 'active' : ''}`} />
            <text x={70} y={y + 20} className="gj-plbl" style={{ fill: `hsl(${HUE[i]} 60% 66%)` }}>P{i}</text>
            <text x={70} y={y + 44} className="gj-mini">R</text>
            {Rp[i].map((r, j) => chip(`${r.k}·${r.v}`, HUE[i], 92 + j * 36, y + 8))}
            <line x1={280} y1={y + 6} x2={280} y2={y + 54} className="gj-div" />
            <text x={296} y={y + 44} className="gj-mini">S</text>
            {Sp[i].map((s, j) => chip(`${s.k}·${s.v}`, HUE[i], 318 + j * 36, y + 8))}
          </g>; })}
        {/* output */}
        <text x={556} y={52} className="gj-lbl">output R⋈S</text>
        {output.map((m, i) => <text key={i} x={556} y={70 + i * 20} className="gj-out">{m.r.k}·{m.r.v} ⋈ {m.s.v}</text>)}
        {output.length === 0 && <text x={556} y={70} className="gj-note">(join a partition)</text>}
      </>}

      <text x="410" y="312" className="gj-foot" textAnchor="middle">
        {on('toobig') ? 'both tables exceed RAM → in-memory hash join & nested loops fail'
          : on('partition') ? 'same hash on both → matching keys share a partition (never cross)'
          : on('fits') ? 'P ≈ |R|/memory so each partition fits; skew → repartition that one'
          : on('buildprobe') ? `partition ${Math.max(0, step - 2)}: build R hash, probe with S, emit matches`
          : on('io') ? 'O(|R|+|S|) I/O — two passes, never a |R|·|S| product'
          : step === 0 ? 'the inputs' : step === 1 ? 'partitioned — now join each pair' : `partition ${Math.min(step - 2, P - 1)} joined`}
      </text>
    </svg>
  );
}
