import { describe, it, expect } from 'vitest';
import { sriHash, verifyIntegrity } from '../src/web/sri';

// SHA-256("abc") = ba7816bf… (NIST FIPS 180-4 example). SRI base64-encodes that 32-byte digest.
const ABC_SHA256_HEX = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
function hexToBase64(hex: string): string {
  const bytes = hex.match(/../g)!.map((h) => parseInt(h, 16));
  let bin = ''; for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

describe('SRI hash format', () => {
  it('matches the NIST SHA-256("abc") digest, base64-encoded', () => {
    expect(sriHash('abc')).toBe('sha256-' + hexToBase64(ABC_SHA256_HEX));
  });
  it('produces the documented sha256- prefix and 44-char base64 (32 bytes)', () => {
    const h = sriHash('console.log(1)');
    expect(h.startsWith('sha256-')).toBe(true);
    expect(h.slice('sha256-'.length)).toHaveLength(44); // 32 bytes → 44 base64 chars incl. padding
  });
});

describe('the integrity check (browser SRI)', () => {
  const legit = 'window.pay=(amt)=>api.charge(amt)';
  const integrity = sriHash(legit); // the page pins the hash of the known-good file

  it('runs the resource when the served bytes match the pinned hash', () => {
    const r = verifyIntegrity(legit, integrity);
    expect(r.ok).toBe(true);
    expect(r.runs).toBe(true);
  });

  it('BLOCKS a tampered file — even a one-character change fails the hash', () => {
    const tampered = 'window.pay=(amt)=>api.charge(amt);steal()'; // CDN compromised
    const r = verifyIntegrity(tampered, integrity);
    expect(r.ok).toBe(false);
    expect(r.runs).toBe(false);
    expect(r.computed).not.toBe(r.expected);
  });

  it('a single flipped byte avalanches the whole digest', () => {
    expect(sriHash('alert(1)')).not.toBe(sriHash('alert(2)')); // unrelated digests
  });
});
