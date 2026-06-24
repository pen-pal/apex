import { describe, it, expect } from 'vitest';
import { encode, decode, commonPrefix } from '../src/web/geohash';

describe('geohash encoding (canonical vectors)', () => {
  it('encodes (42.6, -5.6) to "ezs42"', () => {
    expect(encode(42.6, -5.6, 5)).toBe('ezs42'); // the Wikipedia worked example
  });
  it('encodes a known landmark', () => {
    // San Francisco ~ (37.7749, -122.4194) → starts with "9q8y"
    expect(encode(37.7749, -122.4194, 6)).toBe('9q8yyk');
  });
});

describe('decode round-trips into a box containing the point', () => {
  it('the decoded box contains the original coordinate', () => {
    for (const [lat, lon] of [[42.6, -5.6], [37.7749, -122.4194], [0, 0], [-33.8688, 151.2093]]) {
      const box = decode(encode(lat, lon, 7));
      expect(lat).toBeGreaterThanOrEqual(box.latMin);
      expect(lat).toBeLessThanOrEqual(box.latMax);
      expect(lon).toBeGreaterThanOrEqual(box.lonMin);
      expect(lon).toBeLessThanOrEqual(box.lonMax);
    }
  });

  it('more precision means a smaller box', () => {
    const coarse = decode(encode(42.6, -5.6, 3));
    const fine = decode(encode(42.6, -5.6, 7));
    expect(fine.latMax - fine.latMin).toBeLessThan(coarse.latMax - coarse.latMin);
  });
});

describe('prefix = proximity', () => {
  it('nearby points share a longer prefix than distant ones', () => {
    const sf = encode(37.7749, -122.4194, 9);
    const oakland = encode(37.8044, -122.2712, 9); // ~13 km away
    const tokyo = encode(35.6762, 139.6503, 9);     // other side of the world
    expect(commonPrefix(sf, oakland)).toBeGreaterThan(commonPrefix(sf, tokyo));
    expect(commonPrefix(sf, tokyo)).toBe(0); // nothing in common
  });
});
