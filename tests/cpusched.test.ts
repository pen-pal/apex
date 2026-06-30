import { describe, it, expect } from 'vitest';
import { schedule, type Job } from '../src/web/cpusched';

// Canonical job set, hand-traced for every policy below (single CPU, integer time):
//   A: arrival 0, burst 7 | B: arrival 2, burst 4 | C: arrival 4, burst 1 | D: arrival 5, burst 4
const JOBS: Job[] = [
  { id: 'A', arrival: 0, burst: 7 },
  { id: 'B', arrival: 2, burst: 4 },
  { id: 'C', arrival: 4, burst: 1 },
  { id: 'D', arrival: 5, burst: 4 },
];
const m = (s: ReturnType<typeof schedule>, id: string) => s.metrics.find((x) => x.id === id)!;

describe('FCFS — runs strictly in arrival order; the convoy effect', () => {
  const s = schedule(JOBS, 'fcfs');
  it('Gantt is A,B,C,D back to back', () => {
    expect(s.gantt).toEqual([
      { id: 'A', start: 0, end: 7 }, { id: 'B', start: 7, end: 11 },
      { id: 'C', start: 11, end: 12 }, { id: 'D', start: 12, end: 16 },
    ]);
  });
  it('averages match the hand trace', () => {
    expect(s.avgTurnaround).toBe(8.75); // (7+9+8+11)/4
    expect(s.avgWaiting).toBe(4.75);    // (0+5+7+7)/4
  });
});

describe('SJF — shortest job next minimizes average waiting among non-preemptive', () => {
  const s = schedule(JOBS, 'sjf');
  it('after A finishes at 7 it picks C (1) then B (tie broken by arrival) then D', () => {
    expect(s.gantt).toEqual([
      { id: 'A', start: 0, end: 7 }, { id: 'C', start: 7, end: 8 },
      { id: 'B', start: 8, end: 12 }, { id: 'D', start: 12, end: 16 },
    ]);
  });
  it('average waiting (4.0) beats FCFS (4.75)', () => {
    expect(s.avgTurnaround).toBe(8.0); // (7+4+10+11)/4
    expect(s.avgWaiting).toBe(4.0);    // (0+3+6+7)/4
  });
});

describe('SRTF — preemptive; the provably minimal average waiting', () => {
  const s = schedule(JOBS, 'srtf');
  it('B is preempted by C, then resumes; A is starved to the end', () => {
    expect(s.gantt).toEqual([
      { id: 'A', start: 0, end: 2 }, { id: 'B', start: 2, end: 4 }, { id: 'C', start: 4, end: 5 },
      { id: 'B', start: 5, end: 7 }, { id: 'D', start: 7, end: 11 }, { id: 'A', start: 11, end: 16 },
    ]);
  });
  it('average waiting (3.0) is the lowest of all policies', () => {
    expect(s.avgTurnaround).toBe(7.0); // (16+5+1+6)/4
    expect(s.avgWaiting).toBe(3.0);    // (9+1+0+2)/4
    expect(m(s, 'C').response).toBe(0);
  });
});

describe('round-robin (q=2) — worse turnaround, better responsiveness', () => {
  const s = schedule(JOBS, 'rr', 2);
  it('time-slices the jobs; C and D wait their turn in the queue', () => {
    expect(m(s, 'A').completion).toBe(16);
    expect(m(s, 'B').completion).toBe(9);
    expect(m(s, 'C').completion).toBe(7);
    expect(m(s, 'D').completion).toBe(15);
    expect(s.avgWaiting).toBe(5.0);    // (9+3+2+6)/4 — higher than SJF/SRTF
  });
  it('every Gantt slice is at most one quantum long', () => {
    for (const g of s.gantt) expect(g.end - g.start).toBeLessThanOrEqual(2);
  });
});

describe('invariants across policies', () => {
  it('all of the CPU time is conserved (no work lost or invented)', () => {
    const totalBurst = JOBS.reduce((a, j) => a + j.burst, 0);
    for (const p of ['fcfs', 'sjf', 'srtf', 'rr'] as const) {
      const s = schedule(JOBS, p);
      const busy = s.gantt.reduce((a, g) => a + (g.end - g.start), 0);
      expect(busy, p).toBe(totalBurst);
      for (const mm of s.metrics) expect(mm.waiting, `${p}/${mm.id}`).toBeGreaterThanOrEqual(0);
    }
  });
});
