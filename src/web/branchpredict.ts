// Branch prediction — how a CPU guesses which way a branch will go BEFORE it knows, so the pipeline
// doesn't stall waiting for the condition. A wrong guess wastes the partially-filled pipeline (a
// misprediction penalty of ~15-20 cycles on a modern core), so accuracy matters enormously. The classic
// predictor is a 2-bit SATURATING COUNTER per branch: states strong-NT(0), weak-NT(1), weak-T(2),
// strong-T(3); predict taken when the counter is in a "taken" state, and nudge it toward the actual
// outcome. The 2 bits add hysteresis: one surprising outcome doesn't immediately flip the prediction,
// so a loop branch that's taken many times then falls through ONCE (the loop exit) only mispredicts
// once per loop instead of twice as a 1-bit predictor would. Reference: Smith 1981; Hennessy & Patterson.

export type Predictor = '1bit' | '2bit';
export interface Step { actual: boolean; predicted: boolean; correct: boolean; stateBefore: number; stateAfter: number }
export interface PredictResult { steps: Step[]; mispredictions: number; accuracy: number }

// 1-bit: state is just "what happened last time". 2-bit: a 0..3 saturating counter, predict T if >= 2.
const predictFrom = (kind: Predictor, state: number) => (kind === '1bit' ? state === 1 : state >= 2);
const update = (kind: Predictor, state: number, taken: boolean): number =>
  kind === '1bit'
    ? (taken ? 1 : 0)
    : Math.max(0, Math.min(3, state + (taken ? 1 : -1)));

/** Run a predictor over a sequence of actual outcomes (true = branch taken). */
export function simulate(outcomes: boolean[], kind: Predictor, initial: number): PredictResult {
  let state = initial;
  let mispredictions = 0;
  const steps: Step[] = outcomes.map((actual) => {
    const predicted = predictFrom(kind, state);
    const correct = predicted === actual;
    if (!correct) mispredictions++;
    const stateBefore = state;
    state = update(kind, state, actual);
    return { actual, predicted, correct, stateBefore, stateAfter: state };
  });
  return { steps, mispredictions, accuracy: outcomes.length ? (outcomes.length - mispredictions) / outcomes.length : 1 };
}

/** A loop branch: taken `body` times then a single fall-through (the exit), repeated `iters` times. */
export const loopPattern = (body: number, iters: number): boolean[] =>
  Array.from({ length: iters }, () => [...Array(body).fill(true), false]).flat();
