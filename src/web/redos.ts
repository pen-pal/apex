// ReDoS — Regular-expression Denial of Service, aka catastrophic backtracking. A classic backtracking regex
// engine, given an "evil" pattern with nested quantifiers like (a+)+ and an input that ALMOST matches, tries
// every possible way to split the input among the quantifiers before giving up — and the number of ways is
// EXPONENTIAL in the input length. So a 30-character string against one bad regex can take seconds; a
// 40-character one, hours. A single crafted request pins a CPU. It has bitten Cloudflare (a 2019 global
// outage from one regex), Stack Overflow, and countless validators. We implement a tiny CPS backtracking
// matcher that COUNTS the work, so you can watch a safe pattern stay linear while an evil one explodes.
// Reference: the RE2 papers (Cox); OWASP ReDoS.

export type Node =
  | { t: 'lit'; c: string }
  | { t: 'plus'; n: Node }       // one or more, greedy
  | { t: 'star'; n: Node }       // zero or more, greedy
  | { t: 'concat'; ns: Node[] };

interface Ctx { steps: number; limit: number }

/** Greedy backtracking match in continuation-passing style; every call is one unit of "work" (steps). Bails
 *  out once steps exceeds `limit` (so a truly catastrophic case doesn't hang the browser). */
function m(node: Node, s: string, pos: number, cont: (p: number) => boolean, ctx: Ctx): boolean {
  if (++ctx.steps > ctx.limit) return false;
  switch (node.t) {
    case 'lit':
      return pos < s.length && s[pos] === node.c && cont(pos + 1);
    case 'concat': {
      const go = (i: number, p: number): boolean => (i === node.ns.length ? cont(p) : m(node.ns[i], s, p, (p2) => go(i + 1, p2), ctx));
      return go(0, pos);
    }
    case 'plus': {
      // require one match, then greedily try to repeat before falling through to the continuation
      const rep = (p: number): boolean => m(node.n, s, p, (p2) => (p2 === p ? cont(p2) : rep(p2) || cont(p2)), ctx);
      return rep(pos);
    }
    case 'star': {
      const rep = (p: number): boolean => {
        const more = m(node.n, s, p, (p2) => (p2 === p ? false : rep(p2) || cont(p2)), ctx);
        return more || cont(p);
      };
      return rep(pos);
    }
  }
}

export interface MatchResult { matched: boolean; steps: number; blownUp: boolean }

/** Match `pattern` against the whole of `input` (anchored), counting backtracking steps up to `limit`. */
export function run(pattern: Node, input: string, limit = 2_000_000): MatchResult {
  const ctx: Ctx = { steps: 0, limit };
  const matched = m(pattern, input, 0, (p) => p === input.length, ctx);
  return { matched, steps: ctx.steps, blownUp: ctx.steps > limit };
}

// A few named patterns. lit('a') helper keeps them readable.
const a: Node = { t: 'lit', c: 'a' };
export const PATTERNS: Record<string, { label: string; node: Node; evil: boolean }> = {
  evilPlus: { label: '(a+)+', node: { t: 'plus', n: { t: 'plus', n: a } }, evil: true },
  evilStar: { label: '(a*)*', node: { t: 'star', n: { t: 'star', n: a } }, evil: true },
  safePlus: { label: 'a+', node: { t: 'plus', n: a }, evil: false },
};
