// How a process is laid out in memory — the software memory map every memory-corruption exploit targets. A program's
// memory is one long array of bytes from low to high addresses, split into regions: code + globals at the bottom, the
// HEAP growing up as you allocate, and the STACK growing down as functions call — each call laying a FRAME of locals
// plus the saved return address. Call functions and watch frames pile on; malloc and watch the heap climb toward the
// stack. This is the bridge from virtual memory (the previous rung) to the stack buffer overflow (a few rungs on).
// Conceptual — a faithful model of the classic layout, not a real ABI.
import { useState } from 'react';

const FUNCS = ['main()', 'parse()', 'copy()', 'read()'];
const X0 = 300, W = 270;               // the memory column
const TOP = 66, FRAME_H = 42;          // stack starts at TOP (high address), each frame this tall, grows DOWN
const DATA_Y = 398, CODE_Y = 426, BOT = 452, HEAP_H = 26; // data/code bands at the bottom; heap grows UP from DATA_Y

export function MemLayoutSection() {
  const [depth, setDepth] = useState(1); // stack frames in flight: main() plus nested calls
  const [heap, setHeap] = useState(1);   // heap blocks allocated

  const stackBottom = TOP + depth * FRAME_H;
  const heapTop = DATA_Y - heap * HEAP_H;
  const collided = heapTop <= stackBottom + 18;
  const mid = (stackBottom + heapTop) / 2;

  return (
    <div className="mlay">
      <p className="mlay-intro">
        A running program’s memory is just one long array of bytes, from low addresses to high. The operating system splits it
        into regions, each with a job. At the bottom sit your program’s <strong>code</strong> (the machine instructions) and its
        <strong> globals</strong>. Above them, two regions grow <em>toward each other</em>: the <strong>heap</strong>, where memory
        you request at runtime (<code>malloc</code>, <code>new</code>) piles up, growing <strong>upward</strong>; and the
        <strong> stack</strong>, where every function call lays down a <strong>frame</strong> — its local variables plus the
        <strong> return address</strong> that says where to resume the caller — growing <strong>downward</strong>. Call functions
        and allocate memory below, and watch the map fill in. (This is the virtual layout from the last rung; the stack is where
        the very first exploit strikes.)
      </p>

      <div className="mlay-ctl">
        <button type="button" onClick={() => setDepth((d) => Math.min(FUNCS.length, d + 1))} disabled={depth >= FUNCS.length}>▸ call {FUNCS[Math.min(depth, FUNCS.length - 1)]} — push a frame</button>
        <button type="button" onClick={() => setDepth((d) => Math.max(1, d - 1))} disabled={depth <= 1}>◂ return — pop a frame</button>
        <span className="mlay-sep" />
        <button type="button" onClick={() => setHeap((h) => Math.min(7, h + 1))} disabled={heap >= 7}>▴ malloc(32) — grow heap</button>
        <button type="button" onClick={() => setHeap((h) => Math.max(0, h - 1))} disabled={heap <= 0}>▾ free</button>
      </div>

      <svg viewBox="0 0 900 480" className="mlay-svg">
        <text x={X0 - 14} y={TOP + 4} className="mlay-addr" textAnchor="end">high address</text>
        <text x={X0 - 14} y={TOP + 16} className="mlay-addr dim" textAnchor="end">0x7fff…</text>
        <text x={X0 - 14} y={BOT} className="mlay-addr" textAnchor="end">0x0000</text>
        <text x={X0 - 14} y={BOT - 12} className="mlay-addr dim" textAnchor="end">low address</text>

        {/* stack frames — grow DOWN from the top; main() is the outermost (highest) */}
        {Array.from({ length: depth }, (_, i) => {
          const y = TOP + i * FRAME_H, top = i === depth - 1;
          return (
            <g key={i}>
              <rect x={X0} y={y} width={W} height={FRAME_H - 3} rx="3" className={`mlay-frame ${top ? 'top' : ''}`} />
              <text x={X0 + 12} y={y + 18} className="mlay-fn">{FUNCS[i]}</text>
              <text x={X0 + 12} y={y + 31} className="mlay-fsub">locals{top ? ' (incl. a buffer)' : ''}</text>
              <rect x={X0} y={y + FRAME_H - 11} width={W} height="6" className="mlay-ret" />
              <text x={X0 + W - 8} y={y + FRAME_H - 6} className="mlay-retlbl" textAnchor="end">↳ saved return address</text>
            </g>
          );
        })}
        <text x={X0 + W + 14} y={TOP + 14} className="mlay-side stack">stack ↓</text>
        <text x={X0 + W + 14} y={TOP + 28} className="mlay-side dim">a frame per call</text>

        {/* free gap */}
        {collided
          ? <text x={X0 + W / 2} y={mid + 4} className="mlay-collide" textAnchor="middle">💥 stack met heap — out of memory</text>
          : <text x={X0 + W / 2} y={mid + 4} className="mlay-gap" textAnchor="middle">↑ free space ↓</text>}

        {/* heap blocks — grow UP from the data band */}
        {Array.from({ length: heap }, (_, i) => (
          <rect key={i} x={X0} y={DATA_Y - (i + 1) * HEAP_H} width={W} height={HEAP_H - 3} rx="3" className="mlay-heap" />
        ))}
        {heap > 0 && <text x={X0 + W + 14} y={heapTop + 16} className="mlay-side heap">heap ↑</text>}

        {/* code + globals at the bottom */}
        <rect x={X0} y={DATA_Y} width={W} height={CODE_Y - DATA_Y} rx="3" className="mlay-data" />
        <text x={X0 + 12} y={DATA_Y + 19} className="mlay-region">globals (data / bss)</text>
        <rect x={X0} y={CODE_Y} width={W} height={BOT - CODE_Y} rx="3" className="mlay-code" />
        <text x={X0 + 12} y={CODE_Y + 19} className="mlay-region">code (your instructions)</text>
      </svg>

      <p className="mlay-foot">
        Two things to carry forward. First, a stack frame stores the function’s locals right next to the saved
        <strong> return address</strong> — a plain, writable value in memory. Overflow a local buffer and you write straight over
        that return address; when the function returns, the CPU loads it into the instruction pointer and <em>jumps wherever you
        put it</em>. That is the <strong>buffer overflow</strong>, a few rungs on, and this map is why it works. Second, the heap
        and stack grow toward each other across the free gap; exhaust it and they collide (a stack overflow, or out of memory).
        Knowing this map — what lives where, and what is writable — is the groundwork under every memory-corruption attack, and
        it is exactly what <strong>ASLR</strong> later scrambles to make the attacker’s job harder.
      </p>
    </div>
  );
}
