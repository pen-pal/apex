import { describe, it, expect } from 'vitest';
import { certOutcome, logInclusion } from '../src/web/ct';
import { verifyProof, leafHash } from '../src/web/merkle';

// Independent oracle: the Certificate Transparency security property (RFC 6962). Without CT a forged cert works
// silently. With CT enforced, a cert with no SCT (not logged) is rejected; a logged cert is accepted but public, so
// a monitor detects it. The key invariant: under enforcement, a browser only accepts a cert that is discoverable.

describe('certOutcome — the rogue-cert dilemma', () => {
  it('no CT: the forged cert works and no one finds out', () => {
    expect(certOutcome(false, false, false)).toEqual({ browserAccepts: true, detected: false, verdict: 'silent-compromise' });
    // logging/monitoring are irrelevant when CT isn't enforced
    expect(certOutcome(false, true, true).verdict).toBe('silent-compromise');
  });
  it('CT enforced, not logged: no SCT, so the browser rejects it', () => {
    expect(certOutcome(true, false, true)).toEqual({ browserAccepts: false, detected: false, verdict: 'rejected' });
  });
  it('CT enforced, logged, monitored: accepted but caught in the public log', () => {
    expect(certOutcome(true, true, true)).toEqual({ browserAccepts: true, detected: true, verdict: 'caught' });
  });
  it('CT enforced, logged, unmonitored: accepted, uncaught — but discoverable by anyone who looks', () => {
    expect(certOutcome(true, true, false)).toEqual({ browserAccepts: true, detected: false, verdict: 'accepted-unwatched' });
  });

  it('invariant: with CT enforced AND monitored, any accepted cert is detected (no working-and-secret cert)', () => {
    for (const logged of [false, true]) {
      const o = certOutcome(true, logged, true);
      if (o.browserAccepts) expect(o.detected).toBe(true);
    }
  });
});

describe('logInclusion — a logged cert has a verifying Merkle inclusion proof', () => {
  const CERTS = ['leaf:good.com', 'leaf:example.org', 'leaf:rogue:your-bank.com', 'leaf:cdn.net', 'leaf:api.io'];

  it('the rogue cert’s inclusion proof folds up to the log root', () => {
    const rogue = 2;
    const { proof, verifies } = logInclusion(CERTS, rogue);
    expect(verifies).toBe(true);
    expect(proof.length).toBe(Math.ceil(Math.log2(CERTS.length))); // log2(n) sibling hashes
  });

  it('the same proof does NOT verify a different cert (you can’t fake membership)', () => {
    const { root, proof } = logInclusion(CERTS, 2);
    // the same proof against a leaf that isn't at index 2 must fail — you can't fake membership
    expect(verifyProof(leafHash('leaf:not-in-log.com'), proof, root)).toBe(false);
  });
});
