// HTTP cookies (RFC 6265) — Set-Cookie parsing and the matching rules that decide
// which cookies a browser attaches to a request. The headline truths: cookies are
// scoped by Domain (incl. subdomains) and Path (prefix), a Secure cookie only rides
// HTTPS, HttpOnly hides it from JavaScript (XSS defense), and SameSite controls
// whether it's sent on cross-site requests (CSRF defense). Pure rules, tested.

export type SameSite = 'Strict' | 'Lax' | 'None';
export interface Cookie {
  name: string;
  value: string;
  domain: string; // host scope; a leading '.' / Domain attr allows subdomains
  hostOnly: boolean; // true when no Domain attribute → exact host only
  path: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite: SameSite;
  expires: number | null; // epoch seconds; null = session cookie
}

export interface SetCookieInput {
  header: string; // the raw Set-Cookie value
  requestHost: string; // host that set it (for default domain/path)
  requestPath: string;
  now: number; // current epoch seconds, for resolving Max-Age to an absolute time
}

/** Parse a Set-Cookie header into a Cookie (RFC 6265 §5.2), filling defaults. */
export function parseSetCookie(input: SetCookieInput): Cookie | null {
  const parts = input.header.split(';').map((s) => s.trim());
  const first = parts[0];
  const eq = first.indexOf('=');
  if (eq < 0) return null;
  const name = first.slice(0, eq).trim();
  const value = first.slice(eq + 1).trim();
  if (!name) return null;

  const attrs: Record<string, string> = {};
  for (const a of parts.slice(1)) {
    const i = a.indexOf('=');
    const k = (i < 0 ? a : a.slice(0, i)).trim().toLowerCase();
    attrs[k] = i < 0 ? '' : a.slice(i + 1).trim();
  }

  const domainAttr = attrs['domain'];
  const hostOnly = !domainAttr;
  const domain = (domainAttr ? domainAttr.replace(/^\./, '') : input.requestHost).toLowerCase();
  // default path = the directory of the request path (RFC 6265 §5.1.4)
  const path = attrs['path'] || defaultPath(input.requestPath);

  let expires: number | null = null;
  if ('max-age' in attrs) {
    const ma = parseInt(attrs['max-age'], 10);
    expires = Number.isNaN(ma) ? null : input.now + ma; // Max-Age is relative to now
  } else if (attrs['expires']) {
    const t = Date.parse(attrs['expires']);
    if (!Number.isNaN(t)) expires = Math.floor(t / 1000);
  }

  const ss = (attrs['samesite'] || '').toLowerCase();
  const sameSite: SameSite = ss === 'strict' ? 'Strict' : ss === 'none' ? 'None' : 'Lax'; // Lax is the modern default

  return {
    name, value, domain, hostOnly, path,
    secure: 'secure' in attrs,
    httpOnly: 'httponly' in attrs,
    sameSite,
    expires,
  };
}

/** RFC 6265 §5.1.4 default-path: everything up to the last '/'. */
export function defaultPath(p: string): string {
  if (!p.startsWith('/')) return '/';
  const i = p.lastIndexOf('/');
  return i <= 0 ? '/' : p.slice(0, i);
}

/** Domain-match (RFC 6265 §5.1.3): exact, or cookie domain is a parent of the host. */
export function domainMatch(host: string, cookie: Cookie): boolean {
  host = host.toLowerCase();
  if (host === cookie.domain) return true;
  if (cookie.hostOnly) return false; // host-only cookies never match subdomains
  return host.endsWith('.' + cookie.domain);
}

/** Path-match (RFC 6265 §5.1.4): request path is the cookie path or below it. */
export function pathMatch(reqPath: string, cookiePath: string): boolean {
  if (reqPath === cookiePath) return true;
  if (!reqPath.startsWith(cookiePath)) return false;
  return cookiePath.endsWith('/') || reqPath[cookiePath.length] === '/';
}

export interface Request {
  host: string;
  path: string;
  https: boolean;
  crossSite: boolean; // is this a cross-site request (e.g. a third-party/forged one)?
  topLevelNav: boolean; // a top-level navigation (matters for SameSite=Lax)
  now: number; // current epoch seconds
}

export interface MatchResult {
  cookie: Cookie;
  sent: boolean;
  reason: string;
}

/** Decide, per cookie, whether it is attached to the request and why/why not. */
export function evaluate(jar: Cookie[], req: Request): MatchResult[] {
  return jar.map((c) => {
    if (c.expires !== null && c.expires <= req.now) return { cookie: c, sent: false, reason: 'expired — removed from the jar' };
    if (!domainMatch(req.host, c)) return { cookie: c, sent: false, reason: `domain mismatch (cookie scope ${c.hostOnly ? c.domain + ' only' : '.' + c.domain})` };
    if (!pathMatch(req.path, c.path)) return { cookie: c, sent: false, reason: `path mismatch (cookie path ${c.path})` };
    if (c.secure && !req.https) return { cookie: c, sent: false, reason: 'Secure cookie withheld over plain HTTP' };
    if (req.crossSite) {
      if (c.sameSite === 'Strict') return { cookie: c, sent: false, reason: 'SameSite=Strict blocks all cross-site sends (CSRF defense)' };
      if (c.sameSite === 'Lax' && !req.topLevelNav) return { cookie: c, sent: false, reason: 'SameSite=Lax blocks cross-site subrequests (only top-level GET navigations pass)' };
      if (c.sameSite === 'None' && !c.secure) return { cookie: c, sent: false, reason: 'SameSite=None requires Secure — rejected' };
    }
    return { cookie: c, sent: true, reason: 'all checks pass — attached to the request' };
  });
}
