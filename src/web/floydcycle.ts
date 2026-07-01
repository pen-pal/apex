// Floyd's cycle detection — the "tortoise and hare," the trick for finding a loop in a sequence using O(1)
// memory. Follow a chain where each node points to exactly one next node (a linked list, or repeatedly applying
// a function x → f(x)). Eventually it either ends or loops forever. To detect a loop without remembering every
// node you've seen, run two pointers: the tortoise steps 1 at a time, the hare steps 2. If there's a loop the
// hare laps the tortoise and they land on the SAME node — a meeting that can only happen inside a cycle. Then a
// second, magical phase finds where the loop begins: reset one pointer to the start and advance both by 1;
// they meet exactly at the cycle's entrance (it falls out of the arithmetic: the distance from the start to the
// entrance equals the distance from the meeting point to the entrance, going around). It powers linked-list
// loop checks, detecting infinite iteration, and — as Pollard's rho — integer factorization and hash-collision
// finding. Reference: Floyd (via Knuth TAOCP vol. 2); Brent has a faster variant.

export interface FloydResult {
  hasCycle: boolean;
  meetPoint: number;   // node where tortoise & hare first meet (−1 if no cycle)
  cycleStart: number;  // μ: the node where the loop begins (−1 if none)
  cycleLength: number; // λ: number of nodes in the loop (0 if none)
  tailLength: number;  // number of nodes before the loop
  path: number[];      // start → … → (one full loop) for visualization
}

// One functional step; −1 means a terminal (no successor).
const step = (next: number[], x: number) => (x < 0 ? -1 : next[x]);

export function floyd(next: number[], start: number): FloydResult {
  let slow = start, fast = start;
  do {
    slow = step(next, slow);
    fast = step(next, step(next, fast));
    if (slow < 0 || fast < 0) return { hasCycle: false, meetPoint: -1, cycleStart: -1, cycleLength: 0, tailLength: pathTo(next, start).length, path: pathTo(next, start) };
  } while (slow !== fast);

  const meetPoint = slow;
  // Phase 2: distance(start → entrance) == distance(meet → entrance) around the loop.
  let a = start, b = meetPoint;
  while (a !== b) { a = step(next, a); b = step(next, b); }
  const cycleStart = a;
  // Phase 3: walk the loop once to measure it.
  let cycleLength = 1, c = step(next, cycleStart);
  while (c !== cycleStart) { c = step(next, c); cycleLength++; }
  // tail length: start → cycleStart
  let tailLength = 0, t = start;
  while (t !== cycleStart) { t = step(next, t); tailLength++; }

  return { hasCycle: true, meetPoint, cycleStart, cycleLength, tailLength, path: buildPath(next, start, cycleStart, cycleLength) };
}

function pathTo(next: number[], start: number): number[] {
  const out: number[] = []; let x = start;
  while (x >= 0 && out.length < 200) { out.push(x); x = next[x]; }
  return out;
}
function buildPath(next: number[], start: number, cycleStart: number, cycleLength: number): number[] {
  const out: number[] = []; let x = start;
  while (x !== cycleStart) { out.push(x); x = next[x]; } // tail
  for (let i = 0; i < cycleLength; i++) { out.push(x); x = next[x]; } // one loop
  return out;
}

/** Ground truth: follow the chain remembering every node (O(n) memory) to find the loop. */
export function bruteForce(next: number[], start: number): { hasCycle: boolean; cycleStart: number; cycleLength: number } {
  const seen = new Map<number, number>();
  let x = start, i = 0;
  while (x >= 0) {
    if (seen.has(x)) return { hasCycle: true, cycleStart: x, cycleLength: i - seen.get(x)! };
    seen.set(x, i); x = next[x]; i++;
  }
  return { hasCycle: false, cycleStart: -1, cycleLength: 0 };
}
