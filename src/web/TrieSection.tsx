// Trie, made visible. A word list builds a tree where shared prefixes share a path; type a
// prefix and watch the matching subtree light up and the autocomplete list fill. Real trie
// in trie.ts (tested).
import { useMemo, useState } from 'react';
import { build, complete, has, startsWith, nodeCount, type TrieNode } from './trie';

const SEED = ['car', 'card', 'care', 'cart', 'cat', 'dog', 'do', 'dot', 'down'];

function NodeView({ node, ch, path, prefix, depth }: { node: TrieNode; ch: string; path: string; prefix: string; depth: number }) {
  const onPath = prefix.length > 0 && (path.startsWith(prefix) || prefix.startsWith(path));
  const kids = Object.keys(node.children).sort();
  return (
    <div className="trie-subtree">
      {ch !== '' && (
        <div className={`trie-node ${node.end ? 'word' : ''} ${onPath ? 'lit' : ''}`} title={path}>
          {ch}{node.end && <span className="trie-dot">●</span>}
        </div>
      )}
      {kids.length > 0 && (
        <div className="trie-children">
          {kids.map((k) => <NodeView key={k} node={node.children[k]} ch={k} path={path + k} prefix={prefix} depth={depth + 1} />)}
        </div>
      )}
    </div>
  );
}

export function TrieSection() {
  const [words, setWords] = useState<string[]>(SEED);
  const [prefix, setPrefix] = useState('car');
  const [newWord, setNewWord] = useState('');

  const trie = useMemo(() => build(words), [words]);
  const matches = useMemo(() => complete(trie, prefix), [trie, prefix]);
  const flat = words.join('').length;
  const nodes = nodeCount(trie);

  const add = () => { const w = newWord.trim().toLowerCase(); if (w && /^[a-z]+$/.test(w) && !words.includes(w)) { setWords([...words, w].sort()); setNewWord(''); } };

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Trie — a tree shaped like its keys</h2></div>
        <p className="jsec-sub">
          In a trie, a word is a <em>path</em> of characters from the root, so every word sharing a prefix shares that path. Lookups
          cost only the length of the key, and “all words starting with…” is just the subtree below the prefix — which is exactly how
          autocomplete and IP longest-prefix routing work. Type a prefix:
        </p>

        <div className="trie-search">
          <input value={prefix} onChange={(e) => setPrefix(e.target.value.toLowerCase().replace(/[^a-z]/g, ''))} placeholder="prefix" spellCheck={false} />
          <span className={`trie-status ${has(trie, prefix) ? 'word' : startsWith(trie, prefix) ? 'pre' : 'none'}`}>
            {has(trie, prefix) ? `“${prefix}” is a complete word` : startsWith(trie, prefix) ? `prefix of ${matches.length} word${matches.length === 1 ? '' : 's'}` : prefix ? 'no match' : ''}
          </span>
        </div>

        <div className="trie-tree">
          <NodeView node={trie} ch="" path="" prefix={prefix} depth={0} />
        </div>

        <div className="trie-complete">
          <span className="trie-clabel">autocomplete →</span>
          {matches.length ? matches.map((m) => <span key={m} className="trie-match">{m}</span>) : <span className="trie-empty">no completions</span>}
        </div>

        <div className="trie-add">
          <input value={newWord} onChange={(e) => setNewWord(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} placeholder="add a word" spellCheck={false} />
          <button onClick={add}>+ insert</button>
          <span className="trie-stat">{words.length} words · {nodes} nodes (vs {flat} chars stored flat)</span>
        </div>

        <p className="trie-foot">
          Sharing prefixes saves both space and time: <code>{nodes}</code> nodes hold what would be <code>{flat}</code> characters across
          separate strings. The cost is a node per character and pointer-chasing, so production variants compress runs (a <strong>radix
          tree</strong> / Patricia trie collapses single-child chains) — which is what Linux uses for its routing table and what
          databases use for key compression. Keyed by bits instead of letters, the very same walk finds the longest matching network
          prefix for a destination IP.
        </p>
      </section>
    </div>
  );
}
