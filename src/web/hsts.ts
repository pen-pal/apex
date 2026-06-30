// HSTS — HTTP Strict Transport Security (RFC 6797). The web's defense against SSL stripping: a server
// sends one header, "Strict-Transport-Security: max-age=...; includeSubDomains", and from then on the
// BROWSER itself rewrites every http:// request to that host into https:// BEFORE a single plaintext byte
// leaves the machine — closing the door on a man-in-the-middle who would otherwise downgrade the
// connection and read everything (Moxie Marlinspike's sslstrip, 2009). The catch is trust-on-first-use:
// the very first visit, before the header has ever been seen, is still in the clear. The preload list —
// a roster of HSTS hosts compiled INTO the browser — closes even that gap. We model the browser's HSTS
// store, the upgrade decision, and where a MITM can still strike. Reference: RFC 6797.

export interface HstsEntry { expiry: number; includeSubDomains: boolean }
export type HstsStore = Record<string, HstsEntry>;

export interface StsHeader { maxAge: number; includeSubDomains: boolean; preload: boolean }

/** Parse a Strict-Transport-Security header value. Returns null if max-age is absent (the directive is
 *  then invalid per §6.1.1). Directive names are case-insensitive; max-age must be present exactly once. */
export function parseHeader(value: string): StsHeader | null {
  const parts = value.split(';').map((p) => p.trim()).filter(Boolean);
  let maxAge: number | null = null, includeSubDomains = false, preload = false;
  for (const p of parts) {
    const eq = p.indexOf('=');
    const name = (eq >= 0 ? p.slice(0, eq) : p).trim().toLowerCase();
    const raw = eq >= 0 ? p.slice(eq + 1).trim().replace(/^"|"$/g, '') : '';
    if (name === 'max-age') { const n = Number(raw); if (!Number.isFinite(n) || n < 0 || raw === '') return null; maxAge = Math.floor(n); }
    else if (name === 'includesubdomains') includeSubDomains = true;
    else if (name === 'preload') preload = true;
  }
  if (maxAge === null) return null;
  return { maxAge, includeSubDomains, preload };
}

const parents = (host: string): string[] => {
  const out: string[] = [];
  const labels = host.split('.');
  for (let i = 1; i < labels.length - 1; i++) out.push(labels.slice(i).join('.'));
  return out; // proper superdomains only (exclude the host itself and the bare TLD)
};

/** Is `host` an HSTS host right now — via the preload list, an exact unexpired entry, or a superdomain
 *  entry carrying includeSubDomains? (RFC 6797 §8.2–§8.3.) */
export function isHsts(store: HstsStore, preload: Set<string>, host: string, now: number): boolean {
  if (preload.has(host)) return true;
  const e = store[host];
  if (e && e.expiry > now) return true;
  for (const sup of parents(host)) {
    if (preload.has(sup)) return true;
    const pe = store[sup];
    if (pe && pe.expiry > now && pe.includeSubDomains) return true;
  }
  return false;
}

/** Record a received STS header. Per §8.1, a header received over an INSECURE transport MUST be ignored.
 *  max-age=0 deletes the entry (§6.1.1). Returns a new store. */
export function record(store: HstsStore, host: string, header: StsHeader, secure: boolean, now: number): HstsStore {
  if (!secure) return store; // never trust HSTS asserted over plaintext
  const next = { ...store };
  if (header.maxAge === 0) delete next[host];
  else next[host] = { expiry: now + header.maxAge, includeSubDomains: header.includeSubDomains };
  return next;
}

export interface NavResult { finalScheme: 'http' | 'https'; upgraded: boolean; intercepted: boolean; reason: string }

/** Decide what the browser does with a navigation to host over the requested scheme, with a MITM possibly
 *  on the wire. If the host is an HSTS host, the scheme is upgraded to https before any request — the MITM
 *  is locked out. Otherwise a plaintext http request is exposed to stripping. */
export function navigate(scheme: 'http' | 'https', host: string, store: HstsStore, preload: Set<string>, now: number, mitm: boolean): NavResult {
  const protectedHost = isHsts(store, preload, host, now);
  if (scheme === 'http' && protectedHost)
    return { finalScheme: 'https', upgraded: true, intercepted: false, reason: preload.has(host) ? 'preloaded — upgraded to https in-browser, never touched the wire as http' : 'known HSTS host — upgraded to https before sending' };
  if (scheme === 'https')
    return { finalScheme: 'https', upgraded: false, intercepted: false, reason: 'already https — encrypted end to end' };
  // plaintext http, no HSTS protection yet
  if (mitm)
    return { finalScheme: 'http', upgraded: false, intercepted: true, reason: 'plaintext + no HSTS yet → SSL-stripped: the MITM reads and rewrites everything' };
  return { finalScheme: 'http', upgraded: false, intercepted: false, reason: 'plaintext http — would be vulnerable to a MITM (trust-on-first-use gap)' };
}
