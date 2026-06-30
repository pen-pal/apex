// The FFT, made visible. Build a signal by mixing a few cosine frequencies, then watch the FFT pull them
// back apart: the magnitude spectrum shows a peak at exactly each frequency you added. Drag the amplitudes
// and the peaks rise and fall in lockstep — the transform between time and frequency. Real Cooley-Tukey
// from fft.ts.
import { useMemo, useState } from 'react';
import { fft, mag, signalFrom } from './fft';

const N = 32;
const HUES = [212, 0, 150];

export function FftSection() {
  const [comps, setComps] = useState([{ freq: 3, amp: 1 }, { freq: 7, amp: 0.6 }, { freq: 11, amp: 0 }]);

  const active = comps.filter((c) => c.amp > 0);
  const signal = useMemo(() => signalFrom(N, active), [comps]);
  const mags = useMemo(() => fft(signal).map(mag), [signal]);
  const half = mags.slice(0, N / 2 + 1);
  const maxMag = Math.max(1, ...half);
  const maxSig = Math.max(0.1, ...signal.map((c) => Math.abs(c.re)));

  const set = (i: number, patch: Partial<{ freq: number; amp: number }>) => setComps((cs) => cs.map((c, k) => (k === i ? { ...c, ...patch } : c)));

  const W = 520, H = 90;
  const sigLine = signal.map((c, t) => `${(t / (N - 1) * W).toFixed(1)},${(H / 2 - (c.re / maxSig) * (H / 2 - 4)).toFixed(1)}`).join(' ');

  return (
    <div className="fft">
      <div className="fft-comps">
        {comps.map((c, i) => (
          <div key={i} className="fft-comp" style={{ borderColor: c.amp > 0 ? `hsl(${HUES[i]} 60% 60%)` : 'var(--line)' }}>
            <span className="fft-clabel" style={{ color: `hsl(${HUES[i]} 60% 40%)` }}>tone {i + 1}</span>
            <label>freq <input type="range" min={0} max={15} value={c.freq} onChange={(e) => set(i, { freq: +e.target.value })} /><b>{c.freq}</b></label>
            <label>amp <input type="range" min={0} max={10} value={Math.round(c.amp * 10)} onChange={(e) => set(i, { amp: +e.target.value / 10 })} /><b>{c.amp.toFixed(1)}</b></label>
          </div>
        ))}
      </div>

      <div className="fft-panel">
        <div className="fft-panel-h">time domain — the mixed signal ({N} samples)</div>
        <svg viewBox={`0 0 ${W} ${H}`} className="fft-sig">
          <line x1={0} y1={H / 2} x2={W} y2={H / 2} className="fft-zero" />
          <polyline points={sigLine} className="fft-wave" />
        </svg>
      </div>

      <div className="fft-panel">
        <div className="fft-panel-h">frequency domain — magnitude per bin (the FFT)</div>
        <div className="fft-bars">
          {half.map((m, k) => {
            const isPeak = active.some((c) => c.freq === k) && m > maxMag * 0.1;
            return (
              <div key={k} className="fft-bar-wrap" title={`bin ${k}: ${m.toFixed(1)}`}>
                <div className={`fft-bar ${isPeak ? 'peak' : ''}`} style={{ height: `${(m / maxMag) * 100}%` }} />
                {(k % 4 === 0 || isPeak) && <span className={`fft-bx ${isPeak ? 'on' : ''}`}>{k}</span>}
              </div>
            );
          })}
        </div>
      </div>

      <p className="fft-foot">
        Every bin of the output asks one question — “how much of frequency k is in this signal?” — so a signal you built from a few pure tones
        shows up as a few sharp peaks at exactly those frequencies, and everything else is ~zero. Run it backwards (the inverse FFT) and you get the
        original samples back, losslessly. That round trip is the foundation of <strong>lossy compression</strong> (JPEG/MP3 transform to frequency,
        throw away the bins your eyes/ears don’t notice, transform back), of filtering (zero out unwanted bins), and of fast convolution / polynomial
        &amp; big-integer multiplication (multiply in the frequency domain, where convolution becomes a pointwise product — the same trick as the
        <strong> NTT</strong>, but over complex numbers instead of a finite field). Cooley-Tukey’s O(n log n) is what made all of it practical. (1965.)
      </p>
    </div>
  );
}
