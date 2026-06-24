// Content-Security-Policy (W3C CSP). Even if an attacker injects markup, CSP can stop it
// from running by telling the browser which sources are allowed for each resource type.
// A policy is a set of directives (script-src, style-src, img-src, …, default-src as the
// fallback); each lists allowed sources: 'self', a host allowlist, 'unsafe-inline',
// 'unsafe-eval', a 'nonce-…', or 'none'. The browser blocks anything not permitted — so
// inline <script> is refused unless you explicitly allow it, which is why CSP is the
// defense-in-depth layer behind output-escaping for XSS. Pure policy engine, tested.

export type Policy = Map<string, string[]>;

/** Parse a policy header like "default-src 'self'; script-src 'self' cdn.example.com". */
export function parsePolicy(text: string): Policy {
  const p: Policy = new Map();
  for (const part of text.split(';')) {
    const toks = part.trim().split(/\s+/).filter(Boolean);
    if (toks.length) p.set(toks[0].toLowerCase(), toks.slice(1));
  }
  return p;
}

export type ResType = 'script' | 'style' | 'img' | 'connect' | 'font';
export interface Load { type: ResType; kind: 'inline' | 'eval' | 'url'; url?: string; nonce?: string }

const DIRECTIVE: Record<ResType, string> = {
  script: 'script-src', style: 'style-src', img: 'img-src', connect: 'connect-src', font: 'font-src',
};

const host = (url: string) => url.replace(/^\w+:\/\//, '').split('/')[0].toLowerCase();

/** Does an allowlist source token match this URL (given the page's own host for 'self')? */
function hostMatches(source: string, url: string, pageHost: string): boolean {
  if (source === '*') return true;
  if (source === "'self'") return host(url) === pageHost;
  if (/^https?:$/.test(source)) return url.startsWith(source); // scheme-source
  const s = source.replace(/^\w+:\/\//, '').replace(/\/.*$/, '').toLowerCase();
  const h = host(url);
  if (s.startsWith('*.')) return h === s.slice(2) || h.endsWith('.' + s.slice(2)); // *.example.com
  return h === s;
}

export interface Decision { directive: string; allowed: boolean; reason: string }

export function evaluate(policy: Policy, load: Load, pageHost: string): Decision {
  const want = DIRECTIVE[load.type];
  const used = policy.has(want) ? want : policy.has('default-src') ? 'default-src' : null;
  if (!used) return { directive: '(none)', allowed: true, reason: `no ${want} or default-src — nothing restricts ${load.type}` };

  const sources = policy.get(used)!;
  if (sources.includes("'none'")) return { directive: used, allowed: false, reason: `${used} 'none' blocks all ${load.type}` };

  if (load.kind === 'inline') {
    if (load.nonce && sources.includes(`'nonce-${load.nonce}'`)) return { directive: used, allowed: true, reason: `inline allowed by matching nonce-${load.nonce}` };
    if (sources.includes("'unsafe-inline'")) return { directive: used, allowed: true, reason: `${used} permits 'unsafe-inline'` };
    return { directive: used, allowed: false, reason: `inline ${load.type} blocked — no 'unsafe-inline' or matching nonce` };
  }
  if (load.kind === 'eval') {
    const ok = sources.includes("'unsafe-eval'");
    return { directive: used, allowed: ok, reason: ok ? `${used} permits 'unsafe-eval'` : `eval() blocked — no 'unsafe-eval'` };
  }
  // url load
  const ok = sources.some((s) => hostMatches(s, load.url!, pageHost));
  return { directive: used, allowed: ok, reason: ok ? `${host(load.url!)} is on the ${used} allowlist` : `${host(load.url!)} not allowed by ${used}` };
}
