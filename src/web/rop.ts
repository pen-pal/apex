// Return-oriented programming, as a producible puzzle. NX makes the stack non-executable, so injected shellcode
// won't run — but you still control the stack, and `ret` blindly jumps to whatever address it pops. So you REUSE
// code that is already executable: short instruction sequences ending in `ret` ("gadgets") scattered through the
// binary and libc. Chain their addresses up the stack and each gadget's `ret` runs the next.
//
// This models the chain on a tiny register machine. Each `pop rX ; ret` gadget loads the next stack word into a
// register; `syscall ; ret` invokes the Linux x86-64 syscall whose number is in rax, with arguments in rdi, rsi,
// rdx. The goal is execve("/bin/sh", NULL, NULL) — the canonical "pop a shell": syscall 59, rdi = &"/bin/sh",
// rsi = 0, rdx = 0. The syscall ABI here is the real Linux x86-64 convention; the gadget addresses are illustrative.

export type Reg = 'rdi' | 'rsi' | 'rdx' | 'rax' | 'rbx';
export type Gadget = { id: string; asm: string; addr: string; pops: Reg | null; syscall?: boolean; decoy?: boolean };

// execve on x86-64 Linux: syscall number 59, args in rdi (pathname), rsi (argv), rdx (envp).
export const EXECVE = 59;
export const BINSH = '0x7ffff7f8e2d0'; // illustrative address of a "/bin/sh" string already in libc

export const GADGETS: Gadget[] = [
  { id: 'rdi', asm: 'pop rdi ; ret', addr: '0x401173', pops: 'rdi' },
  { id: 'rsi', asm: 'pop rsi ; ret', addr: '0x4011a8', pops: 'rsi' },
  { id: 'rdx', asm: 'pop rdx ; ret', addr: '0x4011c5', pops: 'rdx' },
  { id: 'rax', asm: 'pop rax ; ret', addr: '0x401192', pops: 'rax' },
  { id: 'syscall', asm: 'syscall ; ret', addr: '0x40118f', pops: null, syscall: true },
  { id: 'rbx', asm: 'pop rbx ; ret', addr: '0x401201', pops: 'rbx', decoy: true }, // rbx is not a syscall argument
];

export type Word = { label: string; val: number | string };
export const WORDS: Word[] = [
  { label: '0  (NULL)', val: 0 },
  { label: '&"/bin/sh"', val: BINSH },
  { label: '59  (execve)', val: EXECVE },
  { label: '60  (exit)', val: 60 },
];

export type ChainEntry = { gadget: Gadget; word?: Word };
export type Regs = Record<Reg, number | string>;
const EMPTY: Regs = { rdi: '—', rsi: '—', rdx: '—', rax: '—', rbx: '—' };

export type StepTrace = { entryIdx: number; note: string; regs: Regs };
export type RunResult = { regs: Regs; shell: boolean; reason: string; trace: StepTrace[]; syscallReached: boolean };

// Execute the chain: walk it in order, each gadget applying its effect, until a syscall resolves it.
export function runChain(chain: ChainEntry[]): RunResult {
  const regs: Regs = { ...EMPTY };
  const trace: StepTrace[] = [];
  for (let i = 0; i < chain.length; i++) {
    const { gadget, word } = chain[i];
    if (gadget.pops) {
      regs[gadget.pops] = word ? word.val : 0;
      trace.push({ entryIdx: i, note: `${gadget.asm}  →  ${gadget.pops} = ${word ? word.label.trim() : '0'}`, regs: { ...regs } });
    } else if (gadget.syscall) {
      const ok = regs.rax === EXECVE && regs.rdi === BINSH && regs.rsi === 0 && regs.rdx === 0;
      trace.push({ entryIdx: i, note: `syscall  →  execve(rdi, rsi, rdx) with rax=${regs.rax === '—' ? 'unset' : regs.rax}`, regs: { ...regs } });
      return {
        regs, trace, syscallReached: true, shell: ok,
        reason: ok
          ? 'execve("/bin/sh", NULL, NULL) runs — a shell spawns. Every instruction executed was already in an executable page, so NX never fired and not one injected byte ran.'
          : whyNoShell(regs),
      };
    }
  }
  return { regs, trace, syscallReached: false, shell: false, reason: 'The chain never reaches a syscall — nothing gets invoked. Add a “syscall ; ret” gadget at the end.' };
}

function whyNoShell(r: Regs): string {
  if (r.rax !== EXECVE) {
    if (r.rax === 60) return 'syscall ran with rax=60 — that is exit(), so the process just dies. You need rax=59 (execve).';
    return `syscall ran, but rax=${r.rax === '—' ? 'unset' : r.rax}, not 59 — that is not execve, so no shell.`;
  }
  if (r.rdi !== BINSH) return 'rax=59 (execve), but rdi is not the "/bin/sh" pointer — execve has no program path to run.';
  if (r.rsi !== 0) return 'rax=59 and rdi is set, but execve needs rsi = 0 (NULL argv). It is not.';
  if (r.rdx !== 0) return 'almost — rax, rdi, rsi are right, but execve needs rdx = 0 (NULL envp).';
  return 'registers are not fully set up for execve.';
}
