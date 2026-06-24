// The Same-Origin Policy and CORS (WHATWG Fetch standard). A browser lets a page read a
// response only from its OWN origin — scheme + host + port, all three — unless the other
// server opts in with Cross-Origin Resource Sharing headers. "Simple" requests go
// straight out and the browser hides the response unless Access-Control-Allow-Origin
// matches; anything else (PUT/DELETE, custom headers, JSON bodies) triggers a PREFLIGHT
// OPTIONS that asks permission first. Credentials (cookies) add a stricter rule: the
// allow-origin must be a specific origin, never "*". Pure decision logic, tested.

export interface Origin { scheme: string; host: string; port: number }
const DEFAULT_PORT: Record<string, number> = { http: 80, https: 443 };

export function parseOrigin(url: string): Origin {
  const m = url.match(/^(\w+):\/\/([^/:]+)(?::(\d+))?/);
  if (!m) throw new Error(`bad url: ${url}`);
  const scheme = m[1].toLowerCase();
  return { scheme, host: m[2].toLowerCase(), port: m[3] ? +m[3] : DEFAULT_PORT[scheme] ?? 0 };
}

export const originStr = (o: Origin) =>
  `${o.scheme}://${o.host}${o.port === (DEFAULT_PORT[o.scheme] ?? -1) ? '' : ':' + o.port}`;

/** Same origin iff scheme, host AND port all match (default ports normalised). */
export function sameOrigin(a: Origin, b: Origin): boolean {
  return a.scheme === b.scheme && a.host === b.host && a.port === b.port;
}

export interface Request { method: string; customHeaders: string[]; contentType: string; credentials: boolean }
export interface ServerCORS { allowOrigin: string; allowMethods: string[]; allowHeaders: string[]; allowCredentials: boolean }

const SIMPLE_METHODS = ['GET', 'HEAD', 'POST'];
const SIMPLE_CONTENT = ['application/x-www-form-urlencoded', 'multipart/form-data', 'text/plain', ''];

/** A "simple" request skips preflight: safe method, no custom headers, simple body type. */
export function isSimple(req: Request): boolean {
  return SIMPLE_METHODS.includes(req.method.toUpperCase())
    && req.customHeaders.length === 0
    && SIMPLE_CONTENT.includes(req.contentType.toLowerCase());
}

export interface Check { ok: boolean; reason: string }
export interface Decision {
  sameOrigin: boolean;
  needsPreflight: boolean;
  preflight?: Check;
  actual: Check;
  readable: boolean;
}

function originAllowed(server: ServerCORS, page: Origin, credentials: boolean): Check {
  const wildcard = server.allowOrigin === '*';
  if (credentials && wildcard)
    return { ok: false, reason: 'with credentials, Access-Control-Allow-Origin must be a specific origin, not "*"' };
  if (credentials && !server.allowCredentials)
    return { ok: false, reason: 'credentialed request but Access-Control-Allow-Credentials is not true' };
  if (wildcard) return { ok: true, reason: 'Access-Control-Allow-Origin: * accepts any origin' };
  const ok = server.allowOrigin.toLowerCase() === originStr(page).toLowerCase();
  return { ok, reason: ok ? `Allow-Origin echoes ${originStr(page)}` : `Allow-Origin is ${server.allowOrigin}, not ${originStr(page)}` };
}

export function evaluate(pageUrl: string, targetUrl: string, req: Request, server: ServerCORS): Decision {
  const page = parseOrigin(pageUrl), target = parseOrigin(targetUrl);
  if (sameOrigin(page, target))
    return { sameOrigin: true, needsPreflight: false, actual: { ok: true, reason: 'same origin — the policy does not apply' }, readable: true };

  const simple = isSimple(req);
  let preflight: Check | undefined;
  if (!simple) {
    const methodOk = server.allowMethods.includes('*') || server.allowMethods.map((m) => m.toUpperCase()).includes(req.method.toUpperCase());
    const lowerAllowed = server.allowHeaders.map((h) => h.toLowerCase());
    const missing = req.customHeaders.filter((h) => !lowerAllowed.includes('*') && !lowerAllowed.includes(h.toLowerCase()));
    const originCheck = originAllowed(server, page, req.credentials);
    if (!originCheck.ok) preflight = originCheck;
    else if (!methodOk) preflight = { ok: false, reason: `method ${req.method} not in Access-Control-Allow-Methods` };
    else if (missing.length) preflight = { ok: false, reason: `header(s) ${missing.join(', ')} not in Access-Control-Allow-Headers` };
    else preflight = { ok: true, reason: 'OPTIONS preflight approved method, headers, and origin' };
  }

  if (preflight && !preflight.ok)
    return { sameOrigin: false, needsPreflight: true, preflight, actual: { ok: false, reason: 'blocked before the real request was sent' }, readable: false };

  const actual = originAllowed(server, page, req.credentials);
  return { sameOrigin: false, needsPreflight: !simple, preflight, actual, readable: actual.ok };
}
