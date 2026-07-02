// Guided story: how Rust guarantees memory safety at COMPILE time — ownership + borrowing — the third way, alongside
// tracing GC and reference counting (both runtime). Every value has one owner (freed when its scope ends); moving
// invalidates the source (no double-free / use-after-move); and you may borrow either many shared refs OR one mutable
// ref, never both (no data races / iterator invalidation). A real little borrow checker walks each scenario and
// accepts/rejects it (verified in node: 5/5). Completes the gc + refcount stories. Sandboxed/CONCEPTUAL.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

type Line = { text: string; op?: 'move' | 'use' | 'borrow'; v?: string; from?: string; mut?: boolean; comment?: string };
type Scenario = { id: string; title: string; lines: Line[] };

function check(lines: Line[]): { ok: boolean; failLine: number; why: string } {
  const moved = new Set<string>(); const bShared: Record<string, number> = {}, bMut: Record<string, number> = {};
  for (let i = 0; i < lines.length; i++) {
    const s = lines[i];
    if (s.op === 'use' && s.v && moved.has(s.v)) return { ok: false, failLine: i, why: `use of \`${s.v}\` after it was moved — its value now belongs to the new owner` };
    if (s.op === 'move' && s.from) { if (moved.has(s.from)) return { ok: false, failLine: i, why: `\`${s.from}\` was already moved away` }; moved.add(s.from); }
    if (s.op === 'borrow' && s.v) {
      const sh = bShared[s.v] || 0, mu = bMut[s.v] || 0;
      if (s.mut) { if (mu > 0) return { ok: false, failLine: i, why: `cannot borrow \`${s.v}\` as mutable more than once at a time` }; if (sh > 0) return { ok: false, failLine: i, why: `cannot borrow \`${s.v}\` as mutable while it is also borrowed as shared` }; bMut[s.v] = 1; }
      else { if (mu > 0) return { ok: false, failLine: i, why: `cannot borrow \`${s.v}\` as shared while it is borrowed as mutable` }; bShared[s.v] = sh + 1; }
    }
  }
  return { ok: true, failLine: -1, why: '' };
}

const SCEN: Scenario[] = [
  { id: 'move-ok', title: 'move, then use the new owner', lines: [
    { text: 'let a = String::from("hi");' },
    { text: 'let b = a;', op: 'move', from: 'a', comment: 'ownership moves a → b' },
    { text: 'println!("{}", b);', op: 'use', v: 'b', comment: 'b owns it now — fine' },
  ] },
  { id: 'use-after-move', title: 'use after move', lines: [
    { text: 'let a = String::from("hi");' },
    { text: 'let b = a;', op: 'move', from: 'a', comment: 'a is moved into b' },
    { text: 'println!("{}", a);', op: 'use', v: 'a', comment: 'a no longer owns anything' },
  ] },
  { id: 'many-shared', title: 'many shared borrows', lines: [
    { text: 'let a = vec![1, 2, 3];' },
    { text: 'let r1 = &a;', op: 'borrow', v: 'a', mut: false, comment: 'a shared (read-only) borrow' },
    { text: 'let r2 = &a;', op: 'borrow', v: 'a', mut: false, comment: 'another shared borrow — allowed' },
    { text: 'println!("{} {}", r1.len(), r2.len());' },
  ] },
  { id: 'two-mut', title: 'two mutable borrows', lines: [
    { text: 'let mut a = vec![1, 2, 3];' },
    { text: 'let r1 = &mut a;', op: 'borrow', v: 'a', mut: true, comment: 'one mutable borrow' },
    { text: 'let r2 = &mut a;', op: 'borrow', v: 'a', mut: true, comment: 'a second — not allowed' },
    { text: 'r1.push(4);', op: 'use', v: 'r1' },
  ] },
  { id: 'mut-shared', title: 'mutable while shared', lines: [
    { text: 'let mut a = vec![1, 2, 3];' },
    { text: 'let r = &a;', op: 'borrow', v: 'a', mut: false, comment: 'shared borrow of a' },
    { text: 'a.push(4);', op: 'borrow', v: 'a', mut: true, comment: 'mutate while r still reads a' },
    { text: 'println!("{:?}", r);', op: 'use', v: 'r' },
  ] },
];

type Phase = 'third' | 'owner' | 'move' | 'borrow' | 'race' | 'run';

export function RustOwnershipSection() {
  const [pick, setPick] = useState('two-mut');
  const cur = SCEN.find((s) => s.id === pick)!;

  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string, id: string): StoryScene =>
    ({ key, title, caption, render: () => <Rust scenario={SCEN.find((s) => s.id === id)!} /> });

  const scenes: StoryScene[] = [
    scene('third', 'Memory safety without a collector', 'Tracing GC and reference counting both manage memory at runtime — one with pauses, the other with per-operation counting. Rust takes a third path: it proves memory safety at compile time and adds nothing at runtime. Two rules do it — ownership and borrowing — and the compiler rejects any program that could break them.', 'move-ok'),
    scene('owner', 'One owner, freed at scope end', 'Every value has exactly one owning variable. When that variable’s scope ends, the compiler frees the value right there — deterministic, like a destructor, with no runtime bookkeeping and no collector to run. There is always exactly one thing responsible for freeing it.', 'move-ok'),
    scene('move', 'Moving invalidates the source', 'Assign or pass a value and its ownership moves; the old variable is now invalid. Use it afterward and the program does not compile. That single rule makes a double-free impossible — only one owner ever exists to free the value.', 'use-after-move'),
    scene('borrow', 'Borrow instead of moving', 'To read or change a value without taking ownership, borrow a reference. The rule: any number of shared (read-only) &a borrows at once, OR exactly one mutable &mut a, never both. Aliasing xor mutability.', 'many-shared'),
    scene('race', 'The rule that kills data races', 'Why that rule? If two references could write the same data at once you’d have a data race; if a reference into a vector outlived a push that reallocated it, you’d have a dangling pointer. Forbidding “shared and mutable at the same time” rules out both — at compile time, before the program ever runs.', 'mut-shared'),
    { key: 'run', title: 'Run the borrow checker', caption: 'Pick a program and watch the borrow checker accept it (green) or reject it (red) with the exact reason and the offending line — the same analysis rustc does. Nothing here runs; the safety is proved by the types before any code executes.', render: () => <Rust scenario={cur} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>Tracing GC and reference counting both manage memory at runtime — with pauses, or per-operation counting. Rust takes a third path: it proves memory safety at <strong>compile time</strong> and adds nothing at runtime. Two rules do it. <strong>Ownership</strong>: every value has exactly one owning variable, and when that variable’s scope ends the compiler frees the value — deterministically, with no bookkeeping. <strong>Borrowing</strong>: you can lend out references, but only many read-only borrows at once <em>or</em> a single writable one, never both.</>,
        takeaway: <>Assigning or passing a value <strong>moves</strong> ownership and invalidates the old binding, so using it afterward is a compile error — which makes a double-free impossible, because only one owner ever frees it. To read or modify without taking ownership you <strong>borrow</strong> a reference, and the checker enforces <em>aliasing xor mutability</em>: any number of shared <code>&T</code>, or exactly one <code>&mut T</code>, never both at once. That one rule rules out data races (two threads writing the same data) and iterator invalidation (a reference into a vector a reallocating push would dangle) — at compile time, before the program runs. Lifetimes add that a borrow can’t outlive its owner, so there are no dangling pointers either. The result is C’s performance (no GC, no refcount atomics) with memory and thread safety the compiler <em>guarantees</em>, which is why Rust is spreading into kernels, browsers, and infrastructure — the cost being the learning curve of satisfying the checker.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="own-ctl">
          {SCEN.map((sc) => <button key={sc.id} type="button" className={`own-pick ${pick === sc.id ? 'on' : ''}`} onClick={() => setPick(sc.id)}>{sc.title}</button>)}
        </div>
      )}
    />
  );
}

function Rust({ scenario }: { scenario: Scenario }) {
  const r = check(scenario.lines);
  return (
    <svg viewBox="0 0 900 480" className="story-svg">
      <text x="60" y="46" className="own-col">a Rust program — checked before it runs</text>
      {scenario.lines.map((ln, i) => {
        const bad = !r.ok && i === r.failLine;
        return (
          <g key={i}>
            <rect x="50" y={64 + i * 42} width="800" height="36" rx="5" className={`own-line ${bad ? 'bad' : ''}`} />
            <text x="66" y={87 + i * 42} className="own-code">{ln.text}</text>
            {ln.comment && <text x="470" y={87 + i * 42} className={`own-comment ${bad ? 'bad' : ''}`}>// {bad ? '✗ ' : ''}{ln.comment}</text>}
          </g>
        );
      })}

      <rect x="50" y={300} width="800" height="88" rx="10" className={`own-verdict ${r.ok ? 'ok' : 'bad'}`} />
      <text x="72" y={332} className={`own-vlbl ${r.ok ? 'ok' : 'bad'}`}>{r.ok ? '✓ compiles — memory-safe, guaranteed' : '✗ does not compile'}</text>
      <text x="72" y={362} className="own-vwhy">{r.ok ? 'ownership + borrows are consistent; the freed-when-scope-ends is inserted by the compiler' : `error[borrow check]: ${r.why}`}</text>

      <text x="450" y="452" className="own-foot" textAnchor="middle">
        {r.ok ? 'safe at compile time, zero runtime cost — no GC, no reference counts'
          : 'caught by rustc before running — the class of bug simply cannot reach production'}
      </text>
    </svg>
  );
}
