import { describe, it, expect } from 'vitest';
import { validate, accept, DEFAULT_ROAS, ANNOUNCEMENTS, type Announcement } from '../src/web/rpki';

// Independent oracle: RFC 6811 origin validation. Given a ROA "192.0.2.0/24 maxLength 24, origin 64500": an
// announcement is Valid iff a covering ROA authorizes its exact origin at a length within maxLength; Invalid iff a ROA
// covers the prefix but nothing validates it (wrong origin, or more specific than maxLength); NotFound iff no ROA
// covers it. A router doing ROV drops only Invalid. Expected labels are worked out by hand from those rules.

const roas = DEFAULT_ROAS();
const ann = (label: string): Announcement => ANNOUNCEMENTS().find((a) => a.label === label)!;

describe('RFC 6811 validity', () => {
  it('the legitimate origin is Valid', () => {
    expect(validate(roas, ann('legit owner')).validity).toBe('Valid');
  });
  it('a same-prefix announcement from the wrong AS is Invalid', () => {
    const v = validate(roas, ann('same-prefix hijack'));
    expect(v.validity).toBe('Invalid');
    expect(v.reason).toMatch(/hijack|different origin/i);
  });
  it('a more-specific sub-prefix beyond maxLength is Invalid', () => {
    const v = validate(roas, ann('sub-prefix hijack'));
    expect(v.validity).toBe('Invalid');
    expect(v.reason).toMatch(/maxLength|more specific|\/24/i);
  });
  it('even a sub-prefix from the RIGHT origin is Invalid when it exceeds maxLength', () => {
    // /25 from the authorized AS 64500 — the ROA only permits up to /24
    expect(validate(roas, { label: 't', prefix: '192.0.2.128/25', origin: 64500 }).validity).toBe('Invalid');
  });
  it('unsigned space is NotFound', () => {
    expect(validate(roas, ann('unsigned prefix')).validity).toBe('NotFound');
  });
});

describe('router policy (ROV)', () => {
  it('drops Invalid only when ROV is enabled', () => {
    expect(accept('Invalid', true)).toBe(false);
    expect(accept('Invalid', false)).toBe(true); // ROV off → the hijack is accepted, as in bgphijack
  });
  it('always keeps Valid and NotFound', () => {
    expect(accept('Valid', true)).toBe(true);
    expect(accept('NotFound', true)).toBe(true); // the coverage gap: unsigned space is not dropped
  });
});
