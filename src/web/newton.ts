// Newton's method — find where a function crosses zero by following its tangent. From a guess x, the
// tangent line f(x) + f'(x)(t−x) hits zero at t = x − f(x)/f'(x); take that as the next guess and repeat.
// When it works it's astonishingly fast: the error roughly SQUARES every step (quadratic convergence),
// so the number of correct digits doubles each iteration — a handful of steps reach machine precision.
// The classic special case is the Babylonian square root: solving x² − a = 0 gives the iteration
// x ← (x + a/x)/2. The catch is robustness — a near-zero derivative, a bad starting point, or an
// inflection can send it shooting off or oscillating, which is why real solvers guard it (bisection
// fallback, damping). Reference: Newton/Raphson; any numerical-analysis text (e.g. Burden & Faires).

export interface NewtonStep { i: number; x: number; fx: number; fpx: number; next: number; error: number }

/** Iterate Newton's method on f with derivative fprime from x0, for n steps. `root` (if known) is used
 *  only to report the error each step so the quadratic convergence is visible. */
export function newton(f: (x: number) => number, fprime: (x: number) => number, x0: number, n: number, root?: number): NewtonStep[] {
  const steps: NewtonStep[] = [];
  let x = x0;
  for (let i = 0; i < n; i++) {
    const fx = f(x), fpx = fprime(x);
    const next = fpx === 0 ? x : x - fx / fpx; // a flat tangent has no finite intercept
    steps.push({ i, x, fx, fpx, next, error: root !== undefined ? Math.abs(x - root) : Math.abs(fx) });
    x = next;
  }
  return steps;
}

/** Babylonian square root: Newton on f(x) = x² − a. */
export const sqrtNewton = (a: number, x0: number, n: number) =>
  newton((x) => x * x - a, (x) => 2 * x, x0, n, Math.sqrt(a));

export interface Fn { label: string; f: (x: number) => number; fprime: (x: number) => number; root: number; x0: number }
export const FUNCTIONS: Record<string, Fn> = {
  '√2  (x²−2)': { label: '√2', f: (x) => x * x - 2, fprime: (x) => 2 * x, root: Math.sqrt(2), x0: 2 },
  'cube root of 5  (x³−5)': { label: '∛5', f: (x) => x ** 3 - 5, fprime: (x) => 3 * x * x, root: Math.cbrt(5), x0: 2 },
  'x³ − x − 2': { label: 'root', f: (x) => x ** 3 - x - 2, fprime: (x) => 3 * x * x - 1, root: 1.5213797068045676, x0: 2 },
};
