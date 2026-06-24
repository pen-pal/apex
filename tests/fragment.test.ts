import { describe, it, expect } from 'vitest';
import { fragment, reassemble, pmtud, IP_HEADER } from '../src/web/fragment';

describe('fragmentation (RFC 791)', () => {
  it('fits a small payload in a single unfragmented packet', () => {
    const r = fragment(1000, 1500);
    expect(r.fragments).toHaveLength(1);
    expect(r.fragments[0]).toMatchObject({ offsetUnits: 0, size: 1000, mf: false });
  });

  it('splits 4000 bytes over a 1500-MTU link into 3 fragments', () => {
    const r = fragment(4000, 1500);
    // room = floor((1500-20)/8)*8 = 1480
    expect(r.maxPayloadPerFrag).toBe(1480);
    expect(r.fragments.map((f) => f.size)).toEqual([1480, 1480, 1040]);
    expect(r.fragments.map((f) => f.offsetUnits)).toEqual([0, 185, 370]); // 1480/8, 2960/8
    expect(r.fragments.map((f) => f.mf)).toEqual([true, true, false]); // MF set on all but the last
  });

  it('rounds the per-fragment payload DOWN to a multiple of 8', () => {
    const r = fragment(3000, 600); // room = floor((600-20)/8)*8 = floor(580/8)*8 = 576
    expect(r.maxPayloadPerFrag).toBe(576);
    expect(r.fragments.every((f) => (f.mf ? f.size % 8 === 0 : true))).toBe(true);
    expect(r.fragments.every((f) => f.offsetUnits * 8 === f.byteStart)).toBe(true);
  });
});

describe('reassembly', () => {
  it('round-trips to the original payload length (even out of order)', () => {
    const r = fragment(4000, 1500);
    const shuffled = [r.fragments[2], r.fragments[0], r.fragments[1]];
    const re = reassemble(shuffled);
    expect(re.ok).toBe(true);
    expect(re.totalBytes).toBe(4000);
    expect(re.complete).toBe(true); // the last fragment (MF=0) is present
  });
  it('detects a missing middle fragment (a hole) as incomplete', () => {
    const r = fragment(4000, 1500);
    const missingMiddle = [r.fragments[0], r.fragments[2]]; // drop fragment 1
    const re = reassemble(missingMiddle);
    expect(re.ok).toBe(false); // a gap at offset 185
  });
});

describe('Path-MTU Discovery (DF set)', () => {
  it('delivers a packet that fits the link', () => {
    expect(pmtud(1500, 1500).delivered).toBe(true);
  });
  it('drops a too-big DF packet and returns the next-hop MTU', () => {
    const r = pmtud(IP_HEADER + 4000, 1500); // 4020 > 1500
    expect(r.delivered).toBe(false);
    expect(r.icmp?.nextHopMtu).toBe(1500);
    expect(r.icmp?.type).toMatch(/Fragmentation Needed/);
    expect(r.newPacketSize).toBe(1500); // the sender shrinks to the path MTU
  });
});
