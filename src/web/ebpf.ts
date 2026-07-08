// eBPF and its verifier. eBPF lets you load your own programs into the running kernel — attached to hooks like XDP (on
// the NIC), kprobes (on any function), or LSM (on security decisions). Untrusted code in the kernel would be insane
// without a catch: before loading, a static VERIFIER walks every path of the program and proves it is safe — it
// terminates (loops must have a compile-time bound), never reads or writes out of bounds, stays under a complexity
// limit, and calls only the helpers its program type allows. Fail any check and the program is rejected and never runs.
// This models those accept/reject rules and a tiny XDP packet filter; the checks match what the real verifier enforces,
// though the real one is a full abstract interpreter over the instruction stream.

// Toggleable properties of the XDP program you're writing. Each `true` is the safe choice.
export interface Program {
  boundedLoop: boolean;   // false → an unbounded loop: the verifier can't prove it terminates
  checksBounds: boolean;  // false → reads packet data without checking data_end first
  smallEnough: boolean;   // false → exceeds the instruction / complexity limit
  safeHelpers: boolean;   // false → calls a helper not permitted for XDP programs
}

export interface Verdict { loaded: boolean; reason: string }

// The verifier's checks, in the order it would reject. All must pass for the program to load.
export function verify(p: Program): Verdict {
  if (!p.boundedLoop) return { loaded: false, reason: 'rejected: back-edge without a bound — the verifier can’t prove the loop terminates, and a kernel that hangs is a dead machine.' };
  if (!p.checksBounds) return { loaded: false, reason: 'rejected: invalid memory access — the program reads packet bytes without first checking them against data_end, so it could read past the packet.' };
  if (!p.smallEnough) return { loaded: false, reason: 'rejected: program too large — it exceeds the instruction/complexity limit the verifier will analyze (it must check every path).' };
  if (!p.safeHelpers) return { loaded: false, reason: 'rejected: unknown or disallowed helper — an XDP program may only call the helpers permitted for its program type.' };
  return { loaded: true, reason: 'accepted: the verifier proved every path terminates, stays in bounds, and is small enough — the JIT compiles it to native code and attaches it to the NIC.' };
}

export interface Packet { id: number; src: string; flood: boolean }  // flood = source is on the blocklist
export interface PacketResult { packet: Packet; action: 'DROP' | 'PASS' }

// The XDP hook runs the program on every packet BEFORE the kernel network stack sees it. Our program drops blocklisted
// sources. If the program never loaded (verifier rejected it), nothing runs at the hook and every packet passes.
export function runXdp(loaded: boolean, packets: Packet[]): PacketResult[] {
  return packets.map((p) => ({ packet: p, action: loaded && p.flood ? 'DROP' : 'PASS' }));
}

export interface Score { dropped: number; floodThrough: number; legitPassed: number }
export function score(results: PacketResult[]): Score {
  let dropped = 0, floodThrough = 0, legitPassed = 0;
  for (const r of results) {
    if (r.action === 'DROP') dropped++;
    else if (r.packet.flood) floodThrough++;
    else legitPassed++;
  }
  return { dropped, floodThrough, legitPassed };
}

export const DEFAULT_PACKETS = (): Packet[] => [
  { id: 1, src: '203.0.113.7', flood: true }, { id: 2, src: '198.51.100.4', flood: false },
  { id: 3, src: '203.0.113.7', flood: true }, { id: 4, src: '203.0.113.7', flood: true },
  { id: 5, src: '198.51.100.9', flood: false }, { id: 6, src: '203.0.113.7', flood: true },
  { id: 7, src: '198.51.100.4', flood: false }, { id: 8, src: '203.0.113.7', flood: true },
];
