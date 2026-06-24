import { describe, it, expect } from 'vitest';
import { IPV4_FIELDS, IPV6_FIELDS, headerBytes, byChange } from '../src/web/ipcompare';

describe('header sizes', () => {
  it('IPv4 base header is 20 bytes', () => {
    expect(headerBytes(IPV4_FIELDS)).toBe(20); // options are 0 bits here
  });
  it('IPv6 header is a fixed 40 bytes', () => {
    expect(headerBytes(IPV6_FIELDS)).toBe(40);
  });
});

describe('IPv4 → IPv6 change classification', () => {
  it('removes IHL, the checksum, fragmentation fields, and in-header options', () => {
    expect(byChange(IPV4_FIELDS, 'removed').sort()).toEqual(
      ['Flags', 'Fragment Offset', 'Header Checksum', 'IHL', 'Identification', 'Options'].sort(),
    );
  });
  it('keeps only the Version field unchanged', () => {
    expect(byChange(IPV4_FIELDS, 'kept')).toEqual(['Version']);
  });
  it('never marks an IPv4 field as “added” (added fields live in IPv6 only)', () => {
    expect(byChange(IPV4_FIELDS, 'added')).toEqual([]);
  });
  it('the only NEW IPv6 field is the Flow Label', () => {
    expect(byChange(IPV6_FIELDS, 'added')).toEqual(['Flow Label']);
  });
});

describe('renamed fields map to a counterpart', () => {
  it('every renamed IPv4 field names its IPv6 counterpart', () => {
    for (const f of IPV4_FIELDS) {
      if (f.change === 'renamed') expect(f.maps, f.name).toBeTruthy();
    }
    // spot-check the famous renames
    expect(IPV4_FIELDS.find((f) => f.name === 'TTL')!.maps).toBe('Hop Limit');
    expect(IPV4_FIELDS.find((f) => f.name === 'Protocol')!.maps).toBe('Next Header');
  });
  it('addresses widen from 32 to 128 bits', () => {
    expect(IPV4_FIELDS.find((f) => f.name === 'Source Address')!.bits).toBe(32);
    expect(IPV6_FIELDS.find((f) => f.name === 'Source Address')!.bits).toBe(128);
  });
});
