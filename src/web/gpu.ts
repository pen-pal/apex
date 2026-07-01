// How a GPU runs code — SIMT, and the two ways it stalls. A GPU has thousands of tiny cores, but they aren't
// independent: they're wired into groups (a WARP on NVIDIA is 32 threads, a wavefront on AMD is 64) that share one
// instruction fetch and execute in LOCKSTEP. That's SIMT — Single Instruction, Multiple Threads: every thread in
// a warp runs the SAME instruction each cycle, just on its own data. This is why GPUs crush data-parallel work
// (add these million numbers) and stumble on branchy code. Two hazards follow directly from lockstep. (1) BRANCH
// DIVERGENCE: if an `if` sends some threads of a warp one way and the rest another, the hardware can't run both at
// once — it executes the taken path with the other threads masked OFF (idle), then the not-taken path with the
// first group masked off. The two sides are serialized, so a warp that splits down the middle does ~2x the work
// for the same result; the more branchy the code, the more idle lanes. (2) MEMORY COALESCING: the 32 threads
// issue their loads together, and if their addresses fall in one contiguous, aligned chunk the memory system
// fuses them into ONE wide transaction. If the addresses are scattered, it takes a separate transaction per line —
// each dragging in a full cache line to use just a few bytes — and bandwidth collapses. So the GPU golden rules
// are "keep a warp on one branch" and "make neighboring threads touch neighboring memory." This models warp
// divergence (passes + SIMT efficiency) and coalescing (transactions + bandwidth efficiency). Reference: NVIDIA
// CUDA C Programming Guide; Hennessy & Patterson, ch. 4 (data-level parallelism).

export const WARP = 32;

export interface Divergence { passes: number; efficiency: number; diverged: boolean; activePerPass: number[] }

/** A warp hits a branch: `pred[i]` is whether thread i takes the `if`. Diverged branches serialize both paths. */
export function divergence(pred: boolean[]): Divergence {
  const takesIf = pred.filter((x) => x).length;
  const takesElse = pred.length - takesIf;
  const activePerPass: number[] = [];
  if (takesIf > 0) activePerPass.push(takesIf);
  if (takesElse > 0) activePerPass.push(takesElse);
  if (activePerPass.length === 0) activePerPass.push(0);
  const passes = activePerPass.length;
  // SIMT efficiency = useful lane-cycles / total lane-cycles issued (each pass occupies all WARP lanes)
  const efficiency = pred.length === 0 ? 1 : activePerPass.reduce((a, b) => a + b, 0) / (passes * pred.length);
  return { passes, efficiency, diverged: takesIf > 0 && takesElse > 0, activePerPass };
}

export interface Coalesce { transactions: number; efficiency: number; bytesUsed: number; bytesFetched: number }

/** The warp's threads load from `addresses`; the memory system fuses accesses that land in the same cache line. */
export function coalesce(addresses: number[], lineBytes = 128, elemBytes = 4): Coalesce {
  const lines = new Set(addresses.map((a) => Math.floor(a / lineBytes)));
  const transactions = lines.size;
  const bytesUsed = addresses.length * elemBytes;
  const bytesFetched = transactions * lineBytes;
  return { transactions, efficiency: bytesFetched === 0 ? 1 : Math.min(1, bytesUsed / bytesFetched), bytesUsed, bytesFetched };
}

/** Common access patterns for a warp of `n` threads, as byte addresses. */
export const patterns = {
  contiguous: (n: number, elem = 4) => Array.from({ length: n }, (_, i) => i * elem),          // thread i → i (perfect)
  strided: (n: number, stride: number, elem = 4) => Array.from({ length: n }, (_, i) => i * stride * elem),
  scattered: (n: number, elem = 4) => Array.from({ length: n }, (_, i) => ((i * 2654435761) >>> 0) % (n * 128) * elem),
};
