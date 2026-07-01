// Prototype pollution — a JavaScript-specific vulnerability where attacker-controlled JSON reaches deep into a
// program's object model and changes the behaviour of objects it never touched. In JS almost every object
// inherits from a single shared Object.prototype; read a property an object doesn't have and the engine walks
// up to that prototype. Now consider a common "deep merge" that recursively copies a config/JSON payload onto
// an object. If the payload contains the key "__proto__", a naive merge follows it — and "__proto__" is the
// live link to the shared prototype. So merging {"__proto__": {"isAdmin": true}} writes isAdmin=true onto the
// prototype every object inherits from. Suddenly ({}).isAdmin is true everywhere: an auth check that reads
// user.isAdmin passes for everyone; a flag that gates a debug shell flips on globally; a library that trusts a
// default suddenly sees an attacker's value. This file SIMULATES the vulnerability in a sandbox — it models
// its own "prototype" object and never mutates the real Object.prototype — to show the mechanism and the fix
// (drop the dangerous keys, or use a null-prototype object / Map). Reference: the __proto__ / prototype-
// pollution class (Arteau, 2018) that hit lodash, jQuery, and many merge/query-string parsers.

export interface Env { proto: Record<string, unknown> } // the simulated shared prototype
export const freshEnv = (): Env => ({ proto: {} });

const isObj = (x: unknown): x is Record<string, any> => typeof x === 'object' && x !== null && !Array.isArray(x);
const DANGEROUS = new Set(['__proto__', 'constructor', 'prototype']);

/** Property lookup with a prototype chain: own property first, else fall back to the shared prototype. */
export function lookup(obj: Record<string, any>, key: string, env: Env): unknown {
  return Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : env.proto[key];
}

/** The VULNERABLE deep merge: it honours "__proto__", writing into the shared prototype. */
export function vulnerableMerge(target: Record<string, any>, source: Record<string, any>, env: Env): void {
  for (const key of Object.keys(source)) {
    if (key === '__proto__') { vulnerableMerge(env.proto as Record<string, any>, source[key], env); continue; } // pollutes!
    if (isObj(source[key])) { if (!isObj(target[key])) target[key] = {}; vulnerableMerge(target[key], source[key], env); }
    else target[key] = source[key];
  }
}

/** The SAFE deep merge: dangerous keys are dropped, so the prototype is untouchable. */
export function safeMerge(target: Record<string, any>, source: Record<string, any>, env: Env): void {
  for (const key of Object.keys(source)) {
    if (DANGEROUS.has(key)) continue; // ignore __proto__ / constructor / prototype
    if (isObj(source[key])) { if (!isObj(target[key])) target[key] = {}; safeMerge(target[key], source[key], env); }
    else target[key] = source[key];
  }
}

/** Parse a JSON payload keeping "__proto__" as an OWN key (JSON.parse already does this). */
export const parsePayload = (json: string): Record<string, any> => JSON.parse(json);

/** Run a merge and report what a FRESH, empty object now sees for a set of probe keys — the blast radius. */
export function demo(json: string, mode: 'vulnerable' | 'safe', probes: string[]): { env: Env; polluted: Record<string, unknown>; freshObjectSees: Record<string, unknown>; target: Record<string, any> } {
  const env = freshEnv();
  const target: Record<string, any> = {};
  const source = parsePayload(json);
  (mode === 'vulnerable' ? vulnerableMerge : safeMerge)(target, source, env);
  const freshObjectSees: Record<string, unknown> = {};
  for (const k of probes) freshObjectSees[k] = lookup({}, k, env); // a brand-new {} inherits polluted props
  return { env, polluted: { ...env.proto }, freshObjectSees, target };
}
