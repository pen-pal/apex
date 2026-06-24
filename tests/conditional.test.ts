import { describe, it, expect } from 'vitest';
import { respond, type Resource } from '../src/web/conditional';

const RES: Resource = { etag: '"v7"', lastModified: 10, content: 'ABCDEFGHIJ' }; // 10 bytes

describe('conditional GET — revalidation (RFC 9110 §13)', () => {
  it('If-None-Match on the current ETag → 304 with no body', () => {
    const r = respond(RES, { method: 'GET', ifNoneMatch: '"v7"' });
    expect(r.status).toBe(304);
    expect(r.body).toBeNull(); // the bandwidth win: zero body bytes
  });
  it('If-None-Match on a stale ETag → 200 with the full body', () => {
    const r = respond(RES, { method: 'GET', ifNoneMatch: '"v6"' });
    expect(r.status).toBe(200);
    expect(r.body).toBe('ABCDEFGHIJ');
  });
  it('If-Modified-Since not older than the resource → 304', () => {
    expect(respond(RES, { method: 'GET', ifModifiedSince: 10 }).status).toBe(304); // equal date → not modified
    expect(respond(RES, { method: 'GET', ifModifiedSince: 9 }).status).toBe(200); // older → send it
  });
});

describe('range requests (RFC 9110 §14)', () => {
  it('a valid range → 206 with exactly those bytes and a Content-Range', () => {
    const r = respond(RES, { method: 'GET', range: [2, 5] });
    expect(r.status).toBe(206);
    expect(r.body).toBe('CDEF'); // bytes 2..5 inclusive
    expect(r.headers['Content-Range']).toBe('bytes 2-5/10');
    expect(r.headers['Content-Length']).toBe('4');
  });
  it('a range clamps to the end of the resource', () => {
    const r = respond(RES, { method: 'GET', range: [8, 99] });
    expect(r.status).toBe(206);
    expect(r.body).toBe('IJ');
    expect(r.headers['Content-Range']).toBe('bytes 8-9/10');
  });
  it('a range past the end → 416 with the true size', () => {
    const r = respond(RES, { method: 'GET', range: [10, 20] });
    expect(r.status).toBe(416);
    expect(r.headers['Content-Range']).toBe('bytes */10');
  });
  it('If-Range that still matches → 206; that no longer matches → full 200', () => {
    expect(respond(RES, { method: 'GET', range: [0, 3], ifRange: '"v7"' }).status).toBe(206);
    const stale = respond(RES, { method: 'GET', range: [0, 3], ifRange: '"v6"' });
    expect(stale.status).toBe(200);
    expect(stale.body).toBe('ABCDEFGHIJ'); // stale partial → server resends the whole thing
  });
});

describe('conditional PUT — optimistic concurrency', () => {
  it('If-Match on the current ETag → write succeeds (204)', () => {
    expect(respond(RES, { method: 'PUT', ifMatch: '"v7"', body: 'new' }).status).toBe(204);
  });
  it('If-Match on a stale ETag → 412, preventing a lost update', () => {
    const r = respond(RES, { method: 'PUT', ifMatch: '"v6"', body: 'new' });
    expect(r.status).toBe(412);
    expect(r.body).toBeNull();
  });
  it('If-None-Match:* (create-only) on an existing resource → 412', () => {
    expect(respond(RES, { method: 'PUT', ifNoneMatch: '*', body: 'new' }).status).toBe(412);
  });
});

describe('plain GET', () => {
  it('with no preconditions → 200 and the whole body', () => {
    const r = respond(RES, { method: 'GET' });
    expect(r.status).toBe(200);
    expect(r.body).toBe('ABCDEFGHIJ');
    expect(r.headers['Content-Length']).toBe('10');
  });
});
