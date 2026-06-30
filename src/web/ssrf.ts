// SSRF (Server-Side Request Forgery) — when an app fetches a URL the user controls, and the attacker
// points it INWARD. Your server sits inside a trusted network with no firewall between it and internal
// services, so "fetch this image URL for me" becomes "fetch http://169.254.169.254/…" — the cloud
// metadata endpoint that hands back the instance's IAM credentials (the heart of the 2019 Capital One
// breach), or http://localhost:6379 to talk to an unauthenticated internal Redis. The naive defense —
// blocking "localhost" and private IPs by string — is bypassed by DNS rebinding, redirects, IPv6, and
// odd encodings, so robust protection resolves the host, validates the RESOLVED ip against a denylist,
// and re-checks after every redirect (or just uses an allowlist + a metadata-proxy). Reference: OWASP
// SSRF; the AWS IMDS / Capital One incident.

export type Category = 'public' | 'loopback' | 'private' | 'metadata' | 'link-local';
export interface SsrfResult { host: string; category: Category; internal: boolean; blocked: boolean; fetched: boolean; danger: string }

const octets = (h: string): number[] | null => {
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return null;
  const o = m.slice(1).map(Number);
  return o.every((x) => x <= 255) ? o : null;
};

/** Classify the URL's host into a network category (where in the world it actually points). */
export function classify(url: string): { host: string; category: Category } {
  let host = '';
  try { host = new URL(url).hostname.toLowerCase().replace(/^\[|\]$/g, ''); }
  catch { host = (url.split('/')[2] ?? url).split(':')[0].toLowerCase(); }

  if (host === '169.254.169.254') return { host, category: 'metadata' }; // the cloud IMDS endpoint
  if (host === 'localhost' || host === '::1' || host.startsWith('127.')) return { host, category: 'loopback' };
  if (host.startsWith('169.254.')) return { host, category: 'link-local' };
  const o = octets(host);
  if (o) {
    if (o[0] === 10) return { host, category: 'private' };
    if (o[0] === 172 && o[1] >= 16 && o[1] <= 31) return { host, category: 'private' };
    if (o[0] === 192 && o[1] === 168) return { host, category: 'private' };
  }
  return { host, category: 'public' };
}

const DANGER: Record<Category, string> = {
  metadata: 'reads cloud IAM credentials from the instance metadata service — full account takeover',
  loopback: 'reaches services bound to localhost that trust anyone who can connect (Redis, admin panels, debug ports)',
  private: 'reaches internal hosts behind the firewall — databases, dashboards, other services',
  'link-local': 'reaches link-local addresses, including metadata on some clouds',
  public: 'an ordinary external request — the intended use',
};

/** Decide whether the request is allowed. `protection` enforces an internal-IP denylist. */
export function evaluate(url: string, protection: boolean): SsrfResult {
  const { host, category } = classify(url);
  const internal = category !== 'public';
  const blocked = protection && internal;
  return { host, category, internal, blocked, fetched: !blocked, danger: DANGER[category] };
}
