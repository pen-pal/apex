import { describe, it, expect } from 'vitest';
import { ICMP_TYPES, byCategory, findType } from '../src/web/icmp';
import { metaById } from '../src/web/sections';

describe('ICMP type/code table (RFC 792)', () => {
  it('Echo Request is type 8 and a query (ping)', () => {
    const echo = findType(8)!;
    expect(echo.name).toBe('Echo Request');
    expect(echo.category).toBe('query');
  });
  it('Echo Reply is type 0', () => {
    expect(findType(0)!.name).toBe('Echo Reply');
  });
  it('Destination Unreachable (type 3) includes code 4 “fragmentation needed”', () => {
    const du = findType(3)!;
    expect(du.category).toBe('error');
    expect(du.codes.find((c) => c.code === 4)!.meaning).toMatch(/Fragmentation needed/);
  });
  it('Time Exceeded (type 11) is an error with TTL (0) and reassembly (1) codes', () => {
    const te = findType(11)!;
    expect(te.category).toBe('error');
    expect(te.codes.map((c) => c.code)).toEqual([0, 1]);
  });
  it('splits the table into queries and errors', () => {
    expect(byCategory('query').map((t) => t.type).sort((a, b) => a - b)).toEqual([0, 8]);
    expect(byCategory('error').length).toBeGreaterThan(byCategory('query').length);
  });
});

describe('cross-links resolve to real sections', () => {
  it('every seenIn id is a section that exists', () => {
    for (const t of ICMP_TYPES) {
      if (t.seenIn) expect(metaById[t.seenIn], `${t.name} → ${t.seenIn}`).toBeDefined();
    }
  });
  it('Time Exceeded links to traceroute, Frag-Needed to the fragment section', () => {
    expect(findType(11)!.seenIn).toBe('traceroute');
    expect(findType(3)!.seenIn).toBe('fragment');
  });
});
