import { describe, it, expect } from 'vitest';
import { parseMagnet, metadataVerifies } from '../src/web/magnet';

// Independent oracle: BEP-9 magnet-URI format. xt=urn:btih:<40-hex or 32-base32> carries the infohash; dn is the
// display name; tr are trackers. Content-addressing means received metadata verifies iff its infohash matches the
// requested one. Asserted against the spec, not the code.

describe('magnet links & infohash (BEP-9)', () => {
  const uri = 'magnet:?xt=urn:btih:C8F2E9A1B3D47F0E6A2C5B8D1F4E7A09C3B6D2E5&dn=cool.iso&tr=udp://t1&tr=udp://t2';

  it('parses the infohash (lowercased), name, and trackers', () => {
    const m = parseMagnet(uri)!;
    expect(m.infohash).toBe('c8f2e9a1b3d47f0e6a2c5b8d1f4e7a09c3b6d2e5');
    expect(m.name).toBe('cool.iso');
    expect(m.trackers).toEqual(['udp://t1', 'udp://t2']);
  });
  it('a magnet with no tracker still parses (trackerless)', () => {
    const m = parseMagnet('magnet:?xt=urn:btih:c8f2e9a1b3d47f0e6a2c5b8d1f4e7a09c3b6d2e5')!;
    expect(m.infohash).toHaveLength(40);
    expect(m.trackers).toEqual([]);
  });
  it('rejects a non-magnet URI or a malformed infohash', () => {
    expect(parseMagnet('https://example/file')).toBe(null);
    expect(parseMagnet('magnet:?xt=urn:btih:notvalidhex')).toBe(null);
    expect(parseMagnet('magnet:?dn=noxt')).toBe(null);
  });
  it('content-address verification: metadata is accepted iff its hash matches the request', () => {
    const ih = 'c8f2e9a1b3d47f0e6a2c5b8d1f4e7a09c3b6d2e5';
    expect(metadataVerifies(ih, ih.toUpperCase())).toBe(true);
    expect(metadataVerifies(ih, 'deadbeef'.repeat(5))).toBe(false);
  });
});
