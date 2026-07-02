// Spectre v1 (bounds-check bypass), deep-taught on the GuidedStory engine (offensive arc, phase 2). The CPU speculates
// past a bounds check, transiently reads a secret out of bounds, and uses it to index a second array — leaving a warm
// cache line that Flush+Reload times back out. Narrated scenes walk speculation → transient OOB read → cache footprint
// → Flush+Reload → mitigation; the interactive runs the REAL model from the tested spectre.ts (gadget + flushReload),
// leaking the secret byte by byte with a live 256-line timing chart. Sandboxed/CONCEPTUAL; no real target.
import { useMemo, useState } from 'react';
import { makeMemory, probe, HIT_CYCLES } from './spectre';
import { GuidedStory, type StoryScene } from './GuidedStory';

const PUBLIC = [10, 20, 30, 40, 50, 60, 70, 80];
const SECRET = 'hunter2!';
const chr = (b: number) => (b >= 32 && b < 127 ? String.fromCharCode(b) : '·');

type Phase = 'speculate' | 'oob' | 'footprint' | 'flushreload' | 'recover' | 'run';

export function SpectreSection() {
  const [mitigated, setMitigated] = useState(false);
  const [leaked, setLeaked] = useState(0);
  const mem = useMemo(() => makeMemory(PUBLIC, SECRET), []);
  const secretLen = SECRET.length;

  const sceneState: Record<Exclude<Phase, 'run'>, { leaked: number; mit: boolean }> = {
    speculate: { leaked: 0, mit: false }, oob: { leaked: 0, mit: false }, footprint: { leaked: 1, mit: false },
    flushreload: { leaked: 1, mit: false }, recover: { leaked: secretLen, mit: false },
  };

  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string): StoryScene =>
    ({ key, title, caption, render: () => <Spec phase={key} mem={mem} leaked={sceneState[key].leaked} mitigated={sceneState[key].mit} /> });

  const scenes: StoryScene[] = [
    scene('speculate', 'The CPU runs ahead speculatively', 'A modern CPU does not wait for a branch to resolve. At if (x < array1_size) it guesses the outcome and executes the body ahead of time. Train the branch with in-bounds values so it predicts “true,” and it will keep predicting true — even for the next call.'),
    scene('oob', 'A transient out-of-bounds read', 'Now feed a malicious, out-of-bounds x. The CPU speculatively runs array1[x] before the bounds check finishes — reading a secret byte that lives just past the array. When it notices the misprediction it throws the result away, so architecturally nothing happened. Almost.'),
    scene('footprint', 'The secret leaves a cache footprint', 'Before the rollback, the gadget used that secret byte to index a second array: array2[secret · 256]. That load pulled one cache line in. The rollback undoes the register, but it does NOT evict the cache line — the microarchitectural state still remembers which line was touched.'),
    scene('flushreload', 'Flush+Reload times it back out', 'So flush all 256 lines of array2, run the gadget, then time each line. 255 are slow (a DRAM miss, ~300 cycles); one is fast (an L1 hit, ~50). The fast line’s index IS the secret byte. The tall bar below is the leak — read purely from timing, through a channel that was never meant to carry data.'),
    scene('recover', 'Dump memory, no bug required', 'Repeat for each offset and the whole secret falls out. There was no buffer overflow, no memory-safety bug — the leak lives in the CPU’s speculation itself, so it crosses any software boundary: a sandbox, another process, the kernel.'),
    { key: 'run', title: 'Leak it yourself', caption: 'Leak the secret one byte at a time (or dump it all) and watch the 256-line timing chart spike at the secret’s value each round. Toggle lfence: a speculation barrier after the bounds check stops the transient load, the spike vanishes, and nothing leaks — at the cost of the speed speculation buys.', render: () => <Spec phase="run" mem={mem} leaked={leaked} mitigated={mitigated} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>A modern CPU doesn’t wait for a branch to resolve — it guesses the outcome and races ahead, executing <strong>speculatively</strong>. Spectre abuses that: train the bounds check <code>if (x &lt; size)</code> to predict “true,” then feed a huge out-of-bounds <code>x</code>. The CPU speculatively reads memory it never should — the secret past the array — and uses that byte to index a second array before the misprediction is caught. The architectural result is discarded, but the cache line it touched stays warm, and timing that line reads the secret back out.</>,
        takeaway: <>The leak is a side channel: the speculative out-of-bounds read leaves no architectural trace (the register is rolled back), but it loads <code>array2[secret × 256]</code> into cache. Flush+Reload then times all 256 lines — the one that returns fast (an L1 hit, ~50 cycles vs ~300 for a DRAM miss) is the secret byte. Repeat and you dump memory across a security boundary — a sandbox, another process, the kernel — with <em>no</em> memory-safety bug at all; the bug is in the microarchitecture. Mitigations serialize or constrain speculation: an <code>lfence</code> after the bounds check, index masking, retpolines for the indirect-branch variant. This is why Spectre couldn’t be fully fixed in software and reshaped CPU design — speculation is why chips are fast, and this is its price. (Kocher et al., 2018.)</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <>
          <button type="button" className={`spx-mit ${mitigated ? 'on' : ''}`} onClick={() => { setMitigated((m) => !m); setLeaked(0); }}>{mitigated ? '🛡 lfence ON' : 'lfence OFF'}</button>
          <button type="button" className="spx-btn" disabled={leaked >= secretLen} onClick={() => setLeaked((l) => l + 1)}>leak next byte →</button>
          <button type="button" className="spx-btn strong" disabled={leaked >= secretLen} onClick={() => setLeaked(secretLen)}>dump memory</button>
          <button type="button" className="spx-btn ghost" onClick={() => setLeaked(0)}>reset</button>
        </>
      )}
    />
  );
}

function Spec({ phase, mem, leaked, mitigated }: { phase: Phase; mem: ReturnType<typeof makeMemory>; leaked: number; mitigated: boolean }) {
  const secretLen = mem.bytes.length - mem.array1Size;
  const curX = mem.array1Size + Math.min(leaked < secretLen ? leaked : secretLen - 1, secretLen - 1);
  const cur = probe(mem, curX, mitigated);
  const oobActive = phase === 'oob' || phase === 'footprint' || phase === 'flushreload' || phase === 'recover' || phase === 'run';
  const chartOn = phase === 'footprint' || phase === 'flushreload' || phase === 'recover' || phase === 'run';
  return (
    <svg viewBox="0 0 900 480" className="story-svg">
      {/* gadget */}
      <text x="40" y="40" className="spx-s-code">if (x &lt; array1_size)          // predicted "true"</text>
      <text x="40" y="62" className="spx-s-code">    y = array2[ array1[x] * 256 ];  // x OOB → reads secret</text>
      {mitigated && <text x="40" y="84" className="spx-s-code fence">    lfence;  // barrier — no speculative load</text>}

      {/* memory strip */}
      <text x="40" y="118" className="spx-s-lbl">memory:</text>
      {mem.bytes.map((b, i) => {
        const isSecret = i >= mem.array1Size; const idx = i - mem.array1Size;
        const shown = !isSecret || idx < leaked; const reading = isSecret && idx === (curX - mem.array1Size) && oobActive;
        return (
          <g key={i}>
            <rect x={120 + i * 44} y={100} width={40} height={34} rx="4" className={`spx-s-cell ${isSecret ? 'secret' : 'pub'} ${shown && isSecret ? 'leaked' : ''} ${reading ? 'reading' : ''}`} />
            <text x={140 + i * 44} y={122} className="spx-s-cv" textAnchor="middle">{isSecret ? (shown ? chr(b) : '?') : b}</text>
          </g>
        );
      })}
      <text x={120 + mem.array1Size * 44} y={150} className="spx-s-tag" >↑ array1 bounds — secret lives past here</text>

      {/* Flush+Reload timing chart */}
      <text x="40" y="190" className="spx-s-lbl">Flush+Reload — access time of each of the 256 array2 lines{chartOn && !mitigated ? ` (probing offset ${curX - mem.array1Size})` : ''}</text>
      <line x1="40" y1="360" x2="860" y2="360" className="spx-s-axis" />
      {chartOn && cur.times.map((t, i) => {
        const hit = t <= HIT_CYCLES; const h = hit ? 150 : 5;
        return <rect key={i} x={40 + i * 3.2} y={360 - h} width={2.4} height={h} className={`spx-s-bar ${hit ? 'hit' : ''}`} />;
      })}
      {chartOn && cur.recovered !== null && (
        <text x={Math.min(820, 40 + cur.recovered * 3.2)} y={200} className="spx-s-spike" textAnchor="middle">line {cur.recovered} = ‘{chr(cur.recovered)}’ ← fast (L1 hit) = the secret byte</text>
      )}
      {chartOn && cur.recovered === null && <text x="450" y="290" className="spx-s-flat" textAnchor="middle">lfence stops the speculative load → no line is cached → nothing leaks</text>}

      <text x="450" y="452" className="spx-s-foot" textAnchor="middle">
        {phase === 'speculate' ? 'the CPU executes the branch body before the bounds check resolves'
          : phase === 'oob' ? 'the transient read touches memory past the array — then is rolled back'
          : phase === 'footprint' ? 'rollback undoes the register, not the warm cache line'
          : phase === 'flushreload' ? 'one fast line among 255 slow ones — timing carries the secret'
          : phase === 'recover' ? `recovered “${SECRET}” — no memory-safety bug, the CPU leaked it`
            : mitigated ? 'lfence ON: the spike is gone — but you paid the speed speculation buys'
              : `${leaked}/${secretLen} bytes leaked by timing`}
      </text>
    </svg>
  );
}
