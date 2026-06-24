// Page replacement — when memory is full and a new page is needed, which resident page do you
// evict? The OS virtual-memory manager and a database buffer pool face the identical question, and
// the answer drives how many slow page faults (disk reads) you take. We simulate four classic
// policies on a page-reference string with a fixed number of frames:
//   • FIFO   — evict the oldest-loaded page. Simple, but suffers Belady's anomaly.
//   • LRU    — evict the least-recently-used page. The practical gold standard; needs usage tracking.
//   • OPT    — evict the page used farthest in the FUTURE (Belady's optimal). Unrealizable (needs a
//              crystal ball), but it's the lower bound every real policy is measured against.
//   • CLOCK  — second-chance: a cheap LRU approximation using one reference bit per frame.
// The honest, surprising result is BELADY'S ANOMALY: under FIFO, giving a process MORE frames can
// cause MORE faults. The fault counts here are anchored to the textbook reference string. Tested.

export type Algo = 'FIFO' | 'LRU' | 'OPT' | 'CLOCK';

export interface PgStep {
  page: number; // the page referenced at this step
  hit: boolean; // already resident?
  frames: (number | null)[]; // frame contents after this reference
  victim: number | null; // page evicted to make room (null on a hit or into a free frame)
  hand?: number; // CLOCK hand position (CLOCK only)
  refbits?: number[]; // CLOCK reference bits after this step (CLOCK only)
}

export interface PgResult { algo: Algo; numFrames: number; steps: PgStep[]; faults: number; hits: number }

export function simulate(algo: Algo, refs: number[], numFrames: number): PgResult {
  const frames: (number | null)[] = new Array(numFrames).fill(null);
  const steps: PgStep[] = [];
  let faults = 0;

  // FIFO insertion order / LRU recency list hold the PAGES currently resident
  const order: number[] = []; // FIFO: oldest first ; LRU: least-recently-used first
  const ref = new Array(numFrames).fill(0); // CLOCK reference bits
  let hand = 0; // CLOCK hand

  const freeSlot = () => frames.indexOf(null);

  for (let t = 0; t < refs.length; t++) {
    const page = refs[t];
    const present = frames.indexOf(page);
    let victim: number | null = null;

    if (present >= 0) {
      // HIT
      if (algo === 'LRU') { order.splice(order.indexOf(page), 1); order.push(page); } // refresh recency
      if (algo === 'CLOCK') ref[present] = 1; // give it a second chance later
    } else {
      // FAULT
      faults++;
      const free = freeSlot();
      if (free >= 0 && algo !== 'CLOCK') {
        frames[free] = page;
        if (algo === 'FIFO' || algo === 'LRU') order.push(page);
      } else if (algo === 'CLOCK') {
        const f2 = freeSlot();
        if (f2 >= 0) { frames[f2] = page; ref[f2] = 1; }
        else {
          while (ref[hand] === 1) { ref[hand] = 0; hand = (hand + 1) % numFrames; } // clear & advance
          victim = frames[hand];
          frames[hand] = page; ref[hand] = 1; hand = (hand + 1) % numFrames; // load, set bit, move on
        }
      } else {
        // pick a victim PAGE per policy, then reuse its slot
        let vp: number;
        if (algo === 'FIFO') vp = order.shift()!; // oldest loaded
        else if (algo === 'LRU') vp = order.shift()!; // least recently used (front of recency)
        else vp = optVictim(frames, refs, t); // OPT: used farthest in the future
        victim = vp;
        const slot = frames.indexOf(vp);
        frames[slot] = page;
        if (algo === 'FIFO' || algo === 'LRU') order.push(page);
      }
    }

    const step: PgStep = { page, hit: present >= 0, frames: [...frames], victim };
    if (algo === 'CLOCK') { step.hand = hand; step.refbits = [...ref]; }
    steps.push(step);
  }

  return { algo, numFrames, steps, faults, hits: refs.length - faults };
}

/** OPT: among resident pages, evict the one whose next use is farthest away (or never used again). */
function optVictim(frames: (number | null)[], refs: number[], t: number): number {
  let victim = frames[0]!;
  let farthest = -1;
  for (const p of frames) {
    if (p === null) continue;
    let next = Infinity;
    for (let j = t + 1; j < refs.length; j++) if (refs[j] === p) { next = j; break; }
    if (next > farthest) { farthest = next; victim = p; }
  }
  return victim;
}

/** The textbook reference string that exhibits Belady's anomaly under FIFO. */
export const BELADY_STRING = [1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5];
