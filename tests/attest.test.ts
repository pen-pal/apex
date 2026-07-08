import { describe, it, expect } from 'vitest';
import { verifyQuote, type Quote } from '../src/web/attest';

// Independent oracle: attestation verification order. Accept iff the quote's signature chains to the vendor root AND
// the measurement equals the expected code AND the nonce equals the challenge — checked in that order (a fake TEE is
// rejected before anything it claims is examined). Expected outcomes follow from those rules.

const EXPECT = 'sha256:abc123';
const NONCE = 'nonce-42';
const good = (): Quote => ({ sigChainsToVendorRoot: true, measurement: EXPECT, nonce: NONCE });

describe('verifyQuote', () => {
  it('accepts a genuine, expected, fresh quote', () => {
    const r = verifyQuote(good(), EXPECT, NONCE);
    expect(r.ok).toBe(true);
    expect(r.reject).toBeNull();
  });
  it('rejects a quote whose signature doesn’t chain to the vendor root (fake TEE)', () => {
    const r = verifyQuote({ ...good(), sigChainsToVendorRoot: false }, EXPECT, NONCE);
    expect(r.reject).toBe('signature');
    expect(r.reason).toMatch(/genuine|emulator|vendor|root/i);
  });
  it('rejects a wrong measurement (modified code)', () => {
    const r = verifyQuote({ ...good(), measurement: 'sha256:tampered' }, EXPECT, NONCE);
    expect(r.reject).toBe('measurement');
    expect(r.reason).toMatch(/measurement|modified|code/i);
  });
  it('rejects a stale nonce (replay)', () => {
    const r = verifyQuote({ ...good(), nonce: 'old-nonce' }, EXPECT, NONCE);
    expect(r.reject).toBe('nonce');
    expect(r.reason).toMatch(/nonce|replay|fresh/i);
  });
  it('checks the signature before the measurement', () => {
    const r = verifyQuote({ sigChainsToVendorRoot: false, measurement: 'sha256:tampered', nonce: 'old' }, EXPECT, NONCE);
    expect(r.reject).toBe('signature');
  });
});
