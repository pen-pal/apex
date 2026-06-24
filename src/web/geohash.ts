// Geohashing — encode a latitude/longitude into a short string so that nearby points share
// a prefix. The trick is interleaving: repeatedly halve the world, recording one bit per
// split — even bits halve longitude, odd bits halve latitude — then base32-encode the bit
// stream. A longer hash is a smaller box, and because each character refines the same
// nested grid, two locations close together agree on a leading prefix. That turns
// "find things near here" into a cheap prefix scan, which is why geohashes index spatial
// data in Redis, Elasticsearch, and many databases. Pure, tested against the canonical
// (42.6, -5.6) → "ezs42" vector.

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz'; // no a, i, l, o

export function encode(lat: number, lon: number, precision = 5): string {
  let latR = [-90, 90], lonR = [-180, 180];
  let even = true, bit = 0, ch = 0;
  let hash = '';
  while (hash.length < precision) {
    if (even) {
      const mid = (lonR[0] + lonR[1]) / 2;
      if (lon >= mid) { ch |= 1 << (4 - bit); lonR = [mid, lonR[1]]; } else lonR = [lonR[0], mid];
    } else {
      const mid = (latR[0] + latR[1]) / 2;
      if (lat >= mid) { ch |= 1 << (4 - bit); latR = [mid, latR[1]]; } else latR = [latR[0], mid];
    }
    even = !even;
    if (bit < 4) bit++;
    else { hash += BASE32[ch]; bit = 0; ch = 0; }
  }
  return hash;
}

export interface Box { latMin: number; latMax: number; lonMin: number; lonMax: number; lat: number; lon: number }

/** Decode a geohash to its bounding box and centre. */
export function decode(hash: string): Box {
  let latR = [-90, 90], lonR = [-180, 180];
  let even = true;
  for (const c of hash) {
    const idx = BASE32.indexOf(c);
    for (let b = 4; b >= 0; b--) {
      const bit = (idx >> b) & 1;
      if (even) { const mid = (lonR[0] + lonR[1]) / 2; lonR = bit ? [mid, lonR[1]] : [lonR[0], mid]; }
      else { const mid = (latR[0] + latR[1]) / 2; latR = bit ? [mid, latR[1]] : [latR[0], mid]; }
      even = !even;
    }
  }
  return { latMin: latR[0], latMax: latR[1], lonMin: lonR[0], lonMax: lonR[1], lat: (latR[0] + latR[1]) / 2, lon: (lonR[0] + lonR[1]) / 2 };
}

/** Length of the shared leading prefix of two geohashes (a proxy for proximity). */
export function commonPrefix(a: string, b: string): number {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n++;
  return n;
}
