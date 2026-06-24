// Deterministic Finite Automaton (DFA) — the simplest computer: a fixed set of states, one
// current state, and a transition table that says, for the current state and the next input
// symbol, which state to move to. After reading the whole input, you ACCEPT if you landed in
// an accepting state, else REJECT. With no memory beyond the current state, a DFA recognizes
// exactly the "regular" languages — which is plenty: it's the engine inside lexers, regex
// matchers, protocol state machines, and input validators. The classic surprise is that
// "is this binary number divisible by 3?" is a 3-state DFA (the states ARE the remainder).
// Pure, tested against the arithmetic it encodes.

export interface Dfa {
  states: string[];
  alphabet: string[];
  start: string;
  accept: Set<string>;
  delta: Record<string, Record<string, string>>; // state → symbol → state
}

export interface Run { path: string[]; accepted: boolean; rejectedAt: number | null }

/** Run the DFA over `input`, recording the state after each symbol. */
export function run(dfa: Dfa, input: string): Run {
  const path = [dfa.start];
  let state = dfa.start;
  for (let i = 0; i < input.length; i++) {
    const next = dfa.delta[state]?.[input[i]];
    if (next === undefined) return { path, accepted: false, rejectedAt: i }; // no transition → stuck/reject
    state = next; path.push(state);
  }
  return { path, accepted: dfa.accept.has(state), rejectedAt: null };
}

/** DFA accepting binary strings whose value is divisible by `m` (states = remainder mod m). */
export function divisibleBy(m: number): Dfa {
  const states = Array.from({ length: m }, (_, r) => `r${r}`);
  const delta: Dfa['delta'] = {};
  for (let r = 0; r < m; r++) {
    delta[`r${r}`] = { '0': `r${(r * 2) % m}`, '1': `r${(r * 2 + 1) % m}` }; // appending a bit: r → 2r+bit
  }
  return { states, alphabet: ['0', '1'], start: 'r0', accept: new Set(['r0']), delta };
}

/** DFA accepting strings over {a,b} that CONTAIN the substring "ab". */
export function containsAB(): Dfa {
  return {
    states: ['start', 'sawA', 'done'],
    alphabet: ['a', 'b'],
    start: 'start',
    accept: new Set(['done']),
    delta: {
      start: { a: 'sawA', b: 'start' },
      sawA: { a: 'sawA', b: 'done' },
      done: { a: 'done', b: 'done' },
    },
  };
}
