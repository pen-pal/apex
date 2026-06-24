import { describe, it, expect } from 'vitest';
import { encode, learn, STATIC_TABLE, type Header } from '../src/web/qpack';

const REQ: Header[] = [
  { name: ':method', value: 'GET' },
  { name: ':scheme', value: 'https' },
  { name: ':path', value: '/' },
  { name: ':authority', value: 'example.com' },
  { name: 'user-agent', value: 'apex/1.0' },
];

describe('QPACK static table', () => {
  it('has the real RFC 9204 indices for common entries', () => {
    expect(STATIC_TABLE.find((e) => e.name === ':method' && e.value === 'GET')!.i).toBe(17);
    expect(STATIC_TABLE.find((e) => e.name === ':scheme' && e.value === 'https')!.i).toBe(23);
    expect(STATIC_TABLE.find((e) => e.name === ':status' && e.value === '200')!.i).toBe(25);
    expect(STATIC_TABLE.find((e) => e.name === ':path' && e.value === '/')!.i).toBe(1);
    expect(STATIC_TABLE.find((e) => e.name === 'accept' && e.value === '*/*')!.i).toBe(29);
    expect(STATIC_TABLE.find((e) => e.name === 'content-type')!.i).toBe(52);
  });
});

describe('encoding chooses static / dynamic / literal', () => {
  it('full static matches become a one-byte index', () => {
    const { items } = encode(REQ);
    const m = items.find((it) => it.header.name === ':method')!;
    expect(m.repr).toBe('static');
    expect(m.index).toBe(17);
    expect(m.bytes).toBe(1);
  });

  it('an unknown header is a literal, sized by its text', () => {
    const ua = encode(REQ).items.find((it) => it.header.name === 'user-agent')!;
    expect(ua.repr).toBe('literal');
    expect(ua.bytes).toBeGreaterThan(1);
  });

  it('the three pseudo-header static hits collapse to one byte each', () => {
    const { items, compressed, raw } = encode(REQ);
    const statics = items.filter((it) => it.repr === 'static');
    expect(statics).toHaveLength(3); // :method, :scheme, :path
    expect(statics.reduce((s, it) => s + it.bytes, 0)).toBe(3); // ~34 raw bytes → 3
    expect(compressed).toBeLessThan(raw); // first request still shrinks
  });
});

describe('the dynamic table makes repeats cheap', () => {
  it('a repeated literal becomes a one-byte dynamic index on the next request', () => {
    const dyn = learn(REQ); // first request inserts user-agent + :authority value
    const again = encode(REQ, dyn);
    const ua = again.items.find((it) => it.header.name === 'user-agent')!;
    expect(ua.repr).toBe('dynamic');
    expect(ua.bytes).toBe(1);
    expect(again.compressed).toBeLessThan(encode(REQ).compressed); // second request is even smaller
  });
});
