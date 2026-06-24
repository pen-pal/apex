// BB84 quantum key distribution (Bennett & Brassard, 1984) — agree on a secret key
// whose secrecy is guaranteed by physics, not computational hardness. Alice encodes
// each random bit in a random basis (rectilinear + or diagonal ×). Bob measures each
// in a random basis; when his basis matches Alice's he reads the bit, otherwise he
// gets a coin flip. They publicly compare BASES (not bits) and keep the matches — the
// "sifted" key. The magic: an eavesdropper must measure (collapsing the qubit) and
// resend, so when she guesses the basis wrong she injects errors. Comparing a few key
// bits reveals her ~25% error rate, and they abort. Deterministic given the random
// streams; tested.

export type Basis = '+' | 'x';
export type Bit = 0 | 1;

/** Measure a qubit prepared in `prep` basis in `meas` basis; matching → the bit,
 *  mismatched → a coin flip (the irreducible quantum randomness). */
export const measure = (bit: Bit, prep: Basis, meas: Basis, coin: number): Bit =>
  prep === meas ? bit : ((coin < 0.5 ? 0 : 1) as Bit);

export interface Step { bit: Bit; aBasis: Basis; bBasis: Basis; bobBit: Bit; kept: boolean; error: boolean; eBasis?: Basis; eveBit?: Bit }

export interface Run {
  steps: Step[];
  aliceKey: Bit[]; // sifted bits (where bases matched)
  bobKey: Bit[];
  sifted: number;
  errors: number;
  errorRate: number;
}

export interface Eve { eBases: Basis[]; eCoins: number[] }

export function run(aBits: Bit[], aBases: Basis[], bBases: Basis[], coins: number[], eve?: Eve): Run {
  const steps: Step[] = [];
  for (let i = 0; i < aBits.length; i++) {
    let preBit = aBits[i], preBasis = aBases[i];
    let eBasis: Basis | undefined, eveBit: Bit | undefined;
    if (eve) {
      eBasis = eve.eBases[i];
      eveBit = measure(aBits[i], aBases[i], eBasis, eve.eCoins[i]); // Eve measures…
      preBit = eveBit; preBasis = eBasis; // …and resends what she saw, in her basis
    }
    const bobBit = measure(preBit, preBasis, bBases[i], coins[i]);
    const kept = aBases[i] === bBases[i];
    const error = kept && bobBit !== aBits[i];
    steps.push({ bit: aBits[i], aBasis: aBases[i], bBasis: bBases[i], bobBit, kept, error, eBasis, eveBit });
  }
  const keptSteps = steps.filter((s) => s.kept);
  const errors = keptSteps.filter((s) => s.error).length;
  return {
    steps,
    aliceKey: keptSteps.map((s) => s.bit),
    bobKey: keptSteps.map((s) => s.bobBit),
    sifted: keptSteps.length,
    errors,
    errorRate: keptSteps.length ? errors / keptSteps.length : 0,
  };
}
