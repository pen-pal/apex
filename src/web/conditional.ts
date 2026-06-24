// Conditional & range requests (RFC 9110) — the HTTP machinery behind cache revalidation, resumable
// downloads, and optimistic concurrency. A resource carries a validator: an ETag (an opaque version
// id) and a Last-Modified time. A client uses them as PRECONDITIONS:
//   • If-None-Match: <etag>  on GET → "only send the body if it CHANGED" → 304 Not Modified if it
//     still matches (zero body bytes — the whole point of revalidation).
//   • If-Modified-Since: <date> → the weaker, date-based version of the same.
//   • Range: bytes=a-b → "send only these bytes" → 206 Partial Content (resume a download), or 416
//     if the range is past the end. If-Range guards it: apply the range only if the validator still
//     matches, else fall back to a full 200.
//   • If-Match: <etag>  on PUT → "only write if nobody else changed it since I read it" → 412
//     Precondition Failed on a mismatch (the lost-update cure).
// We evaluate these exactly as the RFC prescribes and return the status, headers and body. Tested.

export interface Resource { etag: string; lastModified: number; content: string } // lastModified = a day number
export interface Req {
  method: 'GET' | 'PUT';
  ifNoneMatch?: string; // an ETag, or '*'
  ifModifiedSince?: number;
  ifMatch?: string; // an ETag, or '*'
  ifRange?: string; // an ETag
  range?: [number, number]; // inclusive byte range
  body?: string; // for PUT
}
export interface Resp { status: number; reason: string; headers: Record<string, string>; body: string | null; explain: string }

const matches = (cond: string | undefined, etag: string): boolean => cond != null && (cond === '*' || cond === etag);

export function respond(res: Resource, req: Req): Resp {
  const base: Record<string, string> = { ETag: res.etag, 'Last-Modified': `day ${res.lastModified}` };

  if (req.method === 'PUT') {
    // optimistic concurrency: If-Match must still match, or If-None-Match:* means create-only
    if (req.ifMatch != null && !matches(req.ifMatch, res.etag))
      return { status: 412, reason: 'Precondition Failed', headers: base, body: null, explain: `If-Match: ${req.ifMatch} ≠ current ETag ${res.etag} — someone else wrote first; the update is rejected to avoid a lost update.` };
    if (req.ifNoneMatch === '*')
      return { status: 412, reason: 'Precondition Failed', headers: base, body: null, explain: 'If-None-Match: * requires the resource to NOT exist (create-only) — but it does, so the write is refused.' };
    return { status: 204, reason: 'No Content', headers: { ETag: '"v-next"' }, body: null, explain: 'Preconditions passed → the write is applied and a new ETag is issued.' };
  }

  // GET — conditional revalidation first
  if (matches(req.ifNoneMatch, res.etag))
    return { status: 304, reason: 'Not Modified', headers: base, body: null, explain: `If-None-Match matched the current ETag ${res.etag} → nothing changed, so the server sends 304 with NO body. The client reuses its cached copy.` };
  if (req.ifModifiedSince != null && res.lastModified <= req.ifModifiedSince)
    return { status: 304, reason: 'Not Modified', headers: base, body: null, explain: `The resource (day ${res.lastModified}) is not newer than If-Modified-Since (day ${req.ifModifiedSince}) → 304, body skipped.` };

  // range, possibly guarded by If-Range
  if (req.range) {
    const rangeApplies = req.ifRange == null || matches(req.ifRange, res.etag);
    if (!rangeApplies)
      return { status: 200, reason: 'OK', headers: { ...base, 'Content-Length': String(res.content.length) }, body: res.content, explain: 'If-Range no longer matches the ETag → the cached partial is stale, so the server ignores the range and returns the WHOLE resource (200).' };
    const [a, b] = req.range;
    if (a < 0 || a >= res.content.length)
      return { status: 416, reason: 'Range Not Satisfiable', headers: { ...base, 'Content-Range': `bytes */${res.content.length}` }, body: null, explain: `Range starts at ${a} but the resource is only ${res.content.length} bytes → 416 with the true size in Content-Range.` };
    const end = Math.min(b, res.content.length - 1);
    return { status: 206, reason: 'Partial Content', headers: { ...base, 'Content-Range': `bytes ${a}-${end}/${res.content.length}`, 'Content-Length': String(end - a + 1) }, body: res.content.slice(a, end + 1), explain: `206: only bytes ${a}–${end} of ${res.content.length} are sent — exactly what a resumed download or a media seek needs.` };
  }

  return { status: 200, reason: 'OK', headers: { ...base, 'Content-Length': String(res.content.length) }, body: res.content, explain: 'No usable precondition → the full resource is sent with 200 OK.' };
}
