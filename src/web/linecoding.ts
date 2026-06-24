// Line coding — how a string of bits becomes an actual voltage waveform on the wire.
// The same bits look completely different under each scheme, and the differences are
// the whole point: self-clocking (is there a guaranteed transition to recover the
// clock from?), DC balance, and how many signal levels the receiver must distinguish.
//
// Conventions used (and cited):
//   Manchester  — IEEE 802.3: logic 0 = high→low mid-bit, logic 1 = low→high mid-bit.
//   Diff. Manch.— mandatory mid-bit transition; a transition at the START of a bit
//                 encodes 0, no start transition encodes 1.
//   NRZI        — transition at the bit boundary encodes 1, none encodes 0.
//   AMI         — 0 = zero volts; 1 = alternating +/− ("bipolar", DC-free).
// Each waveform is emitted at half-bit resolution (2 samples/bit) so they line up.
// Pure and tested against hand-worked vectors.

export type Level = -1 | 0 | 1;
export type Bit = 0 | 1;

export interface Encoding {
  id: string;
  name: string;
  levels: number;        // distinct signal levels the receiver must distinguish
  selfClocking: boolean; // guaranteed transition every bit → clock recoverable
  samples: Level[];      // 2 per bit
  note: string;
}

const dup = (l: Level): Level[] => [l, l];

/** NRZ-L: high for 1, low for 0. One level held for the whole bit. */
function nrzl(bits: Bit[]): Level[] {
  return bits.flatMap((b) => dup(b ? 1 : -1));
}

/** NRZI: invert the level at the bit boundary for a 1, hold it for a 0. */
function nrzi(bits: Bit[]): Level[] {
  let level: Level = -1; // resting level before the first bit
  const out: Level[] = [];
  for (const b of bits) {
    if (b) level = (-level) as Level; // transition encodes 1
    out.push(...dup(level));
  }
  return out;
}

/** Manchester (IEEE 802.3): 1 = low→high, 0 = high→low, transition at mid-bit. */
function manchester(bits: Bit[]): Level[] {
  return bits.flatMap((b) => (b ? [-1, 1] : [1, -1]) as Level[]);
}

/** Differential Manchester: always a mid-bit transition; a start-of-bit transition encodes 0. */
function diffManchester(bits: Bit[]): Level[] {
  let level: Level = 1;
  const out: Level[] = [];
  for (const b of bits) {
    if (b === 0) level = (-level) as Level; // 0 → transition at the start of the bit
    out.push(level);
    level = (-level) as Level;              // mandatory mid-bit transition
    out.push(level);
  }
  return out;
}

/** AMI (bipolar): 0 = 0 V; each 1 alternates +1 / −1, giving zero DC. */
function ami(bits: Bit[]): Level[] {
  let last: Level = -1; // so the first mark comes out +1
  const out: Level[] = [];
  for (const b of bits) {
    if (b === 0) out.push(...dup(0));
    else { last = (-last) as Level; out.push(...dup(last)); }
  }
  return out;
}

export function encodeAll(bits: Bit[]): Encoding[] {
  return [
    { id: 'nrzl', name: 'NRZ-L', levels: 2, selfClocking: false, samples: nrzl(bits),
      note: 'simplest, but a long run of one value has no transitions — the receiver can lose the clock.' },
    { id: 'nrzi', name: 'NRZI', levels: 2, selfClocking: false, samples: nrzi(bits),
      note: 'encodes 1 as a transition; immune to polarity inversion, but long runs of 0 still starve the clock.' },
    { id: 'manchester', name: 'Manchester', levels: 2, selfClocking: true, samples: manchester(bits),
      note: 'a transition every bit → self-clocking and DC-free, at the cost of double the bandwidth (10BASE-T).' },
    { id: 'diff', name: 'Diff. Manchester', levels: 2, selfClocking: true, samples: diffManchester(bits),
      note: 'self-clocking and polarity-independent — it reads transitions, not absolute levels (Token Ring).' },
    { id: 'ami', name: 'AMI (bipolar)', levels: 3, selfClocking: false, samples: ami(bits),
      note: 'alternating marks keep the average voltage at zero; runs of 0 still carry no transitions (T1).' },
  ];
}
