import { describe, it, expect } from 'vitest';
import { ioCost, dmaCrossover, DEFAULTS } from '../src/web/io';

describe('CPU cost of moving N bytes', () => {
  it('polling and interrupt-driven scale linearly with N; DMA is constant', () => {
    expect(ioCost('polling', 2000).cpuCycles).toBe(2 * ioCost('polling', 1000).cpuCycles);
    expect(ioCost('interrupt', 2000).cpuCycles).toBe(2 * ioCost('interrupt', 1000).cpuCycles);
    expect(ioCost('dma', 1).cpuCycles).toBe(ioCost('dma', 1_000_000).cpuCycles); // independent of N
    expect(ioCost('dma', 5).scalesWithN).toBe(false);
  });
  it('interrupt count is 0 (polling) / N (interrupt) / 1 (dma)', () => {
    expect(ioCost('polling', 100).interrupts).toBe(0);
    expect(ioCost('interrupt', 100).interrupts).toBe(100);
    expect(ioCost('dma', 100).interrupts).toBe(1);
  });
  it('interrupt-per-byte costs more CPU per byte than polling (fixed IRQ overhead)', () => {
    // this is why a fast byte-stream drowns an interrupt-driven CPU
    expect(ioCost('interrupt', 1000).cpuCycles).toBeGreaterThan(ioCost('polling', 1000).cpuCycles);
  });
  it('matches the exact formulas', () => {
    const c = DEFAULTS;
    expect(ioCost('polling', 10).cpuCycles).toBe(10 * (c.pollCycles + c.copyCycles));
    expect(ioCost('interrupt', 10).cpuCycles).toBe(10 * (c.isrCycles + c.copyCycles));
    expect(ioCost('dma', 10).cpuCycles).toBe(c.dmaSetup + c.isrCycles);
  });
});

describe('DMA crossover', () => {
  it('above the crossover, DMA costs the CPU less than interrupts, and for big transfers it dominates', () => {
    const x = dmaCrossover();
    expect(ioCost('dma', x).cpuCycles).toBeLessThanOrEqual(ioCost('interrupt', x).cpuCycles);
    const big = 1 << 20;
    expect(ioCost('dma', big).cpuCycles).toBeLessThan(ioCost('polling', big).cpuCycles / 1000);
  });
});
