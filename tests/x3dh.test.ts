import { describe, it, expect } from 'vitest';
import { keypair, aliceDerive, bobDerive } from '../src/web/x3dh';
import { modpow } from '../src/web/dh';

// A small teaching prime-field DH group (a Mersenne prime); real X3DH uses Curve25519.
const p = 2147483647n; // 2^31 − 1
const g = 7n;
const kp = (priv: bigint) => keypair(priv, p, g);

const ikA = kp(123456n), ekA = kp(777n);
const ikB = kp(999n), spkB = kp(424242n), opkB = kp(55555n);

describe('X3DH key agreement', () => {
  const alice = aliceDerive(p, ikA, ekA, ikB.pub, spkB.pub, opkB.pub);
  const bob = bobDerive(p, ikB, spkB, opkB, ikA.pub, ekA.pub);

  it('both parties derive the IDENTICAL shared secret (Bob never had to be online)', () => {
    expect(alice.sk).toBe(bob.sk);
    expect(alice.sk).toHaveLength(32);
  });

  it('every one of the four DH legs matches between the two sides', () => {
    expect(alice.dh).toEqual(bob.dh); // DH symmetry: g^(x·y) computed both ways
    expect(alice.dh).toHaveLength(4);
  });

  it('each DH leg is a real, non-trivial group element', () => {
    expect(alice.dh[0]).toBe(modpow(spkB.pub, ikA.priv, p)); // DH1 = SPK_B ^ ik_a, recomputed independently
    for (const d of alice.dh) { expect(d).toBeGreaterThan(1n); expect(d).toBeLessThan(p); }
    expect(new Set(alice.dh.map(String)).size).toBe(4); // four distinct DH outputs
  });

  it('a different ephemeral yields a completely different session key (forward secrecy)', () => {
    const ekA2 = kp(888n);
    const alice2 = aliceDerive(p, ikA, ekA2, ikB.pub, spkB.pub, opkB.pub);
    expect(alice2.sk).not.toBe(alice.sk); // compromising one session's EK doesn't expose another
  });

  it('a wrong identity key breaks agreement (authentication)', () => {
    const evil = kp(13n);
    const bobWrong = bobDerive(p, ikB, spkB, opkB, evil.pub, ekA.pub); // attacker's IK_A
    expect(bobWrong.sk).not.toBe(alice.sk);
  });
});
