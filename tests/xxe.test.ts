import { describe, it, expect } from 'vitest';
import { parse, billionLaughsSizes, type Config, type Attack } from '../src/web/xxe';

const vuln: Config = { allowDtd: true, allowExternalEntities: true, expansionLimit: 1e12 };
const attacks: Attack[] = ['file', 'ssrf', 'billion-laughs'];

describe('a vulnerable parser falls to every variant', () => {
  it('external entities disclose files and cause SSRF; internal entities cause DoS', () => {
    expect(parse('file', vuln).outcome).toBe('file-read');
    expect(parse('ssrf', vuln).outcome).toBe('ssrf');
    const bl = parse('billion-laughs', vuln);
    expect(bl.outcome).toBe('dos');
    expect(bl.expandedBytes).toBe(3e9); // 3 GB
  });
});

describe('disabling DTD processing stops ALL variants at once', () => {
  it('is the complete fix', () => {
    const cfg: Config = { ...vuln, allowDtd: false };
    for (const a of attacks) {
      const r = parse(a, cfg);
      expect(r.outcome).toBe('blocked');
      expect(r.blockedBy).toMatch(/DTD/i);
    }
  });
});

describe('narrower defenses only cover some variants', () => {
  it('disabling external entities stops file/SSRF but NOT billion-laughs (all-internal)', () => {
    const cfg: Config = { ...vuln, allowExternalEntities: false };
    expect(parse('file', cfg).outcome).toBe('blocked');
    expect(parse('ssrf', cfg).outcome).toBe('blocked');
    expect(parse('billion-laughs', cfg).outcome).toBe('dos'); // still fires!
  });
  it('an entity-expansion limit stops billion-laughs but NOT file/SSRF', () => {
    const cfg: Config = { ...vuln, expansionLimit: 1e6 };
    const bl = parse('billion-laughs', cfg);
    expect(bl.outcome).toBe('blocked');
    expect(bl.blockedBy).toMatch(/expansion/i);
    expect(parse('file', cfg).outcome).toBe('file-read'); // still fires
  });
});

describe('billion-laughs expansion', () => {
  it('multiplies by the fanout each level', () => {
    expect(billionLaughsSizes(9, 10, 3)).toEqual([3, 30, 300, 3000, 30000, 300000, 3000000, 30000000, 300000000, 3000000000]);
    expect(billionLaughsSizes(2, 5, 4)).toEqual([4, 20, 100]);
  });
});
