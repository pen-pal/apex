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

describe('the attacker-controlled scenarios the section produces', () => {
  const from = 'bank.example';
  const A = ['198.51.100.10'];
  const atkKey = rsaKeygen(71n, 59n, 17n); // the attacker's OWN DKIM key / domain
  const good = 'Your monthly statement is ready to view.';
  const tampered = good + ' PS: wire $5000.';
  const bankSig = dkimSign(good, key); // the bank signed the ORIGINAL body

  it('a MITM who tampers in transit relays from its OWN IP → SPF fails AND DKIM fails → rejected', () => {
    const spf = spfCheck('203.0.113.66', from, A);        // attacker's IP, not a bank sender
    const dkim = dkimVerify(tampered, bankSig, key, from); // altered body → the real signature breaks
    expect(spf.pass).toBe(false);
    expect(dkim.pass).toBe(false);
    expect(dmarc(from, spf, dkim, 'reject').action).toBe('reject');
  });

  it('a VALID DKIM signature from the WRONG domain verifies but does not align → rejected', () => {
    const spf = spfCheck('203.0.113.66', from, A);
    const atkSig = dkimSign('Click to verify!', atkKey);
    const dkim = dkimVerify('Click to verify!', atkSig, atkKey, 'attacker.test');
    expect(dkim.pass).toBe(true);          // the signature really is valid...
    const d = dmarc(from, spf, dkim, 'reject');
    expect(d.dkimAligned).toBe(false);     // ...but d=attacker.test ≠ From, so it doesn't align
    expect(d.action).toBe('reject');
  });

  it('SPF authenticates the sender, not the content: a tamper from an AUTHORIZED IP still passes DMARC', () => {
    const spf = spfCheck('198.51.100.10', from, A);       // an authorized IP (compromised relay / list re-send)
    const dkim = dkimVerify(tampered, bankSig, key, from); // DKIM fails — the body was altered
    expect(spf.pass).toBe(true);
    expect(dkim.pass).toBe(false);
    const d = dmarc(from, spf, dkim, 'reject');
    expect(d.spfAligned).toBe(true);
    expect(d.pass).toBe(true);             // SPF alignment alone passes DMARC...
    expect(d.action).toBe('deliver');      // ...so the tampered body is DELIVERED. SPF never hashed it.
  });
});
