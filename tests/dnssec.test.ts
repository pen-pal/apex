import { describe, it, expect } from 'vitest';
import { demoZones, validateChain, digestKey, signRRset, verifyRRset, type Leaf } from '../src/web/dnssec';

const leaf: Leaf = { owner: 'www.example.com', type: 'A', value: '93.184.216.34' };
const zones = demoZones();

describe('RRSIG signing (real RSA: sign with d, verify with e)', () => {
  it('a valid signature verifies and a tampered RRset does not', () => {
    const key = zones[2].key;
    const sig = signRRset('www.example.com A 93.184.216.34', key);
    expect(verifyRRset('www.example.com A 93.184.216.34', sig, key)).toBe(true);
    // change one character → SHA-256 avalanche → hash mismatch → verify fails
    expect(verifyRRset('www.example.com A 93.184.216.35', sig, key)).toBe(false);
  });

  it('a DS digest is a 32-byte SHA-256 of the child DNSKEY', () => {
    expect(digestKey(zones[1].key)).toMatch(/^[0-9a-f]{64}$/);
    expect(digestKey(zones[1].key)).not.toBe(digestKey(zones[2].key)); // different keys, different DS
  });
});

describe('chain of trust validation', () => {
  it('an intact chain from the root anchor to the leaf is SECURE', () => {
    const v = validateChain(zones, leaf);
    expect(v.secure).toBe(true);
    expect(v.brokeAt).toBe(-1);
    expect(v.steps[0].kind).toBe('anchor');
    expect(v.steps.every((s) => s.ok)).toBe(true);
  });

  it('breaking a DS digest fails the delegation at that zone (bogus)', () => {
    const v = validateChain(zones, leaf, { dsAtZone: 1 }); // tamper com's DS
    expect(v.secure).toBe(false);
    const broke = v.steps[v.brokeAt];
    expect(broke.kind).toBe('ds');
    expect(broke.detail).toMatch(/does not match/);
  });

  it('breaking a parent RRSIG over the DS fails validation', () => {
    const v = validateChain(zones, leaf, { sigAtZone: 2 });
    expect(v.secure).toBe(false);
    expect(v.steps[v.brokeAt].kind).toBe('ds');
  });

  it('forging the leaf record (bad RRSIG) is detected at the answer', () => {
    const v = validateChain(zones, leaf, { leafSig: true });
    expect(v.secure).toBe(false);
    expect(v.steps[v.brokeAt].kind).toBe('leaf');
    expect(v.steps[v.brokeAt].detail).toMatch(/RRSIG does not verify/);
  });
});
