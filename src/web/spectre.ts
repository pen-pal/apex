// Spectre (variant 1, bounds-check bypass) — the 2018 attack that reads memory it's not allowed to, by abusing
// the CPU's own speed tricks. Modern CPUs execute SPECULATIVELY: at a branch like `if (x < size)` they guess
// the outcome (the branch predictor, trained by prior runs) and race ahead into the body before the check
// actually resolves. If the guess was wrong, the results are thrown away — architecturally nothing happened.
// But the guess leaves a footprint in the CACHE, and cache state is measurable. The gadget:
//     if (x < array1_size) { y = array2[ array1[x] * 256 ]; }
// Train the predictor with in-bounds x so it guesses "true," then pass a malicious out-of-bounds x. The CPU
// speculatively runs the body: array1[x] reads a SECRET byte from beyond the array, and array2[secret*256]
// pulls one specific cache line in. The speculation rolls back — but that cache line stays warm. The attacker
// then times access to each of the 256 possible lines of array2 (Flush+Reload): the fast one reveals the
// secret byte. Repeat for each address to dump memory. The fix is to stop the speculative load: a barrier
// (lfence) after the bounds check, or index masking, so the out-of-bounds read never happens speculatively.
// Reference: Kocher et al., "Spectre Attacks" (2018).

export const HIT_CYCLES = 50, MISS_CYCLES = 300; // an L1 hit vs a DRAM miss — the timing gap the attacker reads

export interface Memory { array1Size: number; bytes: number[] } // bytes[0..size-1] public; bytes[size..] is the "secret" past the array

/** The vulnerable gadget. Architecturally it should only touch in-bounds x; speculatively (mispredicted branch)
 *  it also touches out-of-bounds x — unless a barrier/mask stops it. Returns the array2 line pulled into cache. */
export function gadget(mem: Memory, x: number, mitigated: boolean): number | null {
  if (x < mem.array1Size) return mem.bytes[x];   // in-bounds: a legitimate load (also warms a line)
  return mitigated ? null : mem.bytes[x];         // out-of-bounds: leaks the secret UNLESS fenced/masked
}

/** Flush+Reload: time all 256 candidate cache lines; the one that's a HIT is the leaked byte. */
export function flushReload(cachedLine: number | null): { times: number[]; recovered: number | null } {
  const times = Array.from({ length: 256 }, (_, i) => (i === cachedLine ? HIT_CYCLES : MISS_CYCLES));
  return { times, recovered: cachedLine === null ? null : cachedLine };
}

/** One Spectre probe: run the gadget at address x, then recover the byte via the cache side channel. */
export function probe(mem: Memory, x: number, mitigated: boolean): { times: number[]; recovered: number | null } {
  return flushReload(gadget(mem, x, mitigated));
}

/** Dump the whole secret region past the array by probing each out-of-bounds index. */
export function recoverSecret(mem: Memory, mitigated: boolean): (number | null)[] {
  const out: (number | null)[] = [];
  for (let x = mem.array1Size; x < mem.bytes.length; x++) out.push(probe(mem, x, mitigated).recovered);
  return out;
}

/** Build a Memory where a public array is followed by a secret string. */
export function makeMemory(publicBytes: number[], secret: string): Memory {
  return { array1Size: publicBytes.length, bytes: publicBytes.concat([...secret].map((c) => c.charCodeAt(0))) };
}
