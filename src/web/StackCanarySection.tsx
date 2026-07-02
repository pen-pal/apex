// Offensive-security arc #5: how a stack canary catches the overflow — on the GuidedStory engine. A buffer overflow
// reaches the saved return address by writing contiguously through everything between; the compiler plants a random
// "canary" between the locals and the return address, so a linear overflow must smash it, and the epilogue checks it
// before ret. Mismatch → __stack_chk_fail → abort before the corrupted return address is used. Defeated by leaking the
// canary (write it back) or a non-contiguous write. Conceptual + sandboxed (real %fs:0x28 / null-byte-canary details).
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

// a real Linux stack canary: 8 random bytes with a NULL low byte (so a string copy can't leak/forge it whole)
const CANARY = ['00', '2f', 'a7', '1c', '93', 'e4', '5b', '88'];
const RET = ['e0', '8d', 'ff', 'ff', 'ff', '7f', '00', '00']; // little-endian &buf, like the overflow story
const A8 = () => Array(8).fill('41'); // attacker's 0x41 ('A') filler

type Band = { name: string; tag?: string };
const BANDS: Band[] = [
  { name: 'char buf[8]', tag: 'overflow starts here' },
  { name: 'stack canary', tag: 'the guard' },
  { name: 'saved frame pointer' },
  { name: 'return address' },
];

type Phase = 'contig' | 'plant' | 'trip' | 'check' | 'beat' | 'run';

export function StackCanarySection() {
  const [leaked, setLeaked] = useState(false);
  const [fired, setFired] = useState(false);

  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string, filled: boolean, lk: boolean): StoryScene =>
    ({ key, title, caption, render: () => <Canary filled={filled} leaked={lk} phase={key} /> });

  const scenes: StoryScene[] = [
    scene('contig', 'The overflow has to cross everything', 'A stack overflow reaches the saved return address the only way it can: by writing byte after byte, contiguously, from the buffer upward. To corrupt the return address it must pass over everything sitting between it and the buffer.', false, false),
    scene('plant', 'Plant a secret in the way', 'So the compiler drops a random secret — a “canary” — onto the stack between your local buffers and the saved return address. It is read from thread-local storage at function entry (on Linux x86-64, from %fs:0x28) and written here; an untouched copy stays safe in the register/TLS.', false, false),
    scene('trip', 'A linear overflow smashes it', 'Now run the overflow. To reach the return address it writes straight through the canary, overwriting the secret with attacker bytes (0x41…). The value sitting on the stack no longer matches the safe reference — but the program has not returned yet.', true, false),
    scene('check', 'Checked just before return', 'In the function epilogue, right before ret, the code compares the stack canary against the reference. They differ, so it calls __stack_chk_fail() and the process aborts with SIGABRT — before it ever loads your hijacked return address. The overflow is caught.', true, false),
    scene('beat', 'How it is beaten', 'The canary is random per process and carries a null byte, so a string copy can’t leak or forge it whole. But leak it another way (the same infoleak trick that beats ASLR) and write the correct value back inside your overflow: the check passes, and the return address is yours again. Canaries stop the naive overflow, not a leak.', true, true),
    { key: 'run', title: 'Overflow it — blind, then informed', caption: 'Overflow blind and the canary is smashed → __stack_chk_fail aborts the program. Then leak the canary and overflow again writing the correct value across it: the check passes and control flow is hijacked. A canary is a check, not a wall.', render: () => <Canary filled={fired} leaked={leaked} phase="run" /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>A buffer overflow reaches the saved return address by writing straight through everything between it and the buffer. A stack canary turns that against the attacker: the compiler drops a random secret value on the stack, between the local buffers and the saved return address. A linear overflow can’t reach the return address without also overwriting the canary — and just before the function returns, the code checks whether the canary still matches. If it changed, the program aborts instead of returning.</>,
        takeaway: <>The canary is read from thread-local storage (on Linux x86-64, <code>%fs:0x28</code>), random per process, and usually carries a null low byte so a string copy can’t leak or forge it whole. It’s written in the prologue and verified in the epilogue; a mismatch calls <code>__stack_chk_fail</code> and the process dies with SIGABRT before the corrupted return address is ever used. That stops the naive contiguous overflow cold — but it is a check, not a wall: leak the canary value (the same infoleak that beats ASLR) and include it in your overflow, or use a write primitive that skips over it, and the return address is yours again. NX, ASLR, and canaries each close one door; real exploitation chains bypasses for all three, which is why the last defenses are structural — CFI and shadow stacks, the next story.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <>
          <label className="can-toggle"><input type="checkbox" checked={leaked} onChange={(e) => { setLeaked(e.target.checked); setFired(false); }} /> canary leaked</label>
          <button type="button" className="can-btn" onClick={() => setFired(true)}>overflow ▸</button>
          <button type="button" className="can-btn ghost" onClick={() => setFired(false)}>reset</button>
          <span className={`can-live ${fired ? (leaked ? 'bad' : 'ok') : ''}`}>{!fired ? 'ready' : leaked ? '✗ canary intact → return hijacked' : '● __stack_chk_fail → abort'}</span>
        </>
      )}
    />
  );
}

function Canary({ filled, leaked, phase }: { filled: boolean; leaked: boolean; phase: Phase }) {
  // written bytes per band: buffer/fp = attacker fill; canary = attacker (blind) or the real value (leaked); ret = &buf
  const written: (string[] | null)[] = filled
    ? [A8(), leaked ? [...CANARY] : A8(), A8(), [...RET]]
    : [null, [...CANARY], null, null]; // unfilled: only the planted canary is shown
  const intact = filled && leaked;
  const showCheck = phase === 'check' || phase === 'beat' || phase === 'run';

  return (
    <svg viewBox="0 0 900 480" className="story-svg">
      <text x="60" y="46" className="can-col">one stack frame (high address at top)</text>
      {BANDS.map((band, bi) => {
        const y = 62 + bi * 62;
        const bytes = written[bi];
        const isCanary = band.name === 'stack canary';
        const smashed = isCanary && filled && !leaked;
        const ok = isCanary && filled && leaked;
        return (
          <g key={band.name}>
            <rect x="60" y={y} width="470" height="52" rx="7" className={`can-band ${isCanary ? 'canary' : ''} ${smashed ? 'smashed' : ''} ${ok ? 'ok' : ''}`} />
            <text x="76" y={y + 22} className={`can-name ${isCanary ? 'guard' : ''}`}>{band.name}</text>
            {band.tag && <text x="76" y={y + 41} className="can-tag">{band.tag}</text>}
            <g>
              {Array.from({ length: 8 }, (_, j) => (
                <g key={j}>
                  <rect x={300 + j * 27} y={y + 12} width="24" height="28" rx="3" className={`can-cell ${bytes ? (isCanary ? (leaked ? 'canary-ok' : 'canary-bad') : 'fill') : 'empty'}`} />
                  <text x={312 + j * 27} y={y + 31} className="can-byte" textAnchor="middle">{bytes ? bytes[j] : (isCanary ? CANARY[j] : '')}</text>
                </g>
              ))}
            </g>
          </g>
        );
      })}

      {/* the epilogue check */}
      {showCheck && (
        <g>
          <text x="610" y="90" className="can-col">epilogue check (before ret)</text>
          <text x="610" y="120" className="can-chk">stack canary  <tspan className={intact ? 'can-mono ok' : 'can-mono bad'}>{(filled ? (leaked ? CANARY : A8()) : CANARY).join(' ')}</tspan></text>
          <text x="610" y="146" className="can-chk">%fs:0x28 ref  <tspan className="can-mono ref">{CANARY.join(' ')}</tspan></text>
          <text x="610" y="184" className={`can-verdict ${intact ? 'bad' : 'ok'}`}>{intact ? '= match ✓  → proceeds to ret' : '≠ mismatch ✗  → __stack_chk_fail()'}</text>
          <text x="610" y="230" className={`can-out ${intact ? 'bad' : 'ok'}`}>
            {intact ? 'returns to your hijacked address → shell' : 'process aborts (SIGABRT) before ret'}
          </text>
        </g>
      )}

      <text x="450" y="452" className="can-foot" textAnchor="middle">
        {phase === 'contig' ? 'a contiguous overflow must pass over the canary to reach the return address'
          : phase === 'plant' ? 'the canary is random per run and carries a null byte (00) to resist string leaks'
          : phase === 'trip' ? 'the canary now holds attacker bytes — but the function has not returned yet'
          : phase === 'check' ? 'mismatch → the program dies before the corrupted return address is used'
          : phase === 'beat' ? 'leak the canary, write it back, and the check passes — the overflow wins'
          : leaked && filled ? 'correct canary written across → check passes → hijacked'
            : filled ? 'canary smashed → check fails → aborted' : 'ready to overflow'}
      </text>
    </svg>
  );
}
