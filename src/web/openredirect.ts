// Open redirect — the deceptively hard problem of validating a "where to go next" URL. Apps take a
// ?next=/dashboard parameter and redirect there after login; if an attacker can make it point OFF-site,
// they get a link that starts on your trusted domain but lands on theirs — gold for phishing, and a way to
// steal OAuth tokens when redirect_uri is sloppily checked. The trap is that browsers parse URLs far more
// liberally than a naive check expects: backslashes become slashes, an @ hides the real host, a leading
// // is scheme-relative, and tabs/newlines are stripped mid-string. We model the browser's effective-host
// resolution and the same-origin/allowlist decision. References: OWASP "Unvalidated Redirects and
// Forwards"; the WHATWG URL parsing rules browsers follow.

export type Kind = 'same-origin' | 'allowlisted' | 'external' | 'invalid';
export interface Verdict { input: string; effectiveHost: string | null; kind: Kind; safe: boolean; reason: string; trick?: string }

/** Resolve the host a browser would actually navigate to for `target` from a page on `originHost`,
 *  mimicking the liberal normalization real browsers apply (backslash→slash, strip tab/newline/leading
 *  control chars, scheme-relative //, userinfo @). Returns null for a same-origin path. */
function effectiveHost(target: string): { host: string | null; offsite: boolean; trick?: string } {
  // Browsers strip leading C0 controls/space, and remove ASCII tab/newline ANYWHERE in the URL.
  let s = target.replace(/^[\x00-\x20]+/, '').replace(/[\t\n\r]/g, '');
  const hadBackslash = /\\/.test(s);
  s = s.replace(/\\/g, '/'); // browsers treat backslashes as forward slashes in the scheme/authority

  let authority: string | null = null;
  let trick: string | undefined;
  const scheme = s.match(/^([a-zA-Z][a-zA-Z0-9+.\-]*):\/\//);
  if (scheme) {
    authority = s.slice(scheme[0].length);
  } else if (s.startsWith('//')) {
    authority = s.slice(2); // scheme-relative → goes off-origin
    trick = hadBackslash ? 'backslash → scheme-relative //' : 'scheme-relative //';
  } else {
    // a path (/foo) or a bare relative ref → stays same-origin
    if (hadBackslash && /^\/+/.test(target.replace(/^[\x00-\x20]+/, ''))) trick = 'backslash path';
    return { host: null, offsite: false, trick };
  }

  // authority ends at the first / ? or #
  const auth = authority.split(/[/?#]/)[0];
  // userinfo before an @ is NOT the host — the real host is after the LAST @
  let hostPart = auth;
  if (auth.includes('@')) { hostPart = auth.slice(auth.lastIndexOf('@') + 1); trick = trick ?? 'userinfo @ before real host'; }
  const host = hostPart.split(':')[0].toLowerCase(); // strip port
  if (!host) return { host: null, offsite: false, trick }; // e.g. "https:///path" → same-origin-ish
  return { host, offsite: true, trick };
}

/** Classify a redirect target relative to `originHost`, given an allowlist of acceptable external hosts. */
export function classify(target: string, originHost: string, allowlist: string[] = []): Verdict {
  if (target.trim() === '') return { input: target, effectiveHost: null, kind: 'invalid', safe: false, reason: 'empty target' };
  const { host, offsite, trick } = effectiveHost(target);
  const origin = originHost.toLowerCase();
  const allow = new Set(allowlist.map((h) => h.toLowerCase()));

  if (!offsite || host === null) {
    return { input: target, effectiveHost: null, kind: 'same-origin', safe: true, reason: 'resolves to a path on the current origin', trick };
  }
  if (host === origin) {
    return { input: target, effectiveHost: host, kind: 'same-origin', safe: true, reason: 'absolute URL but same host as the origin', trick };
  }
  if (allow.has(host)) {
    return { input: target, effectiveHost: host, kind: 'allowlisted', safe: true, reason: `host is on the redirect allowlist`, trick };
  }
  return {
    input: target, effectiveHost: host, kind: 'external', safe: false,
    reason: trick ? `escapes the origin via ${trick} → ${host}` : `redirects off-site to ${host}`,
    trick,
  };
}
