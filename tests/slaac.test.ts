import { describe, it, expect } from 'vitest';
import { parse, compress, eui64, withPrefix, linkLocal, solicitedNode, classify } from '../src/web/slaac';

describe('Modified EUI-64 interface identifier (RFC 4291 Appendix A)', () => {
  it('inserts FF:FE and flips the U/L bit', () => {
    const e = eui64('00:1a:2b:3c:4d:5e');
    expect(e.flippedFirstByte).toBe(0x02); // 0x00 ^ 0x02
    expect(e.bytes).toEqual([0x02, 0x1a, 0x2b, 0xff, 0xfe, 0x3c, 0x4d, 0x5e]);
    expect(compress(linkLocal(e.iid))).toBe('fe80::21a:2bff:fe3c:4d5e');
  });

  it('flips the U/L bit of a locally-administered MAC', () => {
    const e = eui64('52:54:00:12:34:56'); // 0x52 ^ 0x02 = 0x50
    expect(e.iid).toEqual([0x5054, 0x00ff, 0xfe12, 0x3456]);
  });
});

describe('SLAAC addresses', () => {
  const iid = eui64('00:1a:2b:3c:4d:5e').iid;
  it('forms a global address by prepending an advertised /64 prefix', () => {
    const g = withPrefix(parse('2001:db8::'), iid);
    expect(compress(g)).toBe('2001:db8::21a:2bff:fe3c:4d5e');
  });
  it('derives the solicited-node multicast address from the low 24 bits', () => {
    const g = withPrefix(parse('2001:db8::'), iid);
    expect(compress(solicitedNode(g))).toBe('ff02::1:ff3c:4d5e');
  });
});

describe('RFC 5952 canonical text', () => {
  it('collapses the longest zero run and strips leading zeros', () => {
    expect(compress(parse('2001:0db8:0000:0000:0000:0000:0000:0001'))).toBe('2001:db8::1');
    expect(compress(parse('0:0:0:0:0:0:0:1'))).toBe('::1');
    expect(compress(parse('::'))).toBe('::');
  });
  it('on a tie, compresses the FIRST (leftmost) run', () => {
    // two runs of length 2 → leftmost wins (RFC 5952 §4.2.3)
    expect(compress([0x2001, 0xdb8, 0, 0, 1, 0, 0, 1])).toBe('2001:db8::1:0:0:1');
  });
  it('parse round-trips a "::" address to 8 hextets', () => {
    expect(parse('2001:db8::1')).toEqual([0x2001, 0xdb8, 0, 0, 0, 0, 0, 1]);
    expect(parse('fe80::21a:2bff:fe3c:4d5e')).toEqual([0xfe80, 0, 0, 0, 0x21a, 0x2bff, 0xfe3c, 0x4d5e]);
  });
});

describe('address classification by leading bits (RFC 4291)', () => {
  const t = (a: string) => classify(parse(a)).type;
  it('classifies each architectural prefix', () => {
    expect(t('::')).toBe('Unspecified');
    expect(t('::1')).toBe('Loopback');
    expect(t('fe80::1')).toBe('Link-local unicast');
    expect(t('fc00::1')).toBe('Unique local (ULA)');
    expect(t('fd12:3456::1')).toBe('Unique local (ULA)');
    expect(t('2001:db8::1')).toBe('Global unicast');
    expect(t('2606:4700::1')).toBe('Global unicast');
    expect(t('ff02::1')).toBe('Multicast');
  });
  it('reports multicast scope and the documentation note', () => {
    expect(classify(parse('ff02::1')).scope).toBe('link-local');
    expect(classify(parse('ff0e::1')).scope).toBe('global');
    expect(classify(parse('2001:db8::1')).note).toMatch(/documentation/);
  });
});
