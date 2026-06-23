import { describe, it, expect } from 'vitest';
import { sha256, sha256LengthExtend, hex, concatBytes } from '../src/web/sha256';
import { floodGbps, synFlood, REFLECTORS } from '../src/web/attacks';

const enc = (s: string) => new TextEncoder().encode(s);

describe('SHA-256 (FIPS 180-4)', () => {
  it('matches the NIST "abc" and empty vectors', () => {
    expect(hex(sha256(enc('abc')))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(hex(sha256(enc('')))).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
  it('hashes a large multi-block message (NIST one-million-"a" vector)', () => {
    expect(hex(sha256(enc('a'.repeat(1_000_000))))).toBe('cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0');
  });
});

describe('hash length-extension attack (why HMAC exists)', () => {
  it('forges a valid MAC for an extended message WITHOUT the secret', () => {
    const secret = enc('S3cr3tK3y!'); // 10 bytes — the attacker does NOT know this
    const message = enc('user=guest&role=viewer');
    // A naive MAC: H(secret || message). The server publishes this with the message.
    const origMac = sha256(concatBytes(secret, message));

    // The attacker knows only: origMac, message, and guesses secret length (10).
    const extension = enc('&role=admin');
    const origTotalLen = secret.length + message.length;
    const { glue, forgedMac } = sha256LengthExtend(origMac, origTotalLen, extension);

    // The forged message the attacker submits (no secret involved):
    const forgedMessage = concatBytes(message, glue, extension);

    // The server, which DOES know the secret, validates it — and it passes:
    const serverRecomputed = sha256(concatBytes(secret, forgedMessage));
    expect(hex(serverRecomputed)).toBe(hex(forgedMac)); // forgery accepted
    // sanity: the forged message really does contain the attacker's payload
    expect(new TextDecoder().decode(forgedMessage)).toContain('role=admin');
  });
});

describe('reflection / amplification', () => {
  it('computes the victim-facing flood from an uplink and BAF', () => {
    expect(floodGbps(100, 556.9)).toBeCloseTo(55.69, 2); // 100 Mbps via NTP → ~55 Gbps
    expect(floodGbps(10, 51000)).toBe(510); // 10 Mbps via memcached → 510 Gbps
  });
  it('ships sourced, positive factors sorted strongest-first', () => {
    expect(REFLECTORS.every((r) => r.baf > 1 && r.source.length > 0)).toBe(true);
    expect(REFLECTORS[0].baf).toBeGreaterThan(REFLECTORS[REFLECTORS.length - 1].baf);
  });
});

describe('SYN flood half-open table', () => {
  it('saturates the backlog when synRate × hold exceeds it', () => {
    const m = synFlood(128, 1000, 30); // 1000 SYN/s held 30s ≫ 128 slots
    expect(m.saturated).toBe(true);
    expect(m.filledSlots).toBe(128);
  });
  it('does not saturate a large backlog under a light trickle', () => {
    const m = synFlood(1024, 5, 10); // 50 would-hold < 1024
    expect(m.saturated).toBe(false);
    expect(m.filledSlots).toBe(50);
  });
});
