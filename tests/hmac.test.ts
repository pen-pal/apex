import { describe, it, expect } from 'vitest';
import { hmac, enc, hex } from '../src/web/hmac';
import { hmacSha256 } from '../src/web/hashing';

describe('the published RFC 4231 HMAC-SHA256 test vectors', () => {
  it('Test Case 1: key = 0x0b×20, data = "Hi There"', async () => {
    const r = await hmac(new Uint8Array(20).fill(0x0b), enc('Hi There'));
    expect(hex(r.mac)).toBe('b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7');
  });
  it('Test Case 2: key = "Jefe"', async () => {
    const r = await hmac(enc('Jefe'), enc('what do ya want for nothing?'));
    expect(hex(r.mac)).toBe('5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843');
  });
  it('Test Case 6: a key longer than the block size is hashed first', async () => {
    const r = await hmac(new Uint8Array(131).fill(0xaa), enc('Test Using Larger Than Block-Size Key - Hash Key First'));
    expect(r.keyWasHashed).toBe(true);
    expect(hex(r.mac)).toBe('60e431591ee0b67f0d8a26aacbf5b77f8e0bc6213728c5140546040f0ee37f54');
  });
});

describe('the construction', () => {
  it('agrees with the platform HMAC (WebCrypto)', async () => {
    // WebCrypto refuses zero-length keys, so compare on non-empty keys (an empty message is fine)
    for (const [k, m] of [['secret', 'hello world'], ['a', ''], ['a-long-shared-secret-key', 'payload']] as [string, string][]) {
      const mine = await hmac(enc(k), enc(m));
      const ref = await hmacSha256(enc(k), enc(m));
      expect(hex(mine.mac)).toBe(hex(ref));
    }
  });
  it('builds the ipad/opad key blocks correctly (K ⊕ 0x36 and K ⊕ 0x5c, zero-padded)', async () => {
    const r = await hmac(enc('Jefe'), enc('x'));
    expect(r.blockKey.length).toBe(64);                 // padded to the SHA-256 block size
    expect(r.ipadKey[0]).toBe('J'.charCodeAt(0) ^ 0x36);
    expect(r.opadKey[0]).toBe('J'.charCodeAt(0) ^ 0x5c);
    expect(r.ipadKey[63]).toBe(0x00 ^ 0x36);            // the zero-pad region
    expect(r.mac.length).toBe(32);                      // SHA-256 output
  });
});

describe('MAC properties', () => {
  it('is deterministic and sensitive to both key and message', async () => {
    const a = await hmac(enc('k'), enc('msg'));
    const b = await hmac(enc('k'), enc('msg'));
    const kd = await hmac(enc('k2'), enc('msg'));
    const md = await hmac(enc('k'), enc('msg2'));
    expect(hex(a.mac)).toBe(hex(b.mac));    // deterministic
    expect(hex(a.mac)).not.toBe(hex(kd.mac)); // key change → different tag
    expect(hex(a.mac)).not.toBe(hex(md.mac)); // message change → different tag
  });
});
