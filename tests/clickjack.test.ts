import { describe, it, expect } from 'vitest';
import { canFrame, type FramePolicy } from '../src/web/clickjack';

const BANK = 'https://bank.com', EVIL = 'https://evil.com', PARTNER = 'https://partner.com';
const p = (over: Partial<FramePolicy> = {}): FramePolicy => ({ xfo: null, frameAncestors: null, ...over });

describe('an unprotected page is clickjackable', () => {
  it('with no framing header, evil.com can frame the bank and hijack clicks', () => {
    const d = canFrame(BANK, EVIL, p());
    expect(d.allowed).toBe(true);
    expect(d.clickjackable).toBe(true);
  });
});

describe('X-Frame-Options', () => {
  it('DENY blocks everyone', () => {
    expect(canFrame(BANK, EVIL, p({ xfo: 'DENY' })).allowed).toBe(false);
    expect(canFrame(BANK, BANK, p({ xfo: 'DENY' })).allowed).toBe(false);
  });
  it('SAMEORIGIN allows the bank to frame itself but blocks evil.com', () => {
    expect(canFrame(BANK, BANK, p({ xfo: 'SAMEORIGIN' })).allowed).toBe(true);
    const evil = canFrame(BANK, EVIL, p({ xfo: 'SAMEORIGIN' }));
    expect(evil.allowed).toBe(false);
    expect(evil.clickjackable).toBe(false);
  });
});

describe('CSP frame-ancestors', () => {
  it("'none' forbids all framing", () => {
    expect(canFrame(BANK, EVIL, p({ frameAncestors: ["'none'"] })).allowed).toBe(false);
    expect(canFrame(BANK, BANK, p({ frameAncestors: ["'none'"] })).allowed).toBe(false);
  });
  it("'self' allows only same origin", () => {
    expect(canFrame(BANK, BANK, p({ frameAncestors: ["'self'"] })).allowed).toBe(true);
    expect(canFrame(BANK, EVIL, p({ frameAncestors: ["'self'"] })).allowed).toBe(false);
  });
  it('an explicit allowlist permits the partner but not evil.com', () => {
    const pol = p({ frameAncestors: [PARTNER] });
    expect(canFrame(BANK, PARTNER, pol).allowed).toBe(true);
    expect(canFrame(BANK, EVIL, pol).allowed).toBe(false);
  });
});

describe('precedence and same-origin safety', () => {
  it('frame-ancestors overrides X-Frame-Options when both are set', () => {
    // XFO would allow same-origin, but frame-ancestors 'none' wins → blocked
    expect(canFrame(BANK, BANK, { xfo: 'SAMEORIGIN', frameAncestors: ["'none'"] }).allowed).toBe(false);
  });
  it('same-origin framing is allowed but never counts as clickjacking', () => {
    expect(canFrame(BANK, BANK, p()).clickjackable).toBe(false);
  });
});
