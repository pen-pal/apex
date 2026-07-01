// Subdomain takeover — how a forgotten DNS record hands an attacker a real page on YOUR domain. You point
// blog.example.com at a cloud service with a CNAME (→ example.github.io, myapp.herokuapp.com, an S3 bucket…).
// Later you delete the GitHub Pages repo / tear down the Heroku app / empty the bucket — but you FORGET to
// remove the DNS record. Now blog.example.com is a "dangling" CNAME pointing at an unclaimed name on a shared
// provider. If that provider lets ANYONE register the name (create a repo/app/bucket with it), an attacker
// does exactly that and now serves their content — phishing, cookie theft, a valid TLS cert for your
// subdomain — from blog.example.com. The whole class exists because the DNS record outlives the resource it
// pointed to. The fix is lifecycle hygiene (delete DNS with the resource) and providers that require domain
// verification before serving a custom hostname. References: Detectify "Hostile Subdomain Takeover"; the
// can-i-take-over-xyz catalog.

export type Status = 'safe' | 'dangling' | 'takeover';
export interface DnsRecord { subdomain: string; target: string; live: boolean } // live = the backing resource still exists & is yours

// A CNAME target is a takeover vector if it's on a shared provider that lets anyone claim an unused hostname.
const PROVIDERS: { match: string; name: string; reclaimable: boolean }[] = [
  { match: 'github.io', name: 'GitHub Pages', reclaimable: true },
  { match: 'herokuapp.com', name: 'Heroku', reclaimable: true },
  { match: 's3.amazonaws.com', name: 'AWS S3', reclaimable: true },
  { match: 's3-website', name: 'AWS S3', reclaimable: true },
  { match: 'azurewebsites.net', name: 'Azure App Service', reclaimable: true },
  { match: 'cloudapp.net', name: 'Azure Cloud', reclaimable: true },
  { match: 'fastly.net', name: 'Fastly', reclaimable: true },
  { match: 'ghost.io', name: 'Ghost', reclaimable: true },
  // providers that require domain verification before serving a hostname → NOT reclaimable by a stranger
  { match: 'myshopify.com', name: 'Shopify (verified)', reclaimable: false },
  { match: 'cloudfront.net', name: 'CloudFront (verified)', reclaimable: false },
];

/** Which shared provider a CNAME target belongs to, if any. */
export function providerOf(target: string): { name: string; reclaimable: boolean } | null {
  const t = target.toLowerCase();
  const p = PROVIDERS.find((x) => t.includes(x.match));
  return p ? { name: p.name, reclaimable: p.reclaimable } : null;
}

export interface Verdict { subdomain: string; provider: string | null; status: Status; reason: string }

/** Classify a DNS record for takeover risk. */
export function classify(r: DnsRecord): Verdict {
  const prov = providerOf(r.target);
  if (r.live) return { subdomain: r.subdomain, provider: prov?.name ?? null, status: 'safe', reason: prov ? `points to a live ${prov.name} resource you control` : 'points to a live resource' };
  if (!prov) return { subdomain: r.subdomain, provider: null, status: 'dangling', reason: 'the target is gone, but it is not a known claim-anyone provider — no takeover vector, just a broken link' };
  if (prov.reclaimable) return { subdomain: r.subdomain, provider: prov.name, status: 'takeover', reason: `dangling CNAME to ${prov.name}, where anyone can register the unused name → attacker serves content on ${r.subdomain}` };
  return { subdomain: r.subdomain, provider: prov.name, status: 'dangling', reason: `${prov.name} requires domain verification before serving a hostname — dangling but not claimable by a stranger` };
}
