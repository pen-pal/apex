import { describe, it, expect } from 'vitest';
import { hkdfExtract, hkdfExpand, hmacSha256, hkdfExpandLabel, tls13KeySchedule, toHex } from '../src/web/hkdf';

const hb = (s: string) => new Uint8Array(s.match(/../g)?.map((h) => parseInt(h, 16)) ?? []);

describe('HMAC-SHA256 (RFC 4231 case 1)', () => {
  it('matches the published vector', () => {
    const mac = hmacSha256(new Uint8Array(20).fill(0x0b), new TextEncoder().encode('Hi There'));
    expect(toHex(mac)).toBe('b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7');
  });
});

describe('HKDF-SHA256 (RFC 5869 Test Case 1)', () => {
  const ikm = hb('0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b'); // 22 bytes
  const salt = hb('000102030405060708090a0b0c');
  const info = hb('f0f1f2f3f4f5f6f7f8f9');

  it('Extract → the published PRK', () => {
    expect(toHex(hkdfExtract(salt, ikm))).toBe('077709362c2e32df0ddc3f0dc47bba6390b6c73bb50f9c3122ec844ad7c2b3e5');
  });
  it('Expand → the published 42-byte OKM', () => {
    const prk = hkdfExtract(salt, ikm);
    expect(toHex(hkdfExpand(prk, info, 42))).toBe(
      '3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf34007208d5b887185865',
    );
  });
});

describe('HKDF-SHA256 (RFC 5869 Test Case 3, zero-length salt/info)', () => {
  it('Expand → the published OKM with empty salt and info', () => {
    const ikm = hb('0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b');
    const prk = hkdfExtract(new Uint8Array(0), ikm);
    expect(toHex(prk)).toBe('19ef24a32c717b167f33a91d6f648bdf96596776afdb6377ac434c1c293ccb04');
    expect(toHex(hkdfExpand(prk, new Uint8Array(0), 42))).toBe(
      '8da4e775a563c18f715f802a063c5a31b8a11f5c5ee1879ec3454e5f3c738d2d9d201395faa4b61a96c8',
    );
  });
});

describe('TLS 1.3 HKDF-Expand-Label (RFC 8446 §7.1)', () => {
  it('produces the requested output length deterministically', () => {
    const secret = new Uint8Array(32).fill(0x01);
    const key = hkdfExpandLabel(secret, 'key', new Uint8Array(0), 16);
    expect(key).toHaveLength(16);
    expect(toHex(key)).toBe(toHex(hkdfExpandLabel(secret, 'key', new Uint8Array(0), 16))); // deterministic
    // a different label gives unrelated output
    expect(toHex(key)).not.toBe(toHex(hkdfExpandLabel(secret, 'iv', new Uint8Array(0), 16)));
  });
});

describe('TLS 1.3 key schedule (RFC 8446 §7.1)', () => {
  const nodes = tls13KeySchedule(new Uint8Array(32).fill(0x07));

  it('derives the canonical chain of secrets in order', () => {
    expect(nodes.map((n) => n.id)).toEqual([
      'ikm0', 'early', 'derived-hs', 'ecdhe', 'handshake', 'c-hs', 's-hs',
      'derived-ms', 'master', 'c-ap', 's-ap', 'c-key', 'c-iv',
    ]);
  });
  it('parents are consistent (every from-id exists earlier)', () => {
    const seen = new Set<string>();
    for (const n of nodes) {
      for (const p of n.from) expect(seen.has(p)).toBe(true);
      seen.add(n.id);
    }
  });
  it('the handshake secret mixes in the (EC)DHE secret (forward secrecy)', () => {
    const hs = nodes.find((n) => n.id === 'handshake')!;
    expect(hs.from).toContain('ecdhe');
    expect(hs.value).toHaveLength(32);
  });
  it('derives a 16-byte AES key and a 12-byte IV', () => {
    expect(nodes.find((n) => n.id === 'c-key')!.value).toHaveLength(16);
    expect(nodes.find((n) => n.id === 'c-iv')!.value).toHaveLength(12);
  });
  it('changing the (EC)DHE secret changes everything downstream of Handshake', () => {
    const a = tls13KeySchedule(new Uint8Array(32).fill(0x07));
    const b = tls13KeySchedule(new Uint8Array(32).fill(0x08));
    const get = (ns: typeof a, id: string) => toHex(ns.find((n) => n.id === id)!.value);
    expect(get(a, 'early')).toBe(get(b, 'early')); // upstream of ECDHE is identical
    expect(get(a, 'handshake')).not.toBe(get(b, 'handshake')); // ECDHE mixed in → differs
    expect(get(a, 'c-key')).not.toBe(get(b, 'c-key'));
  });
});
