// RPKI Route Origin Validation — the defense the BGP-hijack section calls for. RPKI is a PKI rooted at the RIRs in
// which a prefix holder publishes a signed Route Origin Authorization (ROA): "prefix P may be originated by AS N, for
// announcements no more specific than /L". A router doing Route Origin Validation (RFC 6811) checks each BGP
// announcement's (prefix, origin AS) against the ROAs it has and labels it Valid, Invalid, or NotFound, then applies a
// policy — the common one drops Invalid and keeps Valid and NotFound. This models that classification exactly; the
// signing/PKI is real RPKI but out of scope (we assume the ROAs are already validated).

export interface Roa { prefix: string; maxLength: number; origin: number }
export interface Announcement { label: string; prefix: string; origin: number }
export type Validity = 'Valid' | 'Invalid' | 'NotFound';

const parse = (cidr: string): { net: number; len: number } => {
  const [ip, lenStr] = cidr.split('/');
  const len = parseInt(lenStr, 10);
  const addr = ip.split('.').reduce((a, o) => ((a * 256 + (parseInt(o, 10) & 0xff)) >>> 0), 0) >>> 0;
  const mask = len === 0 ? 0 : (0xffffffff << (32 - len)) >>> 0;
  return { net: (addr & mask) >>> 0, len };
};

// Does the ROA's prefix cover (equal or less specific than) the announced prefix?  (Prefix containment only — RFC 6811
// uses this to decide NotFound; maxLength and origin are checked separately.)
function covers(roaCidr: string, annCidr: string): boolean {
  const r = parse(roaCidr), a = parse(annCidr);
  if (a.len < r.len) return false;                       // announcement is less specific → not covered
  const mask = r.len === 0 ? 0 : (0xffffffff << (32 - r.len)) >>> 0;
  return ((a.net & mask) >>> 0) === r.net;
}

// RFC 6811 origin validation.
export function validate(roas: Roa[], ann: Announcement): { validity: Validity; reason: string } {
  const covering = roas.filter((r) => covers(r.prefix, ann.prefix));
  if (covering.length === 0) {
    return { validity: 'NotFound', reason: `No ROA covers ${ann.prefix} — this is unsigned address space, so validation has nothing to say.` };
  }
  const annLen = parse(ann.prefix).len;
  const matched = covering.find((r) => r.origin === ann.origin && annLen <= r.maxLength);
  if (matched) {
    return { validity: 'Valid', reason: `A ROA authorizes AS${ann.origin} to originate ${ann.prefix} (maxLength /${matched.maxLength}).` };
  }
  // Covered by a ROA but nothing validates it. Report the more-specific violation when the announcement exceeds every
  // covering ROA's maxLength (the distinctive fact of a sub-prefix hijack), otherwise the origin mismatch.
  const maxAllowed = Math.max(...covering.map((r) => r.maxLength));
  const reason = annLen > maxAllowed
    ? `A ROA covers this prefix but only up to /${maxAllowed}; a /${annLen} announcement is more specific than allowed — a classic sub-prefix hijack (even the real owner can't announce it).`
    : `A ROA covers ${ann.prefix} but authorizes a different origin (AS${covering[0].origin}), not AS${ann.origin} — the announcement is a hijack.`;
  return { validity: 'Invalid', reason };
}

// Router policy: with Route Origin Validation enabled, drop Invalid; keep Valid and NotFound. Disabled → accept all.
export function accept(validity: Validity, rovEnabled: boolean): boolean {
  return !rovEnabled || validity !== 'Invalid';
}

export const DEFAULT_ROAS = (): Roa[] => [{ prefix: '192.0.2.0/24', maxLength: 24, origin: 64500 }];
export const ANNOUNCEMENTS = (): Announcement[] => [
  { label: 'legit owner', prefix: '192.0.2.0/24', origin: 64500 },
  { label: 'same-prefix hijack', prefix: '192.0.2.0/24', origin: 64666 },
  { label: 'sub-prefix hijack', prefix: '192.0.2.0/25', origin: 64666 },
  { label: 'unsigned prefix', prefix: '198.51.100.0/24', origin: 64500 },
];
