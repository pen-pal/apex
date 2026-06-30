import { describe, it, expect } from 'vitest';
import { AhoCorasick } from '../src/web/ahocorasick';

describe('Aho-Corasick — the canonical {he, she, his, hers} example', () => {
  const ac = new AhoCorasick(['he', 'she', 'his', 'hers']);

  it('finds every pattern occurrence in "ushers" in one pass', () => {
    const m = ac.search('ushers').map((x) => `${x.pattern}@${x.start}-${x.end}`).sort();
    // u s h e r s  →  she[1..3], he[2..3], hers[2..5]
    expect(m).toEqual(['he@2-3', 'hers@2-5', 'she@1-3'].sort());
  });

  it('matched substrings actually equal their pattern', () => {
    const text = 'ushers';
    for (const mt of ac.search(text)) expect(text.slice(mt.start, mt.end + 1)).toBe(mt.pattern);
  });

  it('a state’s output collects matches reachable via failure links (she ⇒ also he)', () => {
    // the node spelling "she" must output both "she" and (via its failure link to "he") "he"
    const states = ac.trace('she');
    const sheState = states[states.length - 1];
    expect(ac.nodes[sheState].out.sort()).toEqual(['he', 'she']);
  });
});

describe('failure links behave like a trie-wide KMP', () => {
  it('overlapping patterns are all reported', () => {
    const ac = new AhoCorasick(['a', 'ab', 'bab', 'bc', 'bca', 'c', 'caa']);
    const m = ac.search('abccab').filter((x) => x.pattern === 'a');
    expect(m.map((x) => x.start)).toEqual([0, 4]); // 'a' occurs at index 0 and 4
  });

  it('counts all matches including repeats', () => {
    const ac = new AhoCorasick(['aa']);
    expect(ac.search('aaaa')).toHaveLength(3); // positions 0-1, 1-2, 2-3 (overlapping)
  });

  it('no patterns or no text yields no matches', () => {
    expect(new AhoCorasick(['x']).search('')).toEqual([]);
    expect(new AhoCorasick([]).search('abc')).toEqual([]);
  });
});

describe('single-pattern parity with a plain substring search', () => {
  it('agrees with indexOf-style scanning for one pattern', () => {
    const ac = new AhoCorasick(['ana']);
    const found = ac.search('banana').map((m) => m.start);
    expect(found).toEqual([1, 3]); // banana: ana at 1 and 3 (overlapping)
  });
});
