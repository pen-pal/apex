// Kahan summation — how to add a list of floating-point numbers without silently losing accuracy. Floats have a
// fixed number of significant bits (~15–16 decimal digits for a 64-bit double), so when you add a small number to
// a large running total, the small one's low-order bits fall off the end and vanish. Sum a million small values
// and the dropped bits accumulate into a real error; sum values of wildly different magnitudes and you can lose
// everything. Kahan's trick (1965) is to carry a second variable, the COMPENSATION, that remembers exactly what
// was lost on the last addition, and to fold it back in on the next one:
//
//     y = x - c        // bring in the next value, pre-corrected by what we lost last time
//     t = sum + y      // the lossy big addition
//     c = (t - sum) - y  // (t - sum) is the part of y that actually landed; subtract y to get −(the lost part)
//     sum = t
//
// The magic is that (t - sum) - y is computed in floating point yet recovers the rounding error of sum + y almost
// exactly, because the two large quantities cancel and expose the low bits. The result: the error of a Kahan sum
// stays near one rounding unit regardless of how many terms you add, instead of growing with the count. It is the
// reason a careful numerics library, a running mean, or a physics integrator doesn't drift. This models naive vs
// Kahan summation so you can watch the compensation recover the lost bits. Reference: Kahan (1965); Higham,
// "Accuracy and Stability of Numerical Algorithms."

/** The obvious way — accumulate straight into one float, dropping low-order bits every step. */
export function naiveSum(nums: number[]): number { let s = 0; for (const x of nums) s += x; return s; }

export interface KahanStep { x: number; sum: number; c: number }
export interface KahanResult { sum: number; compensation: number; steps: KahanStep[] }

/** Compensated summation — carry the running rounding error in `c` and fold it back each step. */
export function kahanSum(nums: number[]): KahanResult {
  let sum = 0, c = 0;
  const steps: KahanStep[] = [];
  for (const x of nums) {
    const y = x - c;            // correct the incoming value by last step's lost bits
    const t = sum + y;          // the big, lossy addition
    c = (t - sum) - y;          // recover exactly what rounding threw away (as a negative)
    sum = t;
    steps.push({ x, sum, c });
  }
  return { sum, compensation: c, steps };
}
