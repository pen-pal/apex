import { describe, it, expect } from 'vitest';
import { hash, macNaive, extend, hmac, mdPad, strBytes } from '../src/web/lenext';

describe('the toy Merkle–Damgård hash', () => {
  it('is deterministic', () => {
    expect(hash(strBytes('hello'))).toBe(hash(strBytes('hello')));
  });
  it('avalanches — a one-bit change scrambles the digest', () => {
    expect(hash(strBytes('abc'))).not.toBe(hash(strBytes('abd')));
  });
  it('padding makes the padded message a whole number of blocks', () => {
    for (const len of [0, 1, 3, 7, 8, 9, 20]) {
      expect((len + mdPad(len).length) % 8).toBe(0);
    }
  });
});

describe('length-extension attack on H(secret ‖ message)', () => {
  const secret = strBytes('S3cr3tKey');
  const msg = strBytes('user=guest');
  const evil = strBytes('&admin=true');

  it('forges a valid tag for message‖glue‖evil WITHOUT the secret', () => {
    const tag = macNaive(secret, msg);                       // server publishes this
    const { forgedTag, suffix } = extend(tag, secret.length + msg.length, evil); // attacker: no secret used
    // the server verifies the attacker's message (msg ‖ suffix) by recomputing its own MAC
    const serverTag = macNaive(secret, msg.concat(suffix));
    expect(forgedTag).toBe(serverTag);                       // forgery accepted
  });

  it('extend() never touches the secret — only the tag, the length, and the extension', () => {
    // proven structurally: extend takes (tag, secretPlusMsgLen, extension). Re-run with a DIFFERENT secret of
    // the same length and the SAME published tag → identical forgery (the attacker only needs the length).
    const s2 = strBytes('DifferntK'); // same length as 'S3cr3tKey' (9)
    expect(s2.length).toBe(secret.length);
    const tag = macNaive(secret, msg);
    const a = extend(tag, secret.length + msg.length, evil);
    const b = extend(tag, s2.length + msg.length, evil);
    expect(a.forgedTag).toBe(b.forgedTag);
    expect(a.suffix).toEqual(b.suffix);
  });

  it('the forged suffix is the message padding (glue) followed by the evil bytes', () => {
    const tag = macNaive(secret, msg);
    const { suffix } = extend(tag, secret.length + msg.length, evil);
    expect(suffix).toEqual(mdPad(secret.length + msg.length).concat(evil));
  });
});

describe('HMAC defeats length extension', () => {
  const secret = strBytes('S3cr3tKey');
  const msg = strBytes('user=guest');
  const evil = strBytes('&admin=true');

  it('a naive extension of an HMAC tag is NOT a valid HMAC for the extended message', () => {
    const tag = hmac(secret, msg);
    const { forgedTag } = extend(tag, secret.length + msg.length, evil);
    const realHmacOfExtended = hmac(secret, msg.concat(mdPad(secret.length + msg.length)).concat(evil));
    expect(forgedTag).not.toBe(realHmacOfExtended); // the outer hash hides the state — nothing to extend
  });
  it('HMAC is still deterministic and key-dependent', () => {
    expect(hmac(secret, msg)).toBe(hmac(secret, msg));
    expect(hmac(secret, msg)).not.toBe(hmac(strBytes('otherkey!'), msg));
  });
});
