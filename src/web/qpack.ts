// QPACK (RFC 9204) — HTTP/3's header compression, and why it isn't just HPACK. Both
// shrink headers with a STATIC table of well-known name/value pairs (a single index
// byte) plus a DYNAMIC table that learns repeated headers. HPACK's dynamic table
// must be processed strictly in order, which would re-introduce head-of-line
// blocking over QUIC's independent streams — so QPACK moves table updates onto their
// own encoder/decoder streams and lets each request reference only entries it knows
// have arrived. We model the static/dynamic/literal choice and the byte savings.

export interface Header { name: string; value: string }

// A subset of the QPACK static table (RFC 9204 Appendix A) with real indices.
export const STATIC_TABLE: { i: number; name: string; value: string }[] = [
  { i: 0, name: ':authority', value: '' },
  { i: 1, name: ':path', value: '/' },
  { i: 17, name: ':method', value: 'GET' },
  { i: 20, name: ':method', value: 'POST' },
  { i: 22, name: ':scheme', value: 'http' },
  { i: 23, name: ':scheme', value: 'https' },
  { i: 25, name: ':status', value: '200' },
  { i: 27, name: ':status', value: '404' },
  { i: 31, name: 'content-type', value: 'text/html' },
  { i: 33, name: 'accept', value: '*/*' },
];

export type Repr = 'static' | 'dynamic' | 'literal';
export interface Encoded { header: Header; repr: Repr; index?: number; bytes: number }

const rawSize = (h: Header) => h.name.length + h.value.length + 2; // uncompressed (name + value + framing)
const eq = (a: Header, b: { name: string; value: string }) => a.name === b.name && a.value === b.value;

/** Encode a header list against the static table and an evolving dynamic table. */
export function encode(headers: Header[], dynamic: Header[] = []): { items: Encoded[]; compressed: number; raw: number } {
  const dyn = [...dynamic];
  const items: Encoded[] = headers.map((h) => {
    const s = STATIC_TABLE.find((e) => eq(h, e));
    if (s) return { header: h, repr: 'static', index: s.i, bytes: 1 }; // one index byte
    const d = dyn.findIndex((e) => eq(h, e));
    if (d >= 0) return { header: h, repr: 'dynamic', index: d, bytes: 1 };
    dyn.push({ ...h }); // first sighting → insert so the next request indexes it
    return { header: h, repr: 'literal', bytes: rawSize(h) };
  });
  return {
    items,
    compressed: items.reduce((s, it) => s + it.bytes, 0),
    raw: headers.reduce((s, h) => s + rawSize(h), 0),
  };
}

/** The dynamic table after encoding (literals that were inserted). */
export function learn(headers: Header[], dynamic: Header[] = []): Header[] {
  const dyn = [...dynamic];
  for (const h of headers) {
    if (!STATIC_TABLE.find((e) => eq(h, e)) && !dyn.find((e) => eq(h, e))) dyn.push({ ...h });
  }
  return dyn;
}
