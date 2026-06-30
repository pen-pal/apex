import { describe, it, expect } from 'vitest';
import { fft, ifft, cx, mag, signalFrom } from '../src/web/fft';

const close = (a: { re: number; im: number }, re: number, im: number) => {
  expect(a.re).toBeCloseTo(re, 9);
  expect(a.im).toBeCloseTo(im, 9);
};

describe('FFT of small known signals', () => {
  it('a constant signal has all its energy in the DC (bin 0)', () => {
    const X = fft([cx(1), cx(1), cx(1), cx(1)]);
    close(X[0], 4, 0); // sum
    close(X[1], 0, 0); close(X[2], 0, 0); close(X[3], 0, 0);
  });
  it('a unit impulse has a flat spectrum', () => {
    const X = fft([cx(1), cx(0), cx(0), cx(0)]);
    for (const b of X) close(b, 1, 0);
  });
  it('FFT([1,2,3,4]) matches the hand-computed transform', () => {
    const X = fft([cx(1), cx(2), cx(3), cx(4)]);
    close(X[0], 10, 0);
    close(X[1], -2, 2);
    close(X[2], -2, 0);
    close(X[3], -2, -2);
  });
});

describe('inverse FFT recovers the original signal', () => {
  it('ifft(fft(x)) === x', () => {
    const x = [cx(1), cx(2), cx(3), cx(4), cx(5), cx(6), cx(7), cx(8)];
    const back = ifft(fft(x));
    back.forEach((c, i) => close(c, x[i].re, 0));
  });
});

describe('a pure tone shows up in its frequency bin', () => {
  it('a cosine at frequency 2 puts energy in bins 2 and N−2', () => {
    const n = 16;
    const x = signalFrom(n, [{ freq: 2, amp: 1 }]);
    const X = fft(x);
    const mags = X.map(mag);
    // bins 2 and 14 carry the energy (real cosine → symmetric spectrum), others ~0
    expect(mags[2]).toBeCloseTo(n / 2, 6);
    expect(mags[14]).toBeCloseTo(n / 2, 6);
    expect(mags[1]).toBeCloseTo(0, 6);
    expect(mags[5]).toBeCloseTo(0, 6);
  });
  it('two tones produce two peaks', () => {
    const n = 32;
    const X = fft(signalFrom(n, [{ freq: 3, amp: 1 }, { freq: 7, amp: 0.5 }]));
    const mags = X.map(mag);
    expect(mags[3]).toBeGreaterThan(mags[4]);
    expect(mags[7]).toBeGreaterThan(mags[8]);
    expect(mags[3]).toBeGreaterThan(mags[7]); // freq 3 has the larger amplitude
  });
});
