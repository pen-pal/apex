// Automatic Repeat reQuest — how reliable transport recovers a lost frame, and why
// the two classic strategies cost so differently. Both number frames and use a
// sliding window; they differ at the receiver:
//   • Go-Back-N: receiver window = 1. It discards anything after a gap and only
//     cumulative-ACKs the last in-order frame, so on timeout the sender resends the
//     lost frame AND everything sent after it.
//   • Selective Repeat: receiver window = N. It buffers out-of-order frames and
//     ACKs them individually, so the sender resends ONLY the lost frame.
// Pure, deterministic model (tested) — one frame dropped on its first transmission.

export type Protocol = 'GBN' | 'SR';
export type Outcome = 'acked' | 'lost' | 'discarded' | 'buffered' | 'resent';
export interface Slot { frame: number; outcome: Outcome; pass: 1 | 2 }

export interface ArqRun {
  protocol: Protocol;
  slots: Slot[]; // every transmission attempt, in order
  total: number; // total frames put on the wire
  retransmits: number; // how many were retransmissions (pass 2)
}

/** Simulate sending frames 0..n-1 when `lost` is dropped on its first send. */
export function simulate(n: number, lost: number, protocol: Protocol): ArqRun {
  const slots: Slot[] = [];
  for (let f = 0; f < n; f++) {
    if (f < lost) slots.push({ frame: f, outcome: 'acked', pass: 1 });
    else if (f === lost) slots.push({ frame: f, outcome: 'lost', pass: 1 });
    else slots.push({ frame: f, outcome: protocol === 'GBN' ? 'discarded' : 'buffered', pass: 1 });
  }
  if (protocol === 'GBN') {
    for (let f = lost; f < n; f++) slots.push({ frame: f, outcome: 'resent', pass: 2 }); // go back N
  } else {
    slots.push({ frame: lost, outcome: 'resent', pass: 2 }); // selective: just the gap
  }
  const retransmits = slots.filter((s) => s.pass === 2).length;
  return { protocol, slots, total: slots.length, retransmits };
}

/** Frames the receiver had to throw away (GBN) — wasted work the wire still paid for. */
export const wasted = (run: ArqRun): number => run.slots.filter((s) => s.outcome === 'discarded').length;
