// The DNS resolution journey — how a name becomes an address (RFC 1034 §4.3).
// A stub resolver asks its recursive resolver one question; the resolver then
// walks the delegation hierarchy iteratively: root → TLD → authoritative, each
// server REFERRING it one label closer until an authoritative answer comes back.
// Caching short-circuits this — that's what TTL controls. Pure, tested model.

export type RecordType = 'A' | 'AAAA' | 'NS' | 'CNAME';
export type ServerRole = 'stub' | 'recursive' | 'root' | 'tld' | 'authoritative';

export interface DnsRecord { name: string; type: RecordType; value: string; ttl: number }

export interface DnsHop {
  kind: 'query' | 'referral' | 'answer';
  from: ServerRole;
  to: ServerRole;
  qname: string;
  qtype: RecordType;
  // For a referral: the NS records handing off to the next tier. For an answer: the result.
  records: DnsRecord[];
  note: string;
  cached?: boolean; // this step was served from the resolver cache (no network hop)
}

export interface DnsJourney {
  qname: string;
  qtype: RecordType;
  hops: DnsHop[];
  answer: DnsRecord | null;
}

const ROOT_NS: DnsRecord = { name: '.', type: 'NS', value: 'a.root-servers.net', ttl: 518400 };

/**
 * Resolve `qname` for `qtype` through the full hierarchy. If `cacheHasAnswer`,
 * the recursive resolver already holds the answer and returns it immediately
 * (one hop) — the everyday case once a name is warm.
 */
export function resolve(qname: string, qtype: RecordType = 'A', cacheHasAnswer = false): DnsJourney {
  const labels = qname.replace(/\.$/, '').split('.');
  const tld = labels[labels.length - 1];
  const sld = labels.slice(-2).join('.'); // e.g. example.com
  const tldNs = `a.gtld-servers.net`;
  const authNs = `ns1.${sld}`;
  const finalValue = qtype === 'AAAA' ? '2606:2800:220:1:248:1893:25c8:1946' : '93.184.216.34';
  const answer: DnsRecord = { name: qname, type: qtype, value: finalValue, ttl: 3600 };

  const hops: DnsHop[] = [];

  // 1. stub → recursive (always; this is the only question the client itself asks)
  hops.push({
    kind: 'query', from: 'stub', to: 'recursive', qname, qtype, records: [],
    note: `Your device’s stub resolver asks its configured recursive resolver for ${qname} ${qtype}. This is the only DNS query your machine makes — the resolver does the legwork.`,
  });

  if (cacheHasAnswer) {
    hops.push({
      kind: 'answer', from: 'recursive', to: 'stub', qname, qtype, records: [answer], cached: true,
      note: `The resolver already had ${qname} in cache (still within its ${answer.ttl}s TTL), so it answers immediately — no walk needed. This is why the second lookup of a site is instant.`,
    });
    return { qname, qtype, hops, answer };
  }

  // 2. recursive → root (referral to the TLD servers)
  hops.push({
    kind: 'referral', from: 'recursive', to: 'root', qname, qtype,
    records: [{ name: `${tld}.`, type: 'NS', value: tldNs, ttl: 172800 }, ROOT_NS],
    note: `The resolver starts at a root server (it knows the 13 root IPs from a built-in hints file). The root doesn’t know ${qname}, but it knows who runs “.${tld}” and refers the resolver there.`,
  });

  // 3. recursive → TLD (referral to the authoritative servers)
  hops.push({
    kind: 'referral', from: 'recursive', to: 'tld', qname, qtype,
    records: [{ name: sld, type: 'NS', value: authNs, ttl: 172800 }],
    note: `The .${tld} servers don’t hold the address either, but they know which name servers are authoritative for ${sld}, and refer the resolver one step closer.`,
  });

  // 4. recursive → authoritative (the real answer)
  hops.push({
    kind: 'answer', from: 'authoritative', to: 'recursive', qname, qtype, records: [answer],
    note: `The authoritative server for ${sld} holds the actual record and returns ${qname} ${qtype} = ${finalValue}. The resolver caches it for ${answer.ttl}s.`,
  });

  // 5. recursive → stub (deliver the cached answer back to the client)
  hops.push({
    kind: 'answer', from: 'recursive', to: 'stub', qname, qtype, records: [answer],
    note: `The resolver hands the answer back to your stub resolver and remembers it, so the next lookup within ${answer.ttl}s skips the entire walk above.`,
  });

  return { qname, qtype, hops, answer };
}
