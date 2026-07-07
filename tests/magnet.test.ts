import { describe, it, expect } from 'vitest';
import { parseMagnet, metadataVerifies, bencode, pieceHashes, infohashOf, pieceVerifies } from '../src/web/magnet';
import { sha1 } from '../src/web/sha1';
import { toHex } from '../src/web/hashing';

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

// Independent oracle: the canonical bencode examples from BEP-3 itself ("Integers... i3e", "Strings... 4:spam",
// "Lists... l4:spam4:eggse", "Dictionaries... d3:cow3:moo4:spam4:eggse"). Dict keys must be emitted in sorted order.
const dec = (b: Uint8Array) => new TextDecoder().decode(b);
const enc = (s: string) => new TextEncoder().encode(s);

describe('bencode (BEP-3 canonical examples)', () => {
  it('encodes integers as i<n>e', () => {
    expect(dec(bencode(3))).toBe('i3e');
    expect(dec(bencode(0))).toBe('i0e');
    expect(dec(bencode(-42))).toBe('i-42e');
  });
  it('encodes strings as <length>:<contents>', () => {
    expect(dec(bencode('spam'))).toBe('4:spam');
    expect(dec(bencode(''))).toBe('0:');
  });
  it('encodes lists as l<items>e', () => {
    expect(dec(bencode(['spam', 'eggs']))).toBe('l4:spam4:eggse');
  });
  it('encodes dicts as d<sorted pairs>e — keys sorted regardless of insertion order', () => {
    expect(dec(bencode({ cow: 'moo', spam: 'eggs' }))).toBe('d3:cow3:moo4:spam4:eggse');
    expect(dec(bencode({ spam: 'eggs', cow: 'moo' }))).toBe('d3:cow3:moo4:spam4:eggse');
    // "piece length" sorts before "pieces" (space 0x20 < 's' 0x73) — the info-dict key order.
    expect(dec(bencode({ pieces: 'z', 'piece length': 'a' }))).toBe('d12:piece length1:a6:pieces1:ze');
  });
  it('rejects non-integer numbers', () => {
    expect(() => bencode(1.5)).toThrow();
  });
});

describe('infohash = SHA-1 of the bencoded info dict (content address)', () => {
  const name = 'apex-demo.iso';
  const PL = 4;
  const data = enc('the quick brown fox');

  it('is 40 lowercase hex chars and deterministic', () => {
    const a = infohashOf(name, PL, data);
    const b = infohashOf(name, PL, data);
    expect(a).toMatch(/^[0-9a-f]{40}$/);
    expect(a).toBe(b);
  });

  it('matches an independent hand-composition of the same bencoded info dict', () => {
    // Rebuild the exact info dict a different way (concatenate the piece hashes, then bencode by hand) and hash it.
    const pieces = pieceHashes(data, PL);
    const catHashes = new Uint8Array(pieces.length * 20);
    pieces.forEach((h, i) => catHashes.set(h, i * 20));
    const expectedInfo = bencode({ length: data.length, name, 'piece length': PL, pieces: catHashes });
    expect(infohashOf(name, PL, data)).toBe(toHex(sha1(expectedInfo)));
  });

  it('is tamper-sensitive: flipping any single content byte changes the infohash', () => {
    const base = infohashOf(name, PL, data);
    for (let i = 0; i < data.length; i++) {
      const tampered = new Uint8Array(data);
      tampered[i] ^= 0x01; // flip one bit of one byte
      expect(infohashOf(name, PL, tampered)).not.toBe(base);
    }
  });

  it('piece verification: the original piece passes, a tampered piece is rejected', () => {
    const pieces = pieceHashes(data, PL);
    const p0 = data.slice(0, PL);
    expect(pieceVerifies(p0, toHex(pieces[0]))).toBe(true);
    const bad = new Uint8Array(p0);
    bad[0] ^= 0x80;
    expect(pieceVerifies(bad, toHex(pieces[0]))).toBe(false);
  });
});
