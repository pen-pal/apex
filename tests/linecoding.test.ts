import { describe, it, expect } from 'vitest';
import { encodeAll, type Bit } from '../src/web/linecoding';

// Hand-worked waveforms for the bit pattern 1 0 1 1, at half-bit resolution.
const BITS: Bit[] = [1, 0, 1, 1];
const by = (id: string) => encodeAll(BITS).find((e) => e.id === id)!;
// collapse half-bit samples back to one level per bit (both halves equal for AMI)
const ami2 = (s: number[]) => s.filter((_, i) => i % 2 === 0);

describe('line coding waveforms for 1011', () => {
  it('NRZ-L holds high for 1, low for 0', () => {
    expect(by('nrzl').samples).toEqual([1, 1, -1, -1, 1, 1, 1, 1]);
  });

  it('NRZI transitions on each 1, holds on 0 (resting level −1)', () => {
    // -1 →(1)→ +1, hold(0) +1, →(1)→ -1, →(1)→ +1
    expect(by('nrzi').samples).toEqual([1, 1, 1, 1, -1, -1, 1, 1]);
  });

  it('Manchester (IEEE 802.3): 1 = low→high, 0 = high→low', () => {
    expect(by('manchester').samples).toEqual([-1, 1, 1, -1, -1, 1, -1, 1]);
  });

  it('Differential Manchester: mid-bit transition always; 0 adds a start transition', () => {
    // init +1: 1→[+1,-1]; 0→start flip→[+1,-1]; 1→[-1,+1]; 1→[+1,-1]
    expect(by('diff').samples).toEqual([1, -1, 1, -1, -1, 1, 1, -1]);
  });

  it('AMI alternates marks around zero, 0 sits at zero volts', () => {
    // 1→+1, 0→0, 1→-1, 1→+1
    expect(by('ami').samples).toEqual([1, 1, 0, 0, -1, -1, 1, 1]);
  });
});

describe('coding properties', () => {
  it('reports self-clocking and level counts correctly', () => {
    const all = encodeAll(BITS);
    expect(all.find((e) => e.id === 'manchester')!.selfClocking).toBe(true);
    expect(all.find((e) => e.id === 'nrzl')!.selfClocking).toBe(false);
    expect(all.find((e) => e.id === 'ami')!.levels).toBe(3);
  });

  it('AMI marks strictly alternate in polarity (the DC-free property)', () => {
    // take one level per bit, drop the zeros, and check consecutive marks flip sign
    const marks = ami2(by('ami').samples).filter((v) => v !== 0);
    for (let i = 1; i < marks.length; i++) expect(marks[i]).toBe(-marks[i - 1]);
  });

  it('every scheme emits two samples per bit', () => {
    for (const e of encodeAll([1, 0, 0, 1, 1, 0])) expect(e.samples).toHaveLength(12);
  });
});
