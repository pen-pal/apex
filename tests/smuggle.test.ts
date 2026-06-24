import { describe, it, expect } from 'vitest';
import { frame, desync, buildCLTE, buildTECL } from '../src/web/smuggle';

describe('HTTP/1.1 framing — the two ways to delimit a body', () => {
  const raw = buildCLTE();
  it('Content-Length reads exactly N body bytes', () => {
    const f = frame(raw, 'CL');
    expect(f.valid).toBe(true);
    expect(f.consumed).toBe(raw.length); // CL was set to the full body length → consumes everything
  });
  it('chunked stops at the 0-size chunk, leaving the rest', () => {
    const f = frame(raw, 'TE');
    expect(f.valid).toBe(true);
    expect(f.consumed).toBe(f.bodyStart + '0\r\n\r\n'.length); // ends right after the 0-chunk
    expect(f.consumed).toBeLessThan(raw.length);
  });
});

describe('CL.TE desync (front-end Content-Length, back-end chunked)', () => {
  const raw = buildCLTE();
  const d = desync(raw, 'CL', 'TE');
  it('smuggles the bytes after the 0-chunk as the start of the next request', () => {
    expect(d.kind).toBe('CL.TE');
    expect(d.bothPresent).toBe(true);
    expect(d.front.consumed).toBeGreaterThan(d.back.consumed); // front reads more than the back
    expect(d.smuggled).toBe('GET /admin HTTP/1.1\r\nHost: victim.example\r\nFoo: '); // the injected prefix
  });
  it('names RFC 9112 §6.1’s safe choice (Transfer-Encoding wins)', () => {
    expect(d.rfcSafe).toBe('TE');
  });
});

describe('TE.CL desync (front-end chunked, back-end Content-Length)', () => {
  const raw = buildTECL();
  const d = desync(raw, 'TE', 'CL');
  it('the front-end reads the whole chunk; the back-end reads only the size line', () => {
    expect(d.kind).toBe('TE.CL');
    expect(d.front.valid).toBe(true);
    expect(d.front.consumed).toBe(raw.length); // chunked consumes the entire body
    expect(d.back.consumed).toBeLessThan(d.front.consumed);
    expect(d.smuggled.startsWith('GET /admin HTTP/1.1')).toBe(true); // the chunk body becomes the next request
  });
});

describe('no desync when both ends agree', () => {
  it('CL vs CL leaves nothing smuggled', () => {
    const raw = buildCLTE();
    const d = desync(raw, 'CL', 'CL');
    expect(d.kind).toBe('aligned');
    expect(d.smuggled).toBe('');
  });
});
