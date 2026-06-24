import { describe, it, expect } from 'vitest';
import { poly1305, verify } from '../src/web/poly1305';

const hex = (s: string) => Uint8Array.from(s.replace(/\s/g, '').match(/../g)!.map((b) => parseInt(b, 16)));
const toHex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');

describe('Poly1305 — RFC 8439 §2.5.2', () => {
  const key = hex('85d6be7857556d337f4452fe42d506a80103808afb0db2fd4abff6af4149f51b');
  const msg = new TextEncoder().encode('Cryptographic Forum Research Group');

  it('produces the published tag', () => {
    expect(toHex(poly1305(msg, key).tag)).toBe('a8061dc1305136c6c22b8baf0c0127a9');
  });

  it('clamps r and steps once per 16-byte block', () => {
    const r = poly1305(msg, key);
    expect(r.steps.length).toBe(Math.ceil(msg.length / 16)); // 34 bytes → 3 blocks
    expect(r.r & ~0x0ffffffc0ffffffc0ffffffc0fffffffn).toBe(0n); // clamped bits are clear
  });

  it('verify accepts the real tag and rejects a tampered message', () => {
    const tag = poly1305(msg, key).tag;
    expect(verify(msg, key, tag)).toBe(true);
    const bad = new TextEncoder().encode('Cryptographic Forum Research Grouq'); // last byte changed
    expect(verify(bad, key, tag)).toBe(false);
  });
});

describe('one-time key', () => {
  it('different keys give different tags for the same message', () => {
    const m = new TextEncoder().encode('reuse is fatal');
    const k1 = hex('85d6be7857556d337f4452fe42d506a80103808afb0db2fd4abff6af4149f51b');
    const k2 = k1.slice(); k2[20] ^= 0x01;
    expect(toHex(poly1305(m, k1).tag)).not.toBe(toHex(poly1305(m, k2).tag));
  });
});
