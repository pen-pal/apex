// How ROP bypasses NX — REBUILT as a producible puzzle. NX made the stack non-executable, so injected shellcode
// won't run; but you still own the stack and `ret` follows whatever address is on it. So you reuse code that is
// already executable — "gadgets" ending in ret — chaining their addresses up the stack. Here the learner assembles
// the chain from a gadget palette, sets each popped value, and runs it on a tiny register machine (rop.ts) to build
// execve("/bin/sh") and pop a shell. Real x86-64 syscall ABI (execve = 59); illustrative gadget addresses.
import { useMemo, useState } from 'react';
import { GADGETS, WORDS, runChain, BINSH, type Gadget, type Word, type ChainEntry } from './rop';

const REG_GOAL: Record<string, number | string> = { rax: 59, rdi: BINSH, rsi: 0, rdx: 0 };

export function RopSection() {
  const [chain, setChain] = useState<ChainEntry[]>([]);
  const [revealed, setRevealed] = useState(0); // gadgets executed so far (0 = not run yet)
  const result = useMemo(() => runChain(chain), [chain]);
  const trace = result.trace;

  const reset = () => setRevealed(0);
  const addGadget = (g: Gadget) => { setChain((c) => [...c, { gadget: g, word: g.pops ? WORDS[0] : undefined }]); reset(); };
  const setWord = (i: number, w: Word) => { setChain((c) => c.map((e, j) => (j === i ? { ...e, word: w } : e))); reset(); };
  const removeAt = (i: number) => { setChain((c) => c.filter((_, j) => j !== i)); reset(); };
  const clear = () => { setChain([]); reset(); };

  const done = revealed >= trace.length && trace.length > 0;
  const curEntry = revealed > 0 ? revealed - 1 : -1; // chain entry currently executing (1:1 with trace)
  const regs = revealed > 0 ? trace[Math.min(revealed, trace.length) - 1].regs : null;

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Return-oriented programming — build the chain, pop the shell</h2></div>
        <p className="jsec-sub">
          In the buffer overflow you overwrote the return address and jumped to <em>your own bytes</em> on the stack. Defenders
          answered with <strong>NX</strong> — a non-executable stack: the CPU refuses to run instructions from a writable page,
          so injected shellcode is dead on arrival. But you still own the stack, and <code>ret</code> still blindly jumps to
          whatever address sits on it. So instead of injecting code, you <strong>reuse code that is already executable</strong> —
          short snippets in the program and its libraries that happen to end in <code>ret</code>, called <strong>gadgets</strong>.
          Lay a list of gadget addresses up the stack and each gadget’s <code>ret</code> runs the next: the stack becomes your
          program. Build one below that calls a shell — every instruction it runs was already there, so NX never fires.
        </p>

        <p className="rop-goal">
          🎯 <strong>Goal:</strong> <code>execve("/bin/sh", NULL, NULL)</code> — a shell. On x86-64 Linux that is
          <strong> syscall with rax = 59</strong>, <strong>rdi = &amp;"/bin/sh"</strong>, <strong>rsi = 0</strong>,
          <strong> rdx = 0</strong>. Add gadgets to load those registers, finish with <code>syscall ; ret</code>, then run it.
        </p>

        <div className="rop-build">
          <div className="rop-palette">
            <h3>gadgets <span>already executable · .text / libc</span></h3>
            {GADGETS.map((g) => (
              <button key={g.id} type="button" className={`rop-pal-btn ${g.decoy ? 'decoy' : ''} ${g.syscall ? 'sys' : ''}`} onClick={() => addGadget(g)}>
                <code className="rop-pal-asm">{g.asm}</code>
                <code className="rop-pal-addr">{g.addr}</code>
              </button>
            ))}
            <p className="rop-pal-note">click a gadget to append it to the chain →</p>
          </div>

          <div className="rop-chainbox">
            <h3>your chain <span>the stack — <code>ret</code> walks down it</span></h3>
            {chain.length === 0 ? (
              <p className="rop-empty">empty — add gadgets from the palette</p>
            ) : (
              <div className="rop-chain">
                {chain.map((e, i) => (
                  <div key={i} className={`rop-entry ${i === curEntry ? 'active' : ''} ${revealed > 0 && i < curEntry ? 'done' : ''} ${e.gadget.syscall ? 'syscall' : ''}`}>
                    {i === curEntry && <span className="rop-rsp">RSP▸</span>}
                    <code className="rop-e-addr">{e.gadget.addr}</code>
                    <code className="rop-e-asm">{e.gadget.asm}</code>
                    {e.gadget.pops ? (
                      <select className="rop-e-word" value={e.word?.label} onChange={(ev) => setWord(i, WORDS.find((w) => w.label === ev.target.value)!)}>
                        {WORDS.map((w) => <option key={w.label} value={w.label}>{w.label}</option>)}
                      </select>
                    ) : <span className="rop-e-word ghost">—</span>}
                    <button type="button" className="rop-e-x" onClick={() => removeAt(i)} aria-label="remove">✕</button>
                  </div>
                ))}
              </div>
            )}
            <div className="rop-run">
              <button type="button" className="rop-btn" onClick={() => setRevealed((r) => Math.min(trace.length, r + 1))} disabled={!chain.length || done}>step ▸</button>
              <button type="button" className="rop-btn" onClick={() => setRevealed(trace.length)} disabled={!chain.length || done}>▶ run</button>
              <button type="button" className="rop-btn ghost" onClick={reset} disabled={!revealed}>↺ reset</button>
              <button type="button" className="rop-btn ghost" onClick={clear} disabled={!chain.length}>clear</button>
            </div>
          </div>

          <div className="rop-state">
            <h3>registers</h3>
            <div className="rop-regbox">
              {(['rax', 'rdi', 'rsi', 'rdx'] as const).map((r) => {
                const v = regs ? regs[r] : '—';
                const ok = regs != null && v === REG_GOAL[r];
                const show = v === BINSH ? '&"/bin/sh"' : String(v);
                return (
                  <div key={r} className={`rop-regrow ${ok ? 'ok' : ''}`}>
                    <code className="rop-regn">{r}</code>
                    <code className="rop-regv">{show}</code>
                    {ok && <span className="rop-tick">✓</span>}
                  </div>
                );
              })}
            </div>
            {!done && revealed > 0 && <p className="rop-tracenote">{trace[revealed - 1]?.note}</p>}
            {done && (
              <div className={`rop-verdict ${result.shell ? 'win' : 'fail'}`}>
                <div className="rop-verdict-h">{result.shell ? '🐚 shell spawned — NX bypassed' : '✗ no shell'}</div>
                <p>{result.reason}</p>
              </div>
            )}
          </div>
        </div>

        <p className="rop-foot">
          Gadgets ending in <code>ret</code> are so plentiful that a large binary plus libc is effectively Turing-complete — you
          can compute anything without injecting a byte, which is why NX alone was never enough. The next defense hides the
          addresses: <strong>ASLR</strong> randomizes where the code and gadgets live, so the fixed <code>0x4011…</code> addresses
          here would be wrong on every run — the attacker first needs an <em>info leak</em> to discover the real base. And
          <strong> control-flow integrity</strong> checks that every <code>ret</code> lands somewhere it is actually allowed to.
        </p>
      </section>
    </div>
  );
}
