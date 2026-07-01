// Polling vs interrupts vs DMA, made visible. Slide the transfer size and watch the CPU cost of each strategy:
// polling and interrupts grow with N; DMA stays flat, because the DMA controller does the transfer and the CPU
// pays only a one-time setup plus one completion interrupt. Real logic from io.ts.
import { useState } from 'react';
import { ioCost, dmaCrossover, type Strategy } from './io';

const SIZES = [1, 4, 16, 64, 256, 1024, 4096, 16384, 65536, 262144, 1048576];
const fmtBytes = (n: number) => n >= 1048576 ? (n / 1048576) + ' MB' : n >= 1024 ? (n / 1024) + ' KB' : n + ' B';
const fmtCyc = (n: number) => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : '' + n;

const INFO: Record<Strategy, { label: string; note: string; cls: string }> = {
  polling: { label: 'Polling (programmed I/O)', note: 'CPU spins on the status register and copies every byte — 100% busy the whole time', cls: 'poll' },
  interrupt: { label: 'Interrupt-driven', note: 'CPU is free between bytes, but pays a fixed IRQ overhead for every one — a fast stream drowns it', cls: 'irq' },
  dma: { label: 'DMA', note: 'CPU programs the controller once and gets one done-interrupt; the controller streams the rest', cls: 'dma' },
};

export function IoSection() {
  const [idx, setIdx] = useState(7); // 16 KB
  const bytes = SIZES[idx];
  const results = (['polling', 'interrupt', 'dma'] as Strategy[]).map((s) => ({ s, ...ioCost(s, bytes) }));
  const max = Math.max(...results.map((r) => r.cpuCycles));

  return (
    <div className="iod">
      <p className="iod-intro">
        A device has N bytes for memory. Three ways to move them, each trading CPU time for hardware. Slide the
        transfer size and watch where the CPU's time goes:
      </p>

      <label className="iod-slider">transfer size <b>{fmtBytes(bytes)}</b><input type="range" min={0} max={SIZES.length - 1} value={idx} onChange={(e) => setIdx(+e.target.value)} /></label>

      <div className="iod-cards">
        {results.map((r) => (
          <div key={r.s} className={`iod-card ${INFO[r.s].cls}`}>
            <div className="iod-clabel">{INFO[r.s].label}</div>
            <div className="iod-bar-wrap"><div className={`iod-bar ${INFO[r.s].cls}`} style={{ width: `${(r.cpuCycles / max) * 100}%` }} /></div>
            <div className="iod-nums"><span className="iod-cyc">{fmtCyc(r.cpuCycles)} CPU cycles</span><span className="iod-irq">{r.interrupts.toLocaleString()} IRQ{r.interrupts === 1 ? '' : 's'}</span></div>
            <div className="iod-note">{INFO[r.s].note}</div>
          </div>
        ))}
      </div>

      <div className="iod-verdict">
        At <b>{fmtBytes(bytes)}</b>, DMA costs the CPU a flat <b>{ioCost('dma', bytes).cpuCycles}</b> cycles while
        interrupt-driven I/O costs <b>{fmtCyc(ioCost('interrupt', bytes).cpuCycles)}</b> — DMA wins from
        <b>{dmaCrossover()}</b> bytes up, and the gap only grows.
      </div>

      <p className="iod-foot">
        The three metrics that matter are CPU cycles spent, whether the CPU is free to do other work, and how many
        interrupts fire. Polling is cheapest per byte but the worst on availability: the CPU does nothing else
        while it waits, so it's only sane for very short waits or a system with nothing better to do. Interrupts
        buy availability — the CPU works until a byte arrives — but the per-interrupt cost is fixed regardless of
        payload, so a 10 Gbps NIC delivering millions of packets a second would spend all its time in interrupt
        handlers (which is exactly why high-rate drivers switch to polling under load, the NAPI trick in Linux, or
        coalesce many events into one interrupt). DMA is the general answer: constant CPU cost, CPU free during
        the transfer, one interrupt at the end. The tradeoffs it introduces are real — the DMA controller and CPU
        now share the memory bus (cycle stealing), the OS must pin the buffer so it can't be paged out mid-
        transfer, and cache coherence has to be handled since the controller writes memory behind the CPU's back.
        Modern systems layer all three: a NIC DMAs packets into ring buffers, raises one interrupt for a batch,
        and the driver polls the ring to drain it. (Patterson &amp; Hennessy; Tanenbaum, Modern Operating Systems.)
      </p>
    </div>
  );
}
