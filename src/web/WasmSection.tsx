// Guided story: how WebAssembly runs untrusted code fast AND safely. The module's entire world is one bounded array
// (linear memory); every load/store is an index into it, bounds-checked, so it has no pointers into host memory. The
// bytecode is validated (type-checked) before it runs, and the module has zero ambient authority — it can only call
// functions you import. Real WASM opcodes + a real bounds-checked linear-memory interpreter (out-of-bounds → trap).
// Sandboxed/CONCEPTUAL. Complements the generic bytecode-VM story with the sandbox + validation angle.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const MEM = 32; // linear memory size (bytes)
// linear memory pre-filled with a recognizable pattern (the module's own heap)
const memByte = (i: number) => (i < MEM ? (i * 7 + 3) & 0xff : -1);
// a real WASM function body: store 42 at addr, then load it back — shown as actual opcodes
const CODE = [
  { hex: '20 00', asm: 'local.get 0', note: 'push the address parameter' },
  { hex: '41 2a', asm: 'i32.const 42', note: 'push the value 42' },
  { hex: '36 02 00', asm: 'i32.store', note: 'mem[addr] = 42  (bounds-checked)' },
  { hex: '20 00', asm: 'local.get 0', note: 'push the address again' },
  { hex: '28 02 00', asm: 'i32.load', note: 'push mem[addr]  (bounds-checked)' },
  { hex: '0b', asm: 'end', note: 'return the loaded value' },
];

type Phase = 'why' | 'linear' | 'bounds' | 'validate' | 'caps' | 'run';

export function WasmSection() {
  const [addr, setAddr] = useState(10);
  const inBounds = addr >= 0 && addr < MEM;

  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string, a: number): StoryScene =>
    ({ key, title, caption, render: () => <Wasm phase={key} addr={a} /> });

  const scenes: StoryScene[] = [
    scene('why', 'Run untrusted code, fast and safe', 'A browser downloads a WebAssembly module from a stranger and runs it at near-native speed — a game engine, a video codec, a Figma. It never has to trust that code. How do you run someone else’s compiled program full-speed without letting it read your memory, your files, or your keystrokes?', 10),
    scene('linear', 'Its whole world is one array', 'A WASM module has no pointers into your process. Its entire heap is a single, bounded block of bytes called linear memory. Every variable, object, and buffer it uses lives at some index into that one array. Address 0 is the start of ITS memory — not yours.', 10),
    scene('bounds', 'Every access is bounds-checked', 'So each load and store is just “read/write index N of the array,” and the runtime checks N against the array’s length on every access. Point past the end and it doesn’t read your memory — it traps. The sandbox is simply the boundary of the array; the module physically cannot name anything outside it.', 40),
    scene('validate', 'Validated before it runs', 'Before executing a single instruction, the runtime type-checks the whole module in one linear pass: every value pushed and popped on the stack must have the right type, every jump must land in range. A malformed or malicious module is rejected up front — so at runtime there are no undefined-behavior surprises to exploit.', 10),
    scene('caps', 'Capabilities, not ambient power', 'And the module has no ambient authority at all — no syscalls, no filesystem, no network. It can only call the specific functions you explicitly import into it. A browser hands it a way to draw pixels but not to read your disk. You choose exactly what it can touch.', 10),
    { key: 'run', title: 'Try to escape the sandbox', caption: 'Slide the address and run i32.load. In bounds, it reads the module’s own linear memory and returns the byte. Past the end of the array (grey = your process, outside the sandbox), the bounds check fires and the module traps instead of reading host memory. There is no address it can form that reaches you.', render: () => <Wasm phase="run" addr={addr} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>WebAssembly runs code compiled from C, C++, or Rust at near-native speed — including code you downloaded and don’t trust. It stays safe by construction: the module’s entire world is a single bounded array called <strong>linear memory</strong>, every access into it is bounds-checked, and it can only call functions you explicitly hand it. It has no pointers into your memory and no ambient access to files or the network. The sandbox is the array boundary.</>,
        takeaway: <>Three things make it safe. <strong>Linear memory</strong>: the module’s heap is one array, and every load/store is an index into it, bounds-checked, so address 0 is the start of its own memory, not yours — it cannot even name host memory. <strong>Validation</strong>: before running, the runtime type-checks the whole module in a single pass (the operand-stack types must line up, jumps must be in range), rejecting anything malformed up front, so there is no undefined behavior to exploit at runtime. <strong>Capabilities</strong>: the module has zero ambient authority — no syscalls — and can only call the specific functions you import, so a browser gives it a canvas but not your filesystem. That is how the same untrusted bytecode runs safely in a browser, a CDN edge, or a plugin host — and because it is a simple typed stack machine, the runtime JIT-compiles it to real machine code, so safe does not mean slow.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <>
          <label className="wsm-ctl">address<input type="range" min={0} max={47} value={addr} onChange={(e) => setAddr(+e.target.value)} /><b>{addr}</b></label>
          <span className={`wsm-live ${inBounds ? 'ok' : 'bad'}`}>{inBounds ? `i32.load → mem[${addr}] = ${memByte(addr)}` : `i32.load ${addr} → ✗ out of bounds → trap`}</span>
        </>
      )}
    />
  );
}

function Wasm({ phase, addr }: { phase: Phase; addr: number }) {
  const on = (p: Phase) => phase === p;
  const inBounds = addr >= 0 && addr < MEM;
  const showAccess = on('bounds') || on('run');
  const cols = 8, cw = 46, x0 = 60, y0 = 196;
  const cellX = (i: number) => x0 + (i % cols) * cw;
  const cellY = (i: number) => y0 + Math.floor(i / cols) * 40;
  return (
    <svg viewBox="0 0 900 480" className="story-svg">
      {/* bytecode */}
      <text x="60" y="48" className="wsm-col">the module — real WASM bytecode</text>
      {CODE.map((c, i) => (
        <g key={i}>
          <text x="60" y={72 + i * 15} className="wsm-hex">{c.hex.padEnd(9)}</text>
          <text x="150" y={72 + i * 15} className="wsm-asm">{c.asm}</text>
        </g>
      ))}

      {/* sandbox boundary */}
      <rect x="44" y="166" width="386" height="196" rx="10" className="wsm-sandbox" />
      <text x="60" y="186" className="wsm-col">linear memory (the sandbox) — {MEM} bytes</text>
      {Array.from({ length: MEM }, (_, i) => {
        const cur = showAccess && inBounds && i === addr;
        return (
          <g key={i}>
            <rect x={cellX(i)} y={cellY(i)} width={cw - 4} height={34} rx="4" className={`wsm-cell ${cur ? 'cur' : ''}`} />
            <text x={cellX(i) + (cw - 4) / 2} y={cellY(i) + 22} className="wsm-cv" textAnchor="middle">{memByte(i)}</text>
          </g>
        );
      })}

      {/* host memory — outside, unreachable */}
      <rect x="470" y="166" width="380" height="196" rx="10" className="wsm-host" />
      <text x="660" y="186" className="wsm-hostlbl" textAnchor="middle">your process (host memory)</text>
      <text x="660" y="266" className="wsm-hostx" textAnchor="middle">🔒 unreachable — the module</text>
      <text x="660" y="288" className="wsm-hostx" textAnchor="middle">cannot form an address here</text>

      {/* the access */}
      {showAccess && (inBounds
        ? <text x="235" y="390" className="wsm-verdict ok" textAnchor="middle">index {addr} is inside the array → read mem[{addr}] = {memByte(addr)} ✓</text>
        : <>
          <line x1="430" y1="264" x2="466" y2="264" className="wsm-trap-line" markerEnd="url(#wsm-x)" />
          <text x="450" y="390" className="wsm-verdict bad" textAnchor="middle">index {addr} ≥ {MEM} → bounds check fails → TRAP (host memory never touched)</text>
        </>)}

      {on('validate') && <text x="450" y="390" className="wsm-note" textAnchor="middle">type-check pass: operand-stack types line up → accept; a bad type → reject before running</text>}
      {on('caps') && <text x="450" y="390" className="wsm-note" textAnchor="middle">imports = the only doors out: draw_pixel ✓  ·  read_file ✗ (never granted)</text>}

      <text x="450" y="452" className="wsm-foot" textAnchor="middle">
        {on('why') ? 'near-native speed with no trust required — because it can’t reach outside its box'
          : on('linear') ? 'one bounded array is the module’s entire memory — no host pointers exist'
          : on('bounds') ? 'a length check on every access — the boundary of the array IS the sandbox'
          : on('validate') ? 'type-checked up front, so runtime has no undefined behavior to exploit'
          : on('caps') ? 'zero ambient authority — it reaches only what you import into it'
          : inBounds ? 'in bounds: reads its own linear memory' : 'out of bounds: trapped at the array boundary'}
      </text>
      <defs><marker id="wsm-x" markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto"><path d="M1,1 L9,9 M9,1 L1,9" className="wsm-xhead" /></marker></defs>
    </svg>
  );
}
