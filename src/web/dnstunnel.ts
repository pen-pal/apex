// DNS tunneling — a covert channel that smuggles data out of (and commands into) a locked-down network by hiding it
// in DNS. A firewall may block almost all outbound traffic, but it lets DNS through — everything needs name lookups.
// So malware hex-encodes its data across the SUBDOMAIN LABELS of queries to a domain the attacker controls; the
// attacker's authoritative server receives every query (recursive DNS delivers it) and decodes the labels back into
// data. Replies (TXT/CNAME records) carry commands the other way. It's slow and noisy — but it gets through.

const HEX = (s: string) => [...s].map((c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');
const UNHEX = (h: string) => (h.match(/.{2}/g) ?? []).map((b) => String.fromCharCode(parseInt(b, 16))).join('');

// Encode data into a series of DNS query names: <hex-chunk>.<tunnel-domain>. Labels are chunked to stay well under
// the 63-char DNS label limit.
export function encodeToQueries(data: string, domain: string, labelLen = 24): string[] {
  const hex = HEX(data);
  const chunks = hex.match(new RegExp(`.{1,${labelLen}}`, 'g')) ?? [];
  return chunks.map((c) => `${c}.${domain}`);
}

// The attacker's server strips the tunnel domain and decodes the concatenated labels back to the original data.
export function decodeFromQueries(queries: string[], domain: string): string {
  const suffix = '.' + domain;
  const hex = queries.map((q) => (q.endsWith(suffix) ? q.slice(0, -suffix.length) : q)).join('');
  return UNHEX(hex);
}

// A crude detectability signal: normal DNS labels are short dictionary-ish words; tunnel labels are long random hex.
// A real IDS combines label length, character entropy, and query volume to one domain.
export function avgLabelLen(queries: string[], domain: string): number {
  const suffix = '.' + domain;
  const labels = queries.map((q) => (q.endsWith(suffix) ? q.slice(0, -suffix.length) : q));
  return labels.length ? labels.reduce((a, l) => a + l.length, 0) / labels.length : 0;
}
