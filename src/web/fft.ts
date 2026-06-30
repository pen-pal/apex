// The Fast Fourier Transform — turning a signal between the TIME domain (samples over time) and the
// FREQUENCY domain (how much of each frequency it contains), in O(n log n) instead of the O(n²) of the
// naive DFT. The Discrete Fourier Transform is X_k = Σ_n x_n·e^(−2πi·kn/N): each output bin k measures
// how strongly frequency k is present. Cooley-Tukey makes it fast by splitting the samples into even and
// odd indices, transforming each half, and combining with "twiddle factors" e^(−2πik/N) — the divide-and-
// conquer that recurses to length 1. It's the same butterfly structure as the NTT (which we do over a
// finite field instead of the complex numbers), and it underlies audio/image codecs, fast polynomial and
// big-integer multiplication, and signal processing everywhere. Reference: Cooley & Tukey (1965).

export interface Complex { re: number; im: number }
export const cx = (re: number, im = 0): Complex => ({ re, im });
const add = (a: Complex, b: Complex): Complex => ({ re: a.re + b.re, im: a.im + b.im });
const sub = (a: Complex, b: Complex): Complex => ({ re: a.re - b.re, im: a.im - b.im });
const mul = (a: Complex, b: Complex): Complex => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
const expi = (t: number): Complex => ({ re: Math.cos(t), im: Math.sin(t) }); // e^(it)
export const mag = (c: Complex) => Math.hypot(c.re, c.im);

/** Recursive radix-2 Cooley-Tukey FFT. `n` must be a power of two. */
export function fft(a: Complex[]): Complex[] {
  const n = a.length;
  if (n <= 1) return a.map((c) => ({ ...c }));
  const even = fft(a.filter((_, i) => i % 2 === 0));
  const odd = fft(a.filter((_, i) => i % 2 === 1));
  const out: Complex[] = new Array(n);
  for (let k = 0; k < n / 2; k++) {
    const t = mul(expi((-2 * Math.PI * k) / n), odd[k]); // twiddle factor × odd half
    out[k] = add(even[k], t);
    out[k + n / 2] = sub(even[k], t);
  }
  return out;
}

/** Inverse FFT: conjugate, forward-transform, conjugate, and scale by 1/n. */
export function ifft(A: Complex[]): Complex[] {
  const n = A.length;
  const conj = A.map((c) => ({ re: c.re, im: -c.im }));
  const y = fft(conj);
  return y.map((c) => ({ re: c.re / n, im: -c.im / n }));
}

/** Build a length-n real signal by summing cosine components {freq, amp}. */
export function signalFrom(n: number, comps: { freq: number; amp: number }[]): Complex[] {
  return Array.from({ length: n }, (_, t) => cx(comps.reduce((s, c) => s + c.amp * Math.cos((2 * Math.PI * c.freq * t) / n), 0)));
}
