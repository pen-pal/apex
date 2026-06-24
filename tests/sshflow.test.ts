import { describe, it, expect } from 'vitest';
import { handshake, firstEncrypted, verifyHost } from '../src/web/ssh';

const steps = handshake();

describe('SSH transport handshake', () => {
  it('runs setup → kex → auth → channel in order', () => {
    expect(steps.map((s) => s.msg)).toEqual([
      'TCP connect :22', 'version exchange', 'KEXINIT', 'KEX (ECDH) + host-key signature',
      'NEWKEYS', 'SERVICE_REQUEST ssh-userauth', 'USERAUTH (publickey / password)', 'CHANNEL_OPEN (session) + shell/exec',
    ]);
  });

  it('encryption turns on right after NEWKEYS — auth and channels are encrypted', () => {
    expect(firstEncrypted(steps)).toBe(5); // index of SERVICE_REQUEST (step 6)
    expect(steps.slice(0, 5).every((s) => s.enc === 'plaintext')).toBe(true); // kex is in the clear
    expect(steps.slice(5).every((s) => s.enc === 'encrypted')).toBe(true); // userauth onward is sealed
  });

  it('the password/auth never travels before encryption is on', () => {
    const auth = steps.find((s) => s.msg.startsWith('USERAUTH'))!;
    expect(auth.enc).toBe('encrypted');
  });
});

describe('host-key verification (known_hosts)', () => {
  it('first connection is trust-on-first-use', () => {
    expect(verifyHost(null, 'SHA256:abcd')).toBe('tofu');
  });
  it('a matching fingerprint is trusted', () => {
    expect(verifyHost('SHA256:abcd', 'SHA256:abcd')).toBe('trusted');
  });
  it('a changed fingerprint is flagged as a possible MITM', () => {
    expect(verifyHost('SHA256:abcd', 'SHA256:evil')).toBe('changed');
  });
});
