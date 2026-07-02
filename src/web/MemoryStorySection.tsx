// The first guided story: a zoom-through-the-scales tour of DRAM — module → chip → cell array → one 1T1C cell →
// charge/leak/refresh — driven by the reusable GuidedStory engine. The last scene is interactive: write a bit, read
// it (word line HIGH, transistor opens, charge flows onto the bit line), or watch it leak — the reason DRAM refreshes.
// Real DRAM structure (1-transistor-1-capacitor cell, word/bit lines); access timings live in the DRAM section.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

type ChargeState = 'one' | 'zero' | 'reading' | 'leaking';

export function MemoryStorySection() {
  const [charge, setCharge] = useState<ChargeState>('one');
  const scene = (which: string, title: string, caption: string): StoryScene =>
    ({ key: which, title, caption, render: (active) => <Scene which={which} charge={charge} active={active} /> });

  const scenes: StoryScene[] = [
    scene('dimm', 'A stick of RAM', 'Eight black chips on a green board. Each holds billions of bits — and every bit is the same tiny structure, repeated. Fly in.'),
    scene('die', 'Inside one chip', 'A silicon die, split into banks. Each bank is a grid of memory cells, reached by a row address and a column address.'),
    scene('array', 'The cell grid', 'Horizontal word lines pick a row; vertical bit lines carry the data. One cell sits at every crossing — millions per bank.'),
    scene('cell', 'One cell', 'Astonishingly simple: one transistor, one capacitor. The capacitor is the bit — charged is 1, empty is 0. The transistor is the gate.'),
    scene('charge', 'Charge, leak, refresh', 'Raise the word line and the transistor links the capacitor to the bit line, so a sense amp can read it. But the charge leaks in milliseconds — so every row is rewritten thousands of times a second. That refresh is why it is dynamic RAM.'),
  ];

  return (
    <GuidedStory
      scenes={scenes}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <>
          <button type="button" className={charge === 'one' ? 'on' : ''} onClick={() => setCharge('one')}>write 1</button>
          <button type="button" className={charge === 'zero' ? 'on' : ''} onClick={() => setCharge('zero')}>write 0</button>
          <button type="button" onClick={() => { setCharge('reading'); setTimeout(() => setCharge((c) => (c === 'reading' ? 'one' : c)), 1400); }}>read (raise word line)</button>
          <button type="button" onClick={() => setCharge('leaking')}>wait — let it leak</button>
        </>
      )}
    />
  );
}

function Scene({ which, charge, active }: { which: string; charge: ChargeState; active: boolean }) {
  const vb = '0 0 900 480';
  if (which === 'dimm') return (
    <svg viewBox={vb} className="story-svg">
      <rect x="40" y="150" width="820" height="150" rx="8" className="mem-pcb" />
      {Array.from({ length: 8 }, (_, i) => <rect key={i} x={70 + i * 98} y="180" width="78" height="90" rx="4" className={`mem-chip ${i === 3 ? 'focus' : ''}`} />)}
      {Array.from({ length: 40 }, (_, i) => <rect key={i} x={52 + i * 20} y="300" width="12" height="26" className="mem-pin" />)}
      <text x="450" y="130" className="mem-lbl big" textAnchor="middle">DIMM — a memory module</text>
      <text x="109" y="360" className="mem-lbl" textAnchor="middle">gold contacts</text>
      <line x1="109" y1="270" x2="109" y2="340" className="mem-lead focus" />
      <text x="450" y="410" className="mem-lbl dim" textAnchor="middle">8 chips · one highlighted → we fly into it</text>
    </svg>
  );
  if (which === 'die') return (
    <svg viewBox={vb} className="story-svg">
      <rect x="250" y="70" width="400" height="340" rx="10" className="mem-die" />
      {Array.from({ length: 4 }, (_, r) => Array.from({ length: 4 }, (_, c) => (
        <rect key={`${r}-${c}`} x={278 + c * 90} y={98 + r * 78} width="76" height="64" rx="3" className={`mem-bank ${r === 1 && c === 2 ? 'focus' : ''}`} />
      )))}
      <text x="450" y="50" className="mem-lbl big" textAnchor="middle">one chip → a silicon die of banks</text>
      <text x="450" y="440" className="mem-lbl dim" textAnchor="middle">each bank is a grid of cells, addressed by row + column</text>
    </svg>
  );
  if (which === 'array') {
    const rows = 6, cols = 8, x0 = 150, y0 = 90, dx = 78, dy = 52;
    return (
      <svg viewBox={vb} className="story-svg">
        {Array.from({ length: rows }, (_, r) => <line key={`w${r}`} x1={x0 - 20} y1={y0 + r * dy} x2={x0 + cols * dx} y2={y0 + r * dy} className={`mem-word ${r === 2 ? 'focus' : ''}`} />)}
        {Array.from({ length: cols }, (_, c) => <line key={`b${c}`} x1={x0 + c * dx} y1={y0 - 20} x2={x0 + c * dx} y2={y0 + rows * dy} className={`mem-bit ${c === 3 ? 'focus' : ''}`} />)}
        {Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => (
          <circle key={`${r}-${c}`} cx={x0 + c * dx} cy={y0 + r * dy} r={r === 2 && c === 3 ? 9 : 5} className={`mem-cell ${r === 2 && c === 3 ? 'focus' : ''}`} />
        )))}
        <text x={x0 - 40} y={y0 + 2 * dy + 4} className="mem-lbl word" textAnchor="end">word line</text>
        <text x={x0 + 3 * dx} y={y0 - 30} className="mem-lbl bit" textAnchor="middle">bit line</text>
        <text x="450" y="450" className="mem-lbl dim" textAnchor="middle">a cell at every word/bit crossing → zoom to one</text>
      </svg>
    );
  }
  if (which === 'cell') return (
    <svg viewBox={vb} className="story-svg">
      <line x1="120" y1="150" x2="470" y2="150" className="mem-word focus" />
      <text x="140" y="135" className="mem-lbl word">word line (row select)</text>
      <line x1="640" y1="80" x2="640" y2="400" className="mem-bit focus" />
      <text x="660" y="90" className="mem-lbl bit">bit line (data)</text>
      <rect x="470" y="130" width="70" height="42" rx="4" className="mem-tr" />
      <text x="505" y="115" className="mem-lbl" textAnchor="middle">transistor</text>
      <line x1="540" y1="151" x2="640" y2="151" className="mem-wire" />
      <line x1="470" y1="172" x2="470" y2="250" className="mem-wire" />
      <line x1="420" y1="250" x2="520" y2="250" className="mem-plate" />
      <line x1="420" y1="278" x2="520" y2="278" className="mem-plate" />
      <line x1="470" y1="278" x2="470" y2="360" className="mem-wire" />
      <line x1="430" y1="360" x2="510" y2="360" className="mem-gnd" />
      <line x1="443" y1="370" x2="497" y2="370" className="mem-gnd" />
      <line x1="454" y1="380" x2="486" y2="380" className="mem-gnd" />
      <text x="470" y="315" className="mem-lbl" textAnchor="middle">capacitor = the bit</text>
      <text x="450" y="450" className="mem-lbl dim" textAnchor="middle">one transistor + one capacitor = one bit (1T1C)</text>
    </svg>
  );
  const level = charge === 'one' || charge === 'reading' ? 1 : charge === 'leaking' ? 0.28 : 0;
  const reading = charge === 'reading';
  return (
    <svg viewBox={vb} className="story-svg">
      <line x1="120" y1="140" x2="470" y2="140" className={`mem-word ${reading ? 'hot' : 'focus'}`} />
      <text x="140" y="125" className={`mem-lbl word ${reading ? 'hot' : ''}`}>word line {reading ? '= HIGH (reading)' : ''}</text>
      <line x1="640" y1="70" x2="640" y2="410" className={`mem-bit focus ${reading ? 'hot' : ''}`} />
      <text x="660" y="82" className="mem-lbl bit">bit line → sense amp</text>
      <rect x="470" y="120" width="70" height="42" rx="4" className={`mem-tr ${reading ? 'open' : ''}`} />
      <text x="505" y="106" className="mem-lbl" textAnchor="middle">{reading ? 'transistor OPEN' : 'transistor'}</text>
      <line x1="540" y1="141" x2="640" y2="141" className={`mem-wire ${reading ? 'hot' : ''}`} />
      <line x1="470" y1="162" x2="470" y2="235" className="mem-wire" />
      <line x1="415" y1="235" x2="525" y2="235" className="mem-plate" />
      <rect x="424" y="238" width="92" height="60" rx="2" className="mem-capwell" />
      <rect x="424" y={238 + 60 * (1 - level)} width="92" height={60 * level} rx="2" className="mem-charge" style={{ transition: 'y .9s ease, height .9s ease' }} />
      <line x1="415" y1="300" x2="525" y2="300" className="mem-plate" />
      {active && level > 0.5 && Array.from({ length: 7 }, (_, i) => (
        <circle key={i} cx={438 + (i % 4) * 22} cy={252 + Math.floor(i / 4) * 24} r="4" className="mem-q" style={{ animationDelay: `${i * 0.18}s` }} />
      ))}
      <line x1="470" y1="300" x2="470" y2="360" className="mem-wire" />
      <line x1="432" y1="360" x2="508" y2="360" className="mem-gnd" />
      <line x1="445" y1="370" x2="495" y2="370" className="mem-gnd" />
      <text x="470" y="330" className="mem-lbl" textAnchor="middle">
        {charge === 'one' ? 'charged = 1' : charge === 'zero' ? 'empty = 0' : charge === 'reading' ? 'draining onto bit line' : 'leaking away…'}
      </text>
      {reading && <line x1="470" y1="141" x2="640" y2="141" className="mem-readflow" pathLength={100} />}
      <text x="450" y="455" className="mem-lbl dim" textAnchor="middle">write a bit, then read it — or wait and watch it leak (that is why DRAM must refresh)</text>
    </svg>
  );
}
