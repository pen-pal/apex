import { describe, it, expect } from 'vitest';
import { spfCheck, dkimSign, dkimVerify, dmarc } from '../src/web/mailauth';
import { rsaKeygen } from '../src/web/rsa';

const key = rsaKeygen(61n, 53n, 17n); // toy DKIM key for bank.example
const ALLOWED = ['198.51.100.10', '198.51.100.11'];

describe('SPF', () => {
  it('passes only for an allowed sending IP', () => {
    expect(spfCheck('198.51.100.10', 'bank.example', ALLOWED).pass).toBe(true);
    expect(spfCheck('203.0.113.66', 'bank.example', ALLOWED).pass).toBe(false);
  });
});

describe('DKIM (real RSA over the body hash)', () => {
  it('a valid signature verifies; tampering the body breaks it', () => {
    const body = 'Your statement is ready.';
    const sig = dkimSign(body, key);
    expect(dkimVerify(body, sig, key, 'bank.example').pass).toBe(true);
    expect(dkimVerify(body + ' Send money to evil!', sig, key, 'bank.example').pass).toBe(false);
  });
});

describe('DMARC alignment and policy', () => {
  const from = 'bank.example';
  const spfPass = spfCheck('198.51.100.10', from, ALLOWED);
  const spfFail = spfCheck('203.0.113.66', from, ALLOWED);
  const body = 'hello';
  const sig = dkimSign(body, key);
  const dkimPass = dkimVerify(body, sig, key, from);
  const dkimFail = dkimVerify(body + 'x', sig, key, from);

  it('passes when SPF authenticates and aligns with From', () => {
    const d = dmarc(from, spfPass, dkimFail, 'reject');
    expect(d.spfAligned).toBe(true);
    expect(d.pass).toBe(true);
    expect(d.action).toBe('deliver');
  });

  it('passes on DKIM alignment even when SPF fails (e.g. forwarded mail)', () => {
    const d = dmarc(from, spfFail, dkimPass, 'reject');
    expect(d.dkimAligned).toBe(true);
    expect(d.pass).toBe(true);
  });

  it('SPF passing for a DIFFERENT domain does not align (the spoofing case)', () => {
    // attacker's own domain passes SPF, but the visible From is bank.example
    const attackerSpf = spfCheck('203.0.113.66', 'attacker.test', ['203.0.113.66']);
    const d = dmarc(from, attackerSpf, dkimFail, 'reject');
    expect(d.spfAligned).toBe(false);
    expect(d.pass).toBe(false);
    expect(d.action).toBe('reject'); // p=reject bounces the spoof
  });

  it('applies p=quarantine and p=none on failure', () => {
    expect(dmarc(from, spfFail, dkimFail, 'quarantine').action).toBe('quarantine');
    expect(dmarc(from, spfFail, dkimFail, 'none').action).toBe('deliver'); // monitor only
  });
});
