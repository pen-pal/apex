import { describe, it, expect } from 'vitest';
import { circuitHops, anySingleRelayLinksYou, deanonymisedBy, DEFAULT_CIRCUIT } from '../src/web/tor';

// Independent oracle: the onion-routing security property (Dingledine, Mathewson, Syverson 2004). In an N>=2 hop
// circuit the guard sees the origin but not the destination, the exit sees the destination but not the origin,
// interior relays see neither, no SINGLE relay links sender to destination, and only guard+exit collusion does.
// These are external facts about the design, asserted against the model — not derived from the model's own output.

describe('onion routing unlinkability', () => {
  const hops = circuitHops(DEFAULT_CIRCUIT, 'the site');

  it('exactly one relay (the guard) sees the origin', () => {
    expect(hops.filter((h) => h.seesOrigin).map((h) => h.relay.id)).toEqual(['g']);
  });
  it('exactly one relay (the exit) sees the destination', () => {
    expect(hops.filter((h) => h.seesDest).map((h) => h.relay.id)).toEqual(['e']);
  });
  it('the middle relay sees neither origin nor destination', () => {
    const mid = hops.find((h) => h.relay.id === 'm')!;
    expect(mid.seesOrigin).toBe(false);
    expect(mid.seesDest).toBe(false);
  });
  it('each relay receives from the previous hop and forwards to the next', () => {
    expect(hops.map((h) => h.prevHop)).toEqual(['you', 'Guard', 'Middle']);
    expect(hops.map((h) => h.nextHop)).toEqual(['Middle', 'Exit', 'the site']);
  });
  it('no single relay links you to the site', () => {
    expect(anySingleRelayLinksYou(hops)).toBe(false);
  });
  it('any single compromised relay (or a non-endpoint pair) does NOT de-anonymise you', () => {
    for (const set of [['g'], ['m'], ['e'], ['g', 'm'], ['m', 'e']]) {
      expect(deanonymisedBy(hops, new Set(set))).toBe(false);
    }
  });
  it('guard + exit collusion DOES de-anonymise you (endpoint correlation)', () => {
    expect(deanonymisedBy(hops, new Set(['g', 'e']))).toBe(true);
  });
  it('a one-relay circuit is linkable — why Tor uses multiple hops', () => {
    const solo = circuitHops([DEFAULT_CIRCUIT[0]], 'the site');
    expect(anySingleRelayLinksYou(solo)).toBe(true);
  });
});
