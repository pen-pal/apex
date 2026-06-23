// URL anatomy — parse a URI into its RFC 3986 components and explain each one.
// The grammar: scheme://[userinfo@]host[:port][/path][?query][#fragment]. We keep
// the raw substring AND the percent-decoded value of each component, flag a default
// port, and detect an IDN/punycode host. Pure regex+split parsing (the RFC 3986
// Appendix B regex, refined), tested against concrete examples.
import { percentEncode } from './encoding2';

const DEFAULT_PORTS: Record<string, number> = { http: 80, https: 443, ftp: 21, ssh: 22, ws: 80, wss: 443 };

export interface QueryParam { key: string; value: string; rawKey: string; rawValue: string }
export interface UrlParts {
  ok: boolean;
  error?: string;
  scheme: string;
  userinfo: string; // raw, e.g. user:pass
  user: string;
  password: string;
  host: string;
  isPunycode: boolean;
  port: string; // explicit port as written ('' if none)
  effectivePort: number | null; // explicit, or the scheme default
  isDefaultPort: boolean;
  path: string;
  pathDecoded: string;
  query: string; // raw query string without '?'
  params: QueryParam[];
  fragment: string;
  fragmentDecoded: string;
}

/** Percent-decode a component (form-decoding turns '+' into space in query values). */
export function pctDecode(s: string, plusAsSpace = false): string {
  try {
    return decodeURIComponent(plusAsSpace ? s.replace(/\+/g, ' ') : s);
  } catch {
    return s; // malformed % escapes: show as-is rather than throw
  }
}

// RFC 3986 Appendix B regex, with the authority split out further below.
const URL_RE = /^(?:([a-zA-Z][a-zA-Z0-9+.-]*):)?(?:\/\/([^/?#]*))?([^?#]*)(?:\?([^#]*))?(?:#(.*))?$/;

export function parseUrl(input: string): UrlParts {
  const t = input.trim();
  const m = URL_RE.exec(t);
  const empty: UrlParts = {
    ok: false, scheme: '', userinfo: '', user: '', password: '', host: '', isPunycode: false,
    port: '', effectivePort: null, isDefaultPort: false, path: '', pathDecoded: '', query: '',
    params: [], fragment: '', fragmentDecoded: '',
  };
  if (!m) return { ...empty, error: 'Could not parse as a URL.' };

  const scheme = (m[1] ?? '').toLowerCase();
  const authority = m[2] ?? '';
  const path = m[3] ?? '';
  const query = m[4] ?? '';
  const fragment = m[5] ?? '';
  if (!scheme && !authority) return { ...empty, error: 'No scheme or host — enter something like https://example.com/path.' };

  // authority = [userinfo@]host[:port]
  let userinfo = '', hostport = authority;
  const at = authority.lastIndexOf('@');
  if (at >= 0) { userinfo = authority.slice(0, at); hostport = authority.slice(at + 1); }
  // split host:port (avoid colons inside an IPv6 literal [::1])
  let host = hostport, port = '';
  if (hostport.startsWith('[')) {
    const close = hostport.indexOf(']');
    host = hostport.slice(0, close + 1);
    if (hostport[close + 1] === ':') port = hostport.slice(close + 2);
  } else {
    const c = hostport.lastIndexOf(':');
    if (c >= 0) { host = hostport.slice(0, c); port = hostport.slice(c + 1); }
  }
  const [user, password] = userinfo.includes(':') ? [userinfo.slice(0, userinfo.indexOf(':')), userinfo.slice(userinfo.indexOf(':') + 1)] : [userinfo, ''];

  const explicitPort = port !== '' ? Number(port) : null;
  const defaultPort = DEFAULT_PORTS[scheme] ?? null;
  const effectivePort = explicitPort ?? defaultPort;
  const isDefaultPort = explicitPort !== null && defaultPort !== null && explicitPort === defaultPort;

  const params: QueryParam[] = query
    ? query.split('&').filter(Boolean).map((kv) => {
        const eq = kv.indexOf('=');
        const rawKey = eq >= 0 ? kv.slice(0, eq) : kv;
        const rawValue = eq >= 0 ? kv.slice(eq + 1) : '';
        return { rawKey, rawValue, key: pctDecode(rawKey, true), value: pctDecode(rawValue, true) };
      })
    : [];

  return {
    ok: true, scheme, userinfo, user: pctDecode(user), password: pctDecode(password), host,
    isPunycode: /(^|\.)xn--/i.test(host),
    port, effectivePort, isDefaultPort,
    path, pathDecoded: pctDecode(path), query, params,
    fragment, fragmentDecoded: pctDecode(fragment),
  };
}

/** Round-trip helper used by the UI: re-encode a decoded value for display contrast. */
export const reEncode = (s: string): string => percentEncode(s);
