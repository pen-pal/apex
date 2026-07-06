import { describe, it, expect } from 'vitest';
import { classify, evaluate, inetAton } from '../src/web/ssrf';

describe('host classification (literal forms)', () => {
  it('the cloud metadata endpoint is its own category', () => {
    expect(classify('http://169.254.169.254/latest/meta-data/iam/security-credentials/').category).toBe('metadata');
  });
  it('loopback in its many forms', () => {
    expect(classify('http://localhost:6379').category).toBe('loopback');
    expect(classify('http://127.0.0.1/admin').category).toBe('loopback');
    expect(classify('http://[::1]:8080').category).toBe('loopback');
  });
  it('the RFC 1918 private ranges', () => {
    expect(classify('http://10.0.0.5').category).toBe('private');
    expect(classify('http://172.16.4.4').category).toBe('private');
    expect(classify('http://172.32.0.1').category).toBe('public'); // .32 is outside 16–31
    expect(classify('http://192.168.1.1').category).toBe('private');
  });
  it('an ordinary public host', () => {
    expect(classify('https://api.example.com/v1/things').category).toBe('public');
  });
});

describe('inet_aton decodes the obfuscated forms attackers use', () => {
  // Independent oracle: these encodings equal 127.0.0.1 / 169.254.169.254 by hand-computed arithmetic
  // (2130706433 = 0x7F000001; 2852039166 = 0xA9FEA9FE; octal 0177 = 127), not by anything the code says.
  it('decimal, hex, octal, and short forms of 127.0.0.1 are loopback', () => {
    for (const h of ['2130706433', '0x7f000001', '0177.0.0.1', '127.1', '0x7f.1', '017700000001'])
      expect(classify('http://' + h + '/').category).toBe('loopback');
  });
  it('the metadata endpoint encoded as decimal/hex is still metadata', () => {
    expect(classify('http://2852039166/').category).toBe('metadata');
    expect(classify('http://0xa9fea9fe/').category).toBe('metadata');
    expect(classify('http://0251.0376.0251.0376/').category).toBe('metadata'); // octal octets
  });
  it('inetAton yields the true octets, and rejects non-IPv4', () => {
    expect(inetAton('2130706433')).toEqual([127, 0, 0, 1]);
    expect(inetAton('0xA9FEA9FE')).toEqual([169, 254, 169, 254]);
    expect(inetAton('127.1')).toEqual([127, 0, 0, 1]);
    expect(inetAton('example.com')).toBeNull();
    expect(inetAton('256.0.0.1')).toBeNull(); // octet out of range
  });
  it('legit public IPs are unaffected', () => {
    expect(classify('http://93.184.216.34/').category).toBe('public');
  });
});

describe('the naive denylist is bypassed; resolve+check catches it', () => {
  it('a naive string denylist blocks the literal internal IP', () => {
    const r = evaluate('http://169.254.169.254/', 'naive');
    expect(r.blocked).toBe(true);
    expect(r.bypassed).toBe(false);
  });
  it('but the SAME address in decimal sails past the naive denylist — the bypass reaches metadata', () => {
    const r = evaluate('http://2852039166/latest/meta-data/', 'naive');
    expect(r.blocked).toBe(false);
    expect(r.bypassed).toBe(true);
    expect(r.reached).toBe(true);
    expect(r.category).toBe('metadata');
  });
  it('resolve + check catches the encoded bypass', () => {
    const r = evaluate('http://2852039166/', 'resolve');
    expect(r.blocked).toBe(true);
    expect(r.reached).toBe(false);
  });
  it('without any filter, the literal metadata request reaches credential theft', () => {
    const r = evaluate('http://169.254.169.254/latest/meta-data/', 'off');
    expect(r.fetched).toBe(true);
    expect(r.reached).toBe(true);
    expect(r.danger).toMatch(/IAM credentials/);
  });
  it('public requests are allowed under every mode (the feature still works)', () => {
    for (const m of ['off', 'naive', 'resolve'] as const)
      expect(evaluate('https://example.com/logo.png', m).fetched).toBe(true);
  });
});
