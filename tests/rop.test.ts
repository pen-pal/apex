import { describe, it, expect } from 'vitest';
import { runChain, GADGETS, WORDS, BINSH, EXECVE, type ChainEntry } from '../src/web/rop';

// Independent oracle: the Linux x86-64 syscall ABI. execve is syscall number 59, with arguments in
// rdi (pathname), rsi (argv), rdx (envp). These are external facts (the Linux syscall table + System V
// syscall calling convention), asserted against the model — never derived from the model's own output.

const g = (id: string) => GADGETS.find((x) => x.id === id)!;
const w = (needle: string) => WORDS.find((x) => x.label.includes(needle))!;

describe('ROP gadget-chain execution vs the real execve ABI', () => {
  it('execve is syscall 59 (external fact)', () => {
    expect(EXECVE).toBe(59);
  });

  it('the canonical execve("/bin/sh", NULL, NULL) chain spawns a shell', () => {
    const chain: ChainEntry[] = [
      { gadget: g('rdi'), word: w('/bin/sh') },
      { gadget: g('rsi'), word: w('NULL') },
      { gadget: g('rdx'), word: w('NULL') },
      { gadget: g('rax'), word: w('execve') },
      { gadget: g('syscall') },
    ];
    const r = runChain(chain);
    expect(r.shell).toBe(true);
    expect(r.syscallReached).toBe(true);
    // final register state must match the ABI (values asserted independently)
    expect(r.regs.rax).toBe(59);
    expect(r.regs.rdi).toBe(BINSH);
    expect(r.regs.rsi).toBe(0);
    expect(r.regs.rdx).toBe(0);
  });

  it('register state persists across gadgets regardless of order', () => {
    const chain: ChainEntry[] = [
      { gadget: g('rax'), word: w('execve') },
      { gadget: g('rdi'), word: w('/bin/sh') },
      { gadget: g('rsi'), word: w('NULL') },
      { gadget: g('rdx'), word: w('NULL') },
      { gadget: g('syscall') },
    ];
    expect(runChain(chain).shell).toBe(true);
  });

  it('rax=60 is exit(), not execve — no shell', () => {
    const chain: ChainEntry[] = [
      { gadget: g('rdi'), word: w('/bin/sh') },
      { gadget: g('rsi'), word: w('NULL') },
      { gadget: g('rdx'), word: w('NULL') },
      { gadget: g('rax'), word: w('exit') },
      { gadget: g('syscall') },
    ];
    const r = runChain(chain);
    expect(r.shell).toBe(false);
    expect(r.reason).toMatch(/exit/i);
  });

  it('execve without rsi=0 (NULL argv) does not spawn a shell', () => {
    const chain: ChainEntry[] = [
      { gadget: g('rdi'), word: w('/bin/sh') },
      { gadget: g('rax'), word: w('execve') },
      { gadget: g('syscall') },
    ];
    const r = runChain(chain);
    expect(r.shell).toBe(false);
    expect(r.reason).toMatch(/rsi/);
  });

  it('a chain with no syscall never invokes anything', () => {
    const r = runChain([{ gadget: g('rdi'), word: w('/bin/sh') }]);
    expect(r.shell).toBe(false);
    expect(r.syscallReached).toBe(false);
  });

  it('the rbx decoy cannot satisfy execve — rdi stays unset', () => {
    const chain: ChainEntry[] = [
      { gadget: g('rbx'), word: w('/bin/sh') }, // rbx is not a syscall argument register
      { gadget: g('rsi'), word: w('NULL') },
      { gadget: g('rdx'), word: w('NULL') },
      { gadget: g('rax'), word: w('execve') },
      { gadget: g('syscall') },
    ];
    const r = runChain(chain);
    expect(r.shell).toBe(false);
    expect(r.reason).toMatch(/rdi/);
  });
});
