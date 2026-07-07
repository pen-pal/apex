import { describe, it, expect } from 'vitest';
import { forge, type SameSite, type Defenses } from '../src/web/csrf';

// Independent oracle: CSRF + SameSite cookie semantics. A cross-site POST carries the session cookie only with
// SameSite=None (Strict and Lax both withhold it on cross-site POSTs); a CSRF token blocks the request even when the
// cookie is sent. So the forged transfer succeeds iff SameSite=None AND no token. Asserted against the web spec.

const d = (s: SameSite, t: boolean): Defenses => ({ sameSite: s, csrfToken: t });

describe('CSRF & its defenses', () => {
  it('SameSite=None, no token → the forged transfer succeeds', () => {
    const v = forge(d('none', false));
    expect(v.cookieSent).toBe(true);
    expect(v.accepted).toBe(true);
  });
  it('SameSite=Lax withholds the cookie on a cross-site POST → blocked', () => {
    const v = forge(d('lax', false));
    expect(v.cookieSent).toBe(false);
    expect(v.accepted).toBe(false);
  });
  it('SameSite=Strict → blocked', () => {
    expect(forge(d('strict', false)).accepted).toBe(false);
  });
  it('a CSRF token blocks it even when the cookie is sent', () => {
    const v = forge(d('none', true));
    expect(v.cookieSent).toBe(true);
    expect(v.accepted).toBe(false);
    expect(v.reason).toMatch(/token/i);
  });
  it('the attack succeeds in exactly one of the six defense combinations (None + no token)', () => {
    let succ = 0;
    for (const s of ['strict', 'lax', 'none'] as SameSite[]) for (const t of [false, true]) {
      if (forge(d(s, t)).accepted) succ++;
    }
    expect(succ).toBe(1);
  });
});
