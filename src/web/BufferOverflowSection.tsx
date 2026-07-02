// Offensive-security guided story: how a stack buffer overflow hijacks a program — the foundational exploit, on the
// GuidedStory engine. Conceptual + sandboxed (a simulated stack frame; no real shellcode, no real target) — the same
// honest-mechanism approach as the padding-oracle and Spectre sections. Scenes: the stack layout, an unbounded copy,
// the overflow past the buffer, the return-address overwrite (hijack), pointing it at shellcode, then a live input you
// lengthen and watch spill over the saved frame pointer and return address. Defenses (NX/ASLR/canary) are the next
// stories in the arc. This teaches WHY memory-safe languages and bounds checks exist.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

type Kind = 'in' | 'sled' | 'sc' | 'addr' | 'pad';
type Byte = { g: string; k: Kind };
const BUF = 8, FP = 8, RET = 8, N = BUF + FP + RET; // char buf[8] | saved frame ptr | return address

const chars = (s: string): Byte[] => [...s].map((c) => ({ g: c, k: 'in' as Kind }));
// crafted exploit payload: NOP sled + "shellcode" fill the buffer, filler over the saved FP, address of buf in the return slot
const EXPLOIT: Byte[] = [
  ...Array(4).fill(0).map(() => ({ g: '90', k: 'sled' as Kind })),
  ...Array(4).fill(0).map(() => ({ g: 'SC', k: 'sc' as Kind })),
  ...Array(8).fill(0).map(() => ({ g: '90', k: 'pad' as Kind })),
  ...'e08dffffff7f0000'.match(/.{2}/g)!.map((h) => ({ g: h, k: 'addr' as Kind })), // little-endian 0x00007fffffff8de0 = &buf
];
const BUF_ADDR = '0x00007fffffff8de0';

const region = (i: number) => (i < BUF ? 'buf' : i < BUF + FP ? 'fp' : 'ret');
function jumpTarget(p: Byte[]): string | null {
  if (p.length < N) return null; // return address not fully overwritten
  const ret = p.slice(BUF + FP, N);
  if (ret.some((b) => b.k === 'addr')) return BUF_ADDR;
  const le = ret.map((b) => b.g.charCodeAt(0)).reverse().map((c) => c.toString(16).padStart(2, '0')).join('');
  return '0x' + le;
}

type Phase = 'stack' | 'copy' | 'overflow' | 'hijack' | 'shellcode' | 'run';

export function BufferOverflowSection() {
  const [text, setText] = useState('Alice');
  const payload = chars(text).slice(0, N);

  const scene = (key: Phase, title: string, caption: string, p: Byte[]): StoryScene =>
    ({ key, title, caption, render: () => <Stack phase={key} payload={p} /> });

  const scenes: StoryScene[] = [
    scene('stack', 'The stack holds more than your data', 'When a function runs, the CPU lays out a frame on the stack: room for local variables, the saved frame pointer, and — right above them — the return address, the spot to resume the caller when the function finishes. That return address is a plain value in writable memory.', chars('Alice')),
    scene('copy', 'A copy with no bounds check', 'The function copies input into a fixed 8-byte buffer with strcpy — which stops at the input’s end, not the buffer’s. A short name fits inside the buffer and everything is fine. The length of the input is never checked against the size of the buffer.', chars('Alice')),
    scene('overflow', 'Write past the end', 'Feed it more than 8 bytes and the copy keeps going — straight past the buffer, over the saved frame pointer, and into the return address. The bytes are really there in memory now; the write simply didn’t stop where the buffer did.', chars('AAAAAAAAAAAAAAAAAAAA')),
    scene('hijack', 'You control the return address', 'Overflow all the way through and the return address is now your bytes. When the function returns, the CPU loads that value into the instruction pointer and jumps there. Fill it with A’s and it jumps to 0x4141414141414141 — proof you decide where the program goes next.', chars('AAAAAAAAAAAAAAAAAAAAAAAA')),
    scene('shellcode', 'Point it at your code', 'Now craft the input: a landing pad of NOP bytes and machine code (shellcode) in the buffer, and in the return slot the address of the buffer itself. On return, the CPU jumps into the buffer and executes the attacker’s code. This is “smashing the stack.”', EXPLOIT),
    { key: 'run', title: 'Overflow it yourself', caption: 'Type into the buffer and watch it fill. Up to 8 bytes it stays inside; beyond that it spills over the saved frame pointer and then the return address (red). Once the return address is fully overwritten, the panel shows where the program would jump on return. Load the crafted exploit to aim it at the buffer.', render: () => <Stack phase="run" payload={payload} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>When a function runs, the CPU stores its local variables and — right next to them — the address to return to when the function finishes, both on the stack. If the program copies input into a fixed-size buffer without checking the length, an over-long input doesn’t just fill the buffer; it keeps writing over that saved return address. Overwrite it with an address you choose and, the moment the function returns, the CPU jumps wherever you pointed it.</>,
        takeaway: <>The bug is a missing bounds check (<code>strcpy</code>, <code>gets</code>, a hand-rolled loop); the exploit works because control data (the return address) and attacker-controlled data (the buffer) sit side by side in writable memory. Point the return address back into the buffer — now holding machine code — and the CPU runs the attacker’s shellcode. This single primitive drove decades of worms and remote code execution, and it is the reason every mitigation in the next stories exists: non-executable stacks, ASLR, and stack canaries. The real fix at the source is bounds-checked copies and memory-safe languages.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <>
          <input className="bof-in" value={text} maxLength={N} onChange={(e) => setText(e.target.value)} placeholder="type input…" />
          <button type="button" className="bof-btn" onClick={() => setText('AAAAAAAAAAAAAAAAAAAAAAAA')}>overflow</button>
          <button type="button" className="bof-btn danger" onClick={() => setText('')}>reset</button>
          <span className="bof-len">{text.length}/8 bytes {text.length > BUF && '· overflowing'}</span>
        </>
      )}
    />
  );
}

function Stack({ phase, payload }: { phase: Phase; payload: Byte[] }) {
  const target = jumpTarget(payload);
  const overRet = payload.length > BUF + FP;
  const overFp = payload.length > BUF;
  const cell = (i: number) => {
    const b = payload[i]; const reg = region(i);
    const filled = !!b;
    const cls = !filled ? 'empty' : reg === 'buf' ? (b.k === 'sc' ? 'sc' : b.k === 'sled' || b.k === 'pad' ? 'sled' : 'buf')
      : reg === 'fp' ? 'over-fp' : 'over-ret';
    return <div key={i} className={`bof-cell ${cls}`}>{b ? b.g : ''}</div>;
  };
  const row = (from: number, len: number) => <div className="bof-row">{Array.from({ length: len }, (_, j) => cell(from + j))}</div>;

  return (
    <div className="bof-wrap">
      <div className="bof-frame">
        <div className="bof-band">
          <span className="bof-tag">char buf[8]</span>
          {row(0, BUF)}
          <span className="bof-note">the input lands here</span>
        </div>
        <div className={`bof-band ${overFp ? 'hot' : ''}`}>
          <span className="bof-tag">saved frame pointer</span>
          {row(BUF, FP)}
          <span className="bof-note">{overFp ? 'corrupted' : ''}</span>
        </div>
        <div className={`bof-band ${overRet ? 'hot' : ''}`}>
          <span className="bof-tag ret">return address</span>
          {row(BUF + FP, RET)}
          <span className="bof-note ret">{overRet ? 'overwritten' : 'where the function returns'}</span>
        </div>
      </div>
      <div className={`bof-verdict ${target ? 'hijack' : overFp ? 'warn' : 'ok'}`}>
        {target
          ? (phase === 'shellcode' || payload.some((b) => b.k === 'addr')
            ? <>on return → jump to <b>{target}</b> → into the NOP sled, then your shellcode runs</>
            : <>on return → jump to <b>{target}</b> — that’s your input; you control the instruction pointer</>)
          : overRet ? <>return address partly overwritten — the program will crash or jump wild on return</>
            : overFp ? <>overflowed into the saved frame pointer — the frame is corrupt</>
              : <>input fits in the buffer — the function returns normally to its caller</>}
      </div>
    </div>
  );
}
