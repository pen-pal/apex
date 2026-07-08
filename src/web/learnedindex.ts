// Learned index — the idea from "The Case for Learned Index Structures". A sorted index is really a function from a key
// to its position, so instead of a B-tree you can fit an actual MODEL of the keys' cumulative distribution: predict the
// position from the key, then do a small LOCAL search inside a guaranteed error bound to correct the prediction. On
// smooth data one line predicts within a couple of slots — an O(1)-ish lookup smaller and often faster than a B-tree.
// The catch is that the error bound is the whole story: on skewed keys a single line fits badly, the max error explodes,
// and the local search window grows until it's no better than a scan. This fits the line and computes that error bound.

export interface Model { slope: number; intercept: number }

// Least-squares fit of index i = slope·key + intercept over the sorted keys (each key's target is its own position).
export function fitLinear(keys: number[]): Model {
  const n = keys.length;
  if (n < 2) return { slope: 0, intercept: 0 };
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) { sx += keys[i]; sy += i; sxx += keys[i] * keys[i]; sxy += keys[i] * i; }
  const denom = n * sxx - sx * sx;
  const slope = denom === 0 ? 0 : (n * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / n;
  return { slope, intercept };
}

export const predict = (m: Model, key: number, n: number): number =>
  Math.max(0, Math.min(n - 1, Math.round(m.slope * key + m.intercept)));

// The guaranteed error bound: the largest gap between a key's predicted and true position. The local search must cover
// ±maxError, so the window it scans is 2·maxError + 1 slots.
export function maxError(keys: number[], m: Model): number {
  let e = 0;
  for (let i = 0; i < keys.length; i++) e = Math.max(e, Math.abs(predict(m, keys[i], keys.length) - i));
  return e;
}
export const searchWindow = (keys: number[], m: Model): number => 2 * maxError(keys, m) + 1;

// A B-tree / binary search over n sorted keys costs about ceil(log2 n) comparisons, regardless of the distribution.
export const binarySearchCost = (n: number): number => Math.max(1, Math.ceil(Math.log2(n)));
