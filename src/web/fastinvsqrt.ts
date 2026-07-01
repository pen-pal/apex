// The fast inverse square root — the most famous 20 lines in game programming, from the Quake III Arena source.
// Computing 1/sqrt(x) is everywhere in 3D graphics (normalizing a vector — lighting, reflections — needs it per
// vertex), and in 1999 a hardware sqrt was slow. This code approximates it with NO division and NO sqrt, using a
// single integer subtraction and one refinement step:
//
//     i  = *(int*)&x;                 // reinterpret the float's BITS as an integer
//     i  = 0x5f3759df - (i >> 1);     // the magic line
//     y  = *(float*)&i;               // reinterpret back to float — already a good guess
//     y  = y * (1.5f - 0.5f*x*y*y);   // one Newton step polishes it to ~0.17% error
//
// Why it works is the beautiful part: an IEEE-754 float stores x as (1+m)·2^e, and its raw bit pattern, read as
// an integer, is very nearly a SCALED, SHIFTED log2(x) — the exponent field is the integer part of the log and
// the mantissa field linearly approximates the fractional part. So computing 1/sqrt(x) = x^(-1/2) is, in log
// space, just multiplying the log by -1/2 — which is exactly what `-(i >> 1)` does (shift = divide the log by 2,
// negate). The magic constant 0x5f3759df restores the exponent bias that the shift disturbed and nudges the
// mantissa's piecewise-linear fit to minimize error. Then one Newton-Raphson iteration on f(y)=1/y²-x roughly
// squares the precision. This models the bit reinterpretation, the magic line, and the Newton refinement.
// Reference: Quake III Arena source (id Software, 1999); Lomont, "Fast Inverse Square Root" (2003).

export const MAGIC = 0x5f3759df;

const f32 = new Float32Array(1);
const u32 = new Uint32Array(f32.buffer); // aliased views: same 4 bytes as float or as uint

/** Reinterpret a float32's bits as a uint32 (the C `*(int*)&x`). */
export function bitsOf(x: number): number { f32[0] = x; return u32[0]; }
/** Reinterpret a uint32's bits as a float32 (the C `*(float*)&i`). */
export function floatOf(bits: number): number { u32[0] = bits >>> 0; return f32[0]; }

/** Decompose a float32 into IEEE-754 fields (for display). */
export function fields(x: number): { sign: number; exponent: number; mantissa: number; bits: number } {
  const b = bitsOf(x);
  return { sign: (b >>> 31) & 1, exponent: (b >>> 23) & 0xff, mantissa: b & 0x7fffff, bits: b };
}

export interface Result { guess: number; steps: number[]; refined: number; trueValue: number; relError: number }

/** Fast inverse square root: the bit hack + `iterations` Newton-Raphson refinements. */
export function fastInvSqrt(x: number, iterations = 1): Result {
  const i = bitsOf(x);
  let y = floatOf((MAGIC - (i >>> 1)) >>> 0); // the magic line → initial guess
  const guess = y;
  const steps = [y];
  const halfX = 0.5 * x;
  for (let k = 0; k < iterations; k++) { y = y * (1.5 - halfX * y * y); steps.push(y); }
  const trueValue = 1 / Math.sqrt(x);
  return { guess, steps, refined: y, trueValue, relError: Math.abs(y - trueValue) / trueValue };
}
