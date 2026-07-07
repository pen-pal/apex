// Cross-Site Request Forgery (CSRF). You're logged into bank.com (you hold its session cookie). You visit evil.com,
// whose page silently makes your browser POST to bank.com — "transfer $5000". The browser attaches cookies by
// DESTINATION, not by who initiated the request, so bank.com's cookie rides along and the bank sees an authenticated
// request it can't distinguish from a real one. The fixes: SameSite cookies (don't send the cookie on cross-site
// requests) and a CSRF token (a per-session secret the attacker can't read, thanks to the same-origin policy).

export type SameSite = 'strict' | 'lax' | 'none';
export type Defenses = { sameSite: SameSite; csrfToken: boolean };
export type Verdict = { cookieSent: boolean; accepted: boolean; reason: string };

// An attacker page triggers a cross-site state-changing POST to the bank. What happens?
export function forge(d: Defenses): Verdict {
  // Strict and Lax both withhold the session cookie on a cross-site POST (Lax only allows it on top-level GET
  // navigations); only SameSite=None sends it cross-site.
  const cookieSent = d.sameSite === 'none';
  if (!cookieSent) {
    return { cookieSent, accepted: false, reason: `SameSite=${d.sameSite}: the browser withholds the session cookie on a cross-site POST, so the bank sees an unauthenticated request and rejects it.` };
  }
  if (d.csrfToken) {
    return { cookieSent, accepted: false, reason: 'The cookie rode along, but the bank requires a CSRF token — a secret in the page the attacker cannot read (the same-origin policy blocks it). The forged request has no valid token, so it is rejected.' };
  }
  return { cookieSent, accepted: true, reason: 'The cookie rode along and no token was required — the bank sees a fully authenticated request and executes the transfer. That is CSRF.' };
}
