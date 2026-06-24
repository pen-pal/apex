import { describe, it, expect } from 'vitest';
import { build, insert, has, startsWith, complete, nodeCount, create } from '../src/web/trie';

const WORDS = ['car', 'card', 'care', 'cat', 'dog', 'do'];

describe('trie membership', () => {
  const t = build(WORDS);
  it('finds exact words and rejects non-words', () => {
    expect(has(t, 'car')).toBe(true);
    expect(has(t, 'card')).toBe(true);
    expect(has(t, 'ca')).toBe(false);   // a prefix, not a stored word
    expect(has(t, 'cars')).toBe(false);
    expect(has(t, 'do')).toBe(true);    // 'do' is a word AND a prefix of 'dog'
  });

  it('startsWith is true for any stored prefix', () => {
    expect(startsWith(t, 'ca')).toBe(true);
    expect(startsWith(t, 'car')).toBe(true);
    expect(startsWith(t, 'z')).toBe(false);
  });
});

describe('autocomplete', () => {
  const t = build(WORDS);
  it('lists all words under a prefix, sorted', () => {
    expect(complete(t, 'car')).toEqual(['car', 'card', 'care']);
    expect(complete(t, 'ca')).toEqual(['car', 'card', 'care', 'cat']);
    expect(complete(t, 'do')).toEqual(['do', 'dog']);
    expect(complete(t, '')).toEqual(['car', 'card', 'care', 'cat', 'do', 'dog']); // everything
  });
  it('returns nothing for an absent prefix', () => {
    expect(complete(t, 'xyz')).toEqual([]);
  });
});

describe('shared prefixes save nodes', () => {
  it('car/card/care/cat reuse the c-a path instead of storing it 4 times', () => {
    const t = build(['car', 'card', 'care', 'cat']);
    // nodes: root, c, a, r, d, e, t = 7 (the 'c' and 'a' are shared by all four)
    expect(nodeCount(t)).toBe(7);
  });
  it('an empty trie is a single root node', () => {
    expect(nodeCount(create())).toBe(1);
  });
});

describe('insert is idempotent on duplicates', () => {
  it('inserting the same word twice adds no nodes', () => {
    const t = build(['hello']);
    const before = nodeCount(t);
    insert(t, 'hello');
    expect(nodeCount(t)).toBe(before);
  });
});
