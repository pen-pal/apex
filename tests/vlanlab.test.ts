import { describe, it, expect } from 'vitest';
import { TPID, tci, buildTag, parseTag, stripOuter, type Tag } from '../src/web/vlanlab';

const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');

describe('802.1Q tag bytes (builder direction)', () => {
  it('TPID is 0x8100', () => {
    expect(TPID).toBe(0x8100);
    expect(hex(buildTag({ pcp: 0, dei: 0, vid: 1 })).slice(0, 4)).toBe('8100');
  });

  it('packs PCP / DEI / VID into the TCI', () => {
    expect(tci({ pcp: 3, dei: 0, vid: 100 })).toBe(0x6064); // (3<<13) | 100
    expect(hex(buildTag({ pcp: 3, dei: 0, vid: 100 }))).toBe('81006064');
  });

  it('the DEI bit lands in bit 12', () => {
    expect(tci({ pcp: 0, dei: 1, vid: 0 })).toBe(0x1000);
  });

  it('round-trips through parseTag', () => {
    const t: Tag = { pcp: 5, dei: 1, vid: 4094 };
    expect(parseTag(buildTag(t))).toEqual({ tpid: 0x8100, ...t });
  });

  it('matches the dissector vector PCP=5, VID=100 → TCI 0xA064', () => {
    expect(tci({ pcp: 5, dei: 0, vid: 100 })).toBe(0xa064);
  });
});

describe('double-tagging VLAN hop', () => {
  it('the native-VLAN switch strips the outer tag, exposing the inner victim VLAN', () => {
    const frame: Tag[] = [
      { pcp: 0, dei: 0, vid: 1 }, // outer = native VLAN 1 (the attacker is on it)
      { pcp: 0, dei: 0, vid: 20 }, // inner = victim VLAN 20
    ];
    const onTrunk = stripOuter(frame);
    expect(onTrunk).toHaveLength(1);
    expect(onTrunk[0].vid).toBe(20); // inner tag survives → delivered to VLAN 20
  });
});
