// Aho-Corasick — find ALL occurrences of MANY patterns in one pass over the text. KMP and Rabin-Karp
// hunt for a single pattern; Aho-Corasick builds one automaton for the whole dictionary and matches them
// simultaneously in O(text + matches), independent of how many patterns there are. It's a trie of the
// patterns plus FAILURE LINKS: when the current path can't extend, the failure link jumps to the longest
// proper suffix that is still a prefix of some pattern (the same idea as KMP's failure function, lifted
// to a trie). Output links collect every pattern that ends at the current state. It's what powers fgrep,
// virus scanners, and intrusion-detection rule engines. Reference: Aho & Corasick (CACM 1975).

export interface ACNode { id: number; children: Record<string, number>; fail: number; out: string[]; depth: number; char: string; parent: number }
export interface Match { pattern: string; start: number; end: number }

export class AhoCorasick {
  nodes: ACNode[] = [{ id: 0, children: {}, fail: 0, out: [], depth: 0, char: '', parent: -1 }];

  constructor(patterns: string[]) {
    for (const p of patterns) if (p) this.insert(p);
    this.buildFailureLinks();
  }

  private insert(pattern: string) {
    let cur = 0;
    for (const ch of pattern) {
      if (this.nodes[cur].children[ch] === undefined) {
        const id = this.nodes.length;
        this.nodes.push({ id, children: {}, fail: 0, out: [], depth: this.nodes[cur].depth + 1, char: ch, parent: cur });
        this.nodes[cur].children[ch] = id;
      }
      cur = this.nodes[cur].children[ch];
    }
    this.nodes[cur].out.push(pattern);
  }

  // BFS from the root: a node's failure link is the deepest other node reachable by following its parent's
  // failure link and matching the same incoming character; output links accumulate along failure links.
  private buildFailureLinks() {
    const queue: number[] = [];
    for (const v of Object.values(this.nodes[0].children)) { this.nodes[v].fail = 0; queue.push(v); }
    while (queue.length) {
      const u = queue.shift()!;
      for (const [ch, v] of Object.entries(this.nodes[u].children)) {
        queue.push(v);
        let f = this.nodes[u].fail;
        while (f !== 0 && this.nodes[f].children[ch] === undefined) f = this.nodes[f].fail;
        const cand = this.nodes[f].children[ch];
        this.nodes[v].fail = cand !== undefined && cand !== v ? cand : 0;
        this.nodes[v].out = [...this.nodes[v].out, ...this.nodes[this.nodes[v].fail].out];
      }
    }
  }

  /** The transition function: from state `s` on character `ch`, following failure links on mismatch. */
  go(s: number, ch: string): number {
    let cur = s;
    while (cur !== 0 && this.nodes[cur].children[ch] === undefined) cur = this.nodes[cur].fail;
    return this.nodes[cur].children[ch] ?? 0;
  }

  /** Scan `text`, returning every (pattern, start, end) match across all dictionary patterns. */
  search(text: string): Match[] {
    const matches: Match[] = [];
    let cur = 0;
    for (let i = 0; i < text.length; i++) {
      cur = this.go(cur, text[i]);
      for (const pat of this.nodes[cur].out) matches.push({ pattern: pat, start: i - pat.length + 1, end: i });
    }
    return matches;
  }

  /** The state visited after consuming each character — for stepping the visualization. */
  trace(text: string): number[] {
    const states: number[] = [];
    let cur = 0;
    for (let i = 0; i < text.length; i++) { cur = this.go(cur, text[i]); states.push(cur); }
    return states;
  }
}
