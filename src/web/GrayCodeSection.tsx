// Guided story: Gray code (reflected binary) — ordering the integers so consecutive values differ by exactly one bit.
// A rotary/optical encoder reading position as bits fails at binary boundaries (3→4 flips all bits; a mid-transition
// misread gives garbage like 7 or 0). Gray code flips one bit per step, so any misread is off by ≤1. Build by
// reflect-and-prefix, or gray(n)=n^(n>>1); decode by XOR-scan. Verified in node: every consecutive pair (incl. wrap)
// differs by exactly 1 bit, round-trip exact. Used in encoders, clock-domain counters, Karnaugh maps. Sandboxed.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const W = 4, M = 1 << W;
const gray = (n: number) => n ^ (n >> 1);
const bitsOf = (n: number) => Array.from({ length: W }, (_, i) => (n >> (W - 1 - i)) & 1);
const pop = (n: number) => { let c = 0; while (n) { c += n & 1; n >>= 1; } return c; };
// possible mid-transition reads when going a→b (each bit independently old or new)
function intermediates(a: number, b: number): number[] {
  const diff = a ^ b; const idxs: number[] = []; for (let i = 0; i < W; i++) if ((diff >> i) & 1) idxs.push(i);
  const out = new Set<number>(); for (let m = 0; m < (1 << idxs.length); m++) { let v = a; for (let j = 0; j < idxs.length; j++) if ((m >> j) & 1) v ^= 1 << idxs[j]; out.add(v); }
  out.delete(a); out.delete(b); return [...out].sort((x, y) => x - y);
}

type Phase = 'read' | 'flip' | 'gray' | 'build' | 'uses' | 'run';

export function GrayCodeSection() {
  const [n, setN] = useState(4);
  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string, at: number): StoryScene =>
    ({ key, title, caption, render: () => <Gray phase={key} n={at} /> });

  const scenes: StoryScene[] = [
    scene('read', 'An encoder reads position as bits', 'A rotary or optical encoder senses its angle by reading bits off tracks on a disk — a sensor sees light or dark, 1 or 0. Spin it and the number counts up: 0, 1, 2, 3… Each position is a binary pattern the machine reads directly. But the boundaries hide a problem.', 3),
    scene('flip', 'Binary flips many bits at once', 'Going from 3 to 4, plain binary flips all three bits: 011 → 100. The sensors never switch at exactly the same instant, so for a moment mid-transition you might read 111 (7) or 000 (0) — a position wildly wrong. Every carry boundary is a landmine of possible garbage reads.', 4),
    scene('gray', 'Gray code: one bit at a time', 'Reorder the codes so consecutive positions differ in exactly one bit. Now 3 → 4 flips a single bit (010 → 110). During the transition you read either 3 or 4 and nothing else — a misaligned sensor is off by at most one position, ever. No possible garbage.', 4),
    scene('build', 'How to build it', 'Two ways. Reflect-and-prefix: mirror the k-bit sequence, prefix the first half with 0 and the mirror with 1 — the join is a single-bit step, and it stays that way. Or the one-liner: gray(n) = n XOR (n ≫ 1), and decode by XOR-scanning the bits from the top down.', 5),
    scene('uses', 'Where one-bit-change pays off', 'Rotary and optical shaft encoders use it so a read is never garbage. Counters that cross clock domains use it because a value sampled mid-increment can only be off by one, never metastable-garbage. And Karnaugh maps lay inputs out in Gray order so logically adjacent terms sit side by side and simplifications are visible.', 6),
    { key: 'run', title: 'Turn the dial', caption: 'Step the position and compare the two encodings bit for bit. Plain binary lights up several changed bits at the carry boundaries (with the garbage values a mistimed read could produce); Gray code changes exactly one bit at every step. That single-bit guarantee is the entire point of using it.', render: () => <Gray phase="run" n={n} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>A rotary or optical encoder reads its position as bits off tracks on a disk. With plain binary, incrementing across certain boundaries flips several bits at once — 3 (011) to 4 (100) flips all three — and because the sensors never switch at exactly the same instant, mid-transition you can momentarily read a completely wrong value like 7 or 0. <strong>Gray code</strong> fixes this by ordering the values so consecutive ones differ in exactly one bit, so any transition moves a single sensor and a misread is off by at most one position.</>,
        takeaway: <>Gray code (reflected binary) reorders the integers so each value differs from the next by exactly one bit — verified here for every consecutive pair, including the wrap-around. You build it by <strong>reflection</strong>: mirror the k-bit sequence and prefix the original half with 0 and the mirror with 1, doubling the length each step; equivalently, encode with <code>gray(n) = n XOR (n ≫ 1)</code> and decode by XOR-scanning the bits from the top down. The single-bit-change property makes it robust to timing skew: since only one sensor switches at a boundary, a value sampled mid-transition is always the old or the new position, never a garbage in-between — which is why it is used in rotary and optical shaft encoders, in counters that cross <strong>clock domains</strong> (a metastable sample can only be off by one), and in <strong>Karnaugh maps</strong>, where laying inputs out in Gray order puts logically adjacent terms side by side so simplifications jump out. The same “limit the damage of one wrong bit” idea appears in some analog-to-digital and error-tolerant coding schemes.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="gry-ctl">
          <button type="button" className="gry-btn" onClick={() => setN((v) => (v - 1 + M) % M)}>− step</button>
          <button type="button" className="gry-btn" onClick={() => setN((v) => (v + 1) % M)}>step +</button>
          <span className="gry-live">position {n} · binary {bitsOf(n).join('')} · gray {bitsOf(gray(n)).join('')}</span>
        </div>
      )}
    />
  );
}

function Gray({ phase, n }: { phase: Phase; n: number }) {
  const on = (p: Phase) => phase === p;
  const prev = (n - 1 + M) % M;
  const binNow = bitsOf(n), binPrev = bitsOf(prev), gNow = bitsOf(gray(n)), gPrev = bitsOf(gray(prev));
  const binFlips = pop(n ^ prev), garbage = intermediates(prev, n);
  const showBoth = !on('build');
  const row = (label: string, now: number[], prevb: number[], y: number, kind: string, showFlip: boolean) => (
    <g>
      <text x="120" y={y + 26} className="gry-rlbl" textAnchor="end">{label}</text>
      {now.map((b, i) => { const flip = showFlip && b !== prevb[i]; return (
        <g key={i}><rect x={150 + i * 60} y={y} width="48" height="40" rx="6" className={`gry-bit ${b ? 'on' : ''} ${flip ? kind : ''}`} /><text x={174 + i * 60} y={y + 27} className="gry-bval" textAnchor="middle">{b}</text></g>
      ); })}
    </g>
  );
  return (
    <svg viewBox="0 0 900 480" className="story-svg">
      <text x="60" y="34" className="gry-col">position {prev} → {n}{showBoth ? ` · binary flips ${binFlips} bit${binFlips === 1 ? '' : 's'}, gray flips 1` : ''}</text>

      {on('build') ? <>
        <text x="450" y="70" className="gry-rlbl" textAnchor="middle">n → binary → gray(n) = n XOR (n ≫ 1)</text>
        {Array.from({ length: 8 }, (_, i) => (
          <g key={i}>
            <text x="300" y={110 + i * 40} className="gry-trow" textAnchor="end">{i}</text>
            <text x="430" y={110 + i * 40} className="gry-trow mono" textAnchor="middle">{bitsOf(i).join('')}</text>
            <text x="520" y={110 + i * 40} className="gry-trow" textAnchor="middle">→</text>
            <text x="620" y={110 + i * 40} className="gry-trow mono ok" textAnchor="middle">{bitsOf(gray(i)).join('')}</text>
          </g>
        ))}
      </> : <>
        {(on('read') || on('flip') || on('uses') || on('run')) && row('binary', binNow, binPrev, 130, 'flipbad', on('flip') || on('run') || on('uses'))}
        {(on('gray') || on('uses') || on('run')) && row('Gray', gNow, gPrev, 230, 'flipok', true)}

        {/* garbage-read callout for binary boundaries */}
        {(on('flip') || (on('run') && binFlips > 1)) && garbage.length > 0 && (
          <g>
            <text x="150" y="200" className="gry-warn">⚠ mid-transition a mistimed read could be: {garbage.slice(0, 5).join(', ')}{garbage.length > 5 ? '…' : ''}</text>
          </g>
        )}
        {(on('gray') || on('run')) && <text x="150" y="300" className="gry-safe">✓ only one sensor changes → read is always {prev} or {n}</text>}
      </>}

      <text x="450" y="452" className="gry-foot" textAnchor="middle">
        {on('read') ? 'each position is a bit pattern the encoder reads directly'
          : on('flip') ? 'binary carry flips many bits at once → a mistimed read is garbage'
          : on('gray') ? 'gray code flips exactly one bit → any read is off by at most one'
          : on('build') ? 'gray(n) = n XOR (n ≫ 1); reflect-and-prefix builds the same sequence'
          : on('uses') ? 'encoders, clock-domain counters, Karnaugh maps — all want single-bit steps'
          : `binary flips ${binFlips}, gray flips 1 — step the dial to see it hold`}
      </text>
      {on('run') && <text x="700" y="300" className="gry-hint" textAnchor="middle">use the buttons below to step the dial</text>}
    </svg>
  );
}
