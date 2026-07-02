import { describe, it, expect } from 'vitest';
import { buildChain, verify, tamper, blockHash, GENESIS_PREV } from '../src/web/hashchain';

const DATA = ['alice→bob 5', 'bob→carol 2', 'carol→dave 1', 'dave→alice 3'];

describe('chain construction', () => {
  const chain = buildChain(DATA);
  it('genesis links to the all-zero hash; each block links to the previous hash', () => {
    expect(chain[0].prevHash).toBe(GENESIS_PREV);
    for (let i = 1; i < chain.length; i++) expect(chain[i].prevHash).toBe(chain[i - 1].hash);
  });
  it('a block hash is the real SHA-256 of index|data|prevHash (vs an independently-computed digest)', () => {
    // Reference computed offline with a separate SHA-256 (Node crypto): sha256("0|genesis|<64 zeros>"). If the
    // app's SHA-256 or the preimage layout were wrong, this fails — re-calling blockHash would not catch it.
    expect(blockHash(0, 'genesis', '0'.repeat(64)))
      .toBe('7aa8ce85a549ed6cfd94b03bcff2020f22ca8af0a4d91cf132fe9c240ae550d9');
    expect(chain[0].hash).toMatch(/^[0-9a-f]{64}$/);
  });
  it('an intact chain verifies', () => {
    const v = verify(chain);
    expect(v.valid).toBe(true);
    expect(v.firstBroken).toBe(null);
  });
});

describe('tamper-evidence', () => {
  it('changing a block breaks it and every block after it', () => {
    const chain = buildChain(DATA);
    const forged = tamper(chain, 1, 'bob→carol 2000'); // attacker rewrites block 1's amount
    const v = verify(forged);
    expect(v.valid).toBe(false);
    expect(v.firstBroken).toBe(1);                          // detected AT the tampered block
    expect(v.checks[0].valid).toBe(true);                  // block before it still fine
    expect(v.checks.slice(1).every((c) => !c.valid)).toBe(true); // block 1 and ALL after cascade-fail
  });

  it('tampering the genesis block cascades through the whole chain', () => {
    const chain = buildChain(DATA);
    const forged = tamper(chain, 0, 'alice→bob 9999');
    const v = verify(forged);
    expect(v.firstBroken).toBe(0);
    expect(v.checks.every((c) => !c.valid)).toBe(true); // every block broken
  });

  it('the tip hash certifies the whole history (any change moves the tip)', () => {
    const a = buildChain(DATA);
    const b = buildChain([...DATA.slice(0, 2), 'carol→dave 1 (changed)', DATA[3]]);
    expect(a[a.length - 1].hash).not.toBe(b[b.length - 1].hash);
  });
});
