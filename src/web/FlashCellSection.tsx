// Guided story #4: how flash memory stores a bit — the floating-gate transistor, on the GuidedStory engine. Where
// the DRAM story parks charge on a leaky capacitor, flash traps electrons on a gate wrapped in insulator, so the bit
// survives with no power. Scenes: locate the cell, its anatomy, program (electrons tunnel on), read (threshold
// shift), erase (tunnel off — a whole block), then a live cell you program/read/erase with a wear counter.
// Real device physics (Fowler–Nordheim tunnelling, threshold shift, block erase, P/E-cycle wear); the FTL lives in
// the separate SSD section.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

type State = 'empty' | 'charged' | 'reading' | 'erasing';

export function FlashCellSection() {
  const [charged, setCharged] = useState(false);
  const [phase, setPhase] = useState<State>('empty');
  const [wear, setWear] = useState(0);

  const program = () => { setCharged(true); setPhase('charged'); setWear((w) => w + 1); };
  const erase = () => { setPhase('erasing'); setWear((w) => w + 1); setTimeout(() => { setCharged(false); setPhase('empty'); }, 700); };
  const read = () => { setPhase('reading'); setTimeout(() => setPhase(charged ? 'charged' : 'empty'), 1200); };

  const narrated = (key: string, title: string, caption: string, state: State, scene: 'locate' | 'cell'): StoryScene =>
    ({ key, title, caption, render: (a) => scene === 'locate' ? <Locate active={a} /> : <Cell state={state} labels active={a} /> });

  const scenes: StoryScene[] = [
    narrated('locate', 'Down to one cell', 'An SSD is billions of these cells, wired into pages and blocks (that level is the SSD section). Zoom past the packaging to a single one and the whole thing is one clever transistor.', 'empty', 'locate'),
    narrated('anatomy', 'The floating-gate transistor', 'It is an ordinary MOSFET with one addition: a second gate — the floating gate — sealed inside insulating oxide between the control gate and the channel. Electrons put there have nowhere to go, so they stay for years with no power. That trapped charge is the bit.', 'empty', 'cell'),
    narrated('program', 'Program — trap electrons', 'Put a high voltage on the control gate. Electrons in the channel gain enough energy to tunnel through the thin oxide (Fowler–Nordheim tunnelling) and get stuck on the floating gate. Charged = 0.', 'charged', 'cell'),
    narrated('read', 'Read — sense the threshold', 'The trapped electrons repel the channel, raising the voltage needed to switch the transistor on. Apply a modest read voltage: if the cell conducts it is empty (1); if it stays off, charge is present (0). The bit is sensed without disturbing it.', 'reading', 'cell'),
    narrated('erase', 'Erase — a whole block at once', 'Reverse the field and the electrons tunnel back off the floating gate. Erase is done through the shared substrate, so it clears a whole block at a time — which is exactly why flash cannot overwrite one page in place.', 'erasing', 'cell'),
    { key: 'run', title: 'Program, read, erase — and wear', caption: 'Drive the cell yourself. Each program/erase forces electrons through the oxide and damages it a little; after enough cycles it leaks and the cell can no longer hold a clean charge. That is why SLC (1 bit) lasts ~100k cycles but QLC (4 bits, tiny charge differences) lasts only ~1k.', render: (a) => <Cell state={phase} labels={false} wear={wear} active={a} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <>
          <button type="button" onClick={program}>program (write 0)</button>
          <button type="button" onClick={read}>read</button>
          <button type="button" onClick={erase}>erase</button>
          <span className="fg-live">bit: <b>{charged ? '0' : '1'}</b> · P/E cycles: <b>{wear}</b>{wear >= 8 ? ' · wearing out' : ''}</span>
        </>
      )}
    />
  );
}

function Locate({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 900 480" className="story-svg">
      <rect x="60" y="180" width="150" height="120" rx="8" className="fg-pkg" />
      <text x="135" y="330" className="fg-lbl" textAnchor="middle">SSD</text>
      <rect x="300" y="150" width="180" height="180" rx="6" className="fg-die" />
      <text x="390" y="360" className="fg-lbl" textAnchor="middle">NAND die → blocks → pages</text>
      {active && <line className="fg-zoom" x1="210" y1="240" x2="300" y2="240" pathLength={100} />}
      {active && <line className="fg-zoom" x1="480" y1="240" x2="600" y2="240" pathLength={100} />}
      <rect x="600" y="200" width="240" height="90" rx="6" className="fg-cellbox" />
      <text x="720" y="180" className="fg-lbl" textAnchor="middle">one cell = one transistor</text>
      <text x="720" y="250" className="fg-ico" textAnchor="middle">⚛</text>
      <text x="450" y="440" className="fg-lbl dim" textAnchor="middle">the SSD section covers pages, blocks and the FTL — here we go one level deeper</text>
    </svg>
  );
}

function Cell({ state, labels, wear = 0, active }: { state: State; labels: boolean; wear?: number; active: boolean }) {
  const charged = state === 'charged' || state === 'reading';
  const worn = wear >= 8;
  return (
    <svg viewBox="0 0 900 480" className="story-svg">
      {/* control gate */}
      <rect x="250" y="70" width="400" height="46" rx="4" className={`fg-ctrl ${state === 'reading' ? 'read' : state === 'charged' || state === 'erasing' ? 'hot' : ''}`} />
      <text x="450" y="98" className="fg-part" textAnchor="middle">control gate (word line)</text>
      <text x="670" y="98" className={`fg-volt ${state === 'charged' ? 'on' : state === 'erasing' ? 'neg' : state === 'reading' ? 'read' : ''}`}>
        {state === 'charged' ? '+20V' : state === 'erasing' ? '−20V' : state === 'reading' ? '+5V' : ''}
      </text>
      {/* inter-poly oxide */}
      <rect x="250" y="120" width="400" height="12" className="fg-oxide2" />
      {/* floating gate */}
      <rect x="250" y="136" width="400" height="52" rx="4" className={`fg-float ${charged ? 'charged' : ''} ${worn ? 'worn' : ''}`} />
      <text x="450" y="167" className="fg-part fg-float-lbl" textAnchor="middle">FLOATING GATE {charged ? '— charge trapped' : ''}</text>
      {/* trapped electrons on the floating gate */}
      {charged && active && [0, 1, 2, 3, 4].map((i) => (
        <circle key={i} cx={330 + i * 62} cy="177" r="6" className="fg-e trapped" style={{ animationDelay: `${i * 0.12}s` }} />
      ))}
      {/* tunnel oxide */}
      <rect x="250" y="192" width="400" height="14" className={`fg-tunnel ${state === 'charged' || state === 'erasing' ? 'active' : ''} ${worn ? 'worn' : ''}`} />
      {labels && <text x="712" y="203" className="fg-side">tunnel oxide</text>}
      {/* substrate with source/drain + channel */}
      <rect x="180" y="206" width="540" height="150" rx="4" className="fg-sub" />
      <rect x="180" y="206" width="120" height="70" className="fg-nplus" />
      <rect x="600" y="206" width="120" height="70" className="fg-nplus" />
      <text x="240" y="248" className="fg-part sm" textAnchor="middle">source</text>
      <text x="660" y="248" className="fg-part sm" textAnchor="middle">drain</text>
      <text x="450" y="248" className={`fg-part sm ${state === 'reading' ? (charged ? 'off' : 'on') : ''}`} textAnchor="middle">
        {state === 'reading' ? (charged ? 'channel OFF → reads 0' : 'channel ON → reads 1') : 'channel'}
      </text>
      {labels && <text x="450" y="330" className="fg-part sm" textAnchor="middle">silicon substrate (p-type)</text>}
      {/* electrons tunnelling during program (up) / erase (down) */}
      {(state === 'charged' || state === 'erasing') && active && [0, 1, 2].map((i) => (
        <line key={i} className={`fg-flow ${state === 'erasing' ? 'down' : 'up'}`} x1={360 + i * 90} y1={state === 'erasing' ? 165 : 240} x2={360 + i * 90} y2={state === 'erasing' ? 240 : 165} pathLength={100} style={{ animationDelay: `${i * 0.2}s` }} />
      ))}
      {/* electrons resting in the channel when empty */}
      {state === 'empty' && active && [0, 1, 2, 3].map((i) => <circle key={i} cx={340 + i * 75} cy="240" r="5" className="fg-e" />)}
      <text x="450" y="400" className="fg-lbl dim" textAnchor="middle">
        {state === 'charged' ? 'electrons tunnel up and stick — the bit is written, and it stays with the power off'
          : state === 'erasing' ? 'the field reverses; electrons tunnel back off through the substrate (whole block)'
          : state === 'reading' ? 'trapped charge raises the switch-on threshold — sense it without disturbing it'
          : 'no trapped charge → the cell reads 1'}
      </text>
      {worn && <text x="450" y="430" className="fg-worn" textAnchor="middle">the tunnel oxide is damaged — charge leaks, bits rot (this is endurance wear-out)</text>}
    </svg>
  );
}
