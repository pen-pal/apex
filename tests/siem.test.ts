import { describe, it, expect } from 'vitest';
import { correlate, score, type Event, type Rule } from '../src/web/siem';

// Independent oracle: hand-built log streams with the alerts worked out by the correlation definition (K failures
// from one source within a W-second window). Expected values are computed from the rule, never from the code.

const fail = (t: number, src: string, attack = false): Event => ({ t, src, kind: 'fail', attack });
const ok = (t: number, src: string): Event => ({ t, src, kind: 'ok' });

describe('correlate — windowed failure count per source', () => {
  it('fires when K failures fall inside the window, not below it', () => {
    const evs = [10, 11, 12, 13, 14].map((t) => fail(t, 'x'));
    expect(correlate(evs, { k: 5, window: 60 }).length).toBe(1);
    expect(correlate(evs, { k: 6, window: 60 }).length).toBe(0); // only 5 failures
  });

  it('misses when the failures are spread beyond the window (false negative from too-tight W)', () => {
    const evs = [10, 11, 12, 13, 14].map((t) => fail(t, 'x'));
    // window 3s: the tightest 5-in-a-row span is 4s, so 5 never fit — at most 4 do
    expect(correlate(evs, { k: 5, window: 3 }).length).toBe(0);
    expect(correlate(evs, { k: 4, window: 3 }).length).toBe(1);
  });

  it('needs the failures close in time: 2 within 15s fires, within 5s does not', () => {
    const evs = [0, 10, 20, 30].map((t) => fail(t, 'x'));
    expect(correlate(evs, { k: 2, window: 5 }).length).toBe(0);
    expect(correlate(evs, { k: 2, window: 15 }).length).toBeGreaterThan(0);
  });

  it('raises one alert per burst, not one per failure', () => {
    const evs = [10, 11, 12, 13, 14].map((t) => fail(t, 'x'));
    expect(correlate(evs, { k: 3, window: 60 }).length).toBe(1);
  });

  it('marks it compromised when a success follows the burst within the window', () => {
    const burst = [10, 11, 12, 13, 14].map((t) => fail(t, 'x'));
    expect(correlate(burst, { k: 5, window: 60 })[0].compromised).toBe(false);
    expect(correlate([...burst, ok(15, 'x')], { k: 5, window: 60 })[0].compromised).toBe(true);
  });

  it('correlates per source — two users failing separately are not combined', () => {
    const evs = [fail(10, 'a'), fail(11, 'b'), fail(12, 'a'), fail(13, 'b')];
    expect(correlate(evs, { k: 3, window: 60 }).length).toBe(0); // each src only has 2 fails
  });
});

describe('score — detection vs false alarms against ground truth', () => {
  const events: Event[] = [
    ...[10, 11, 12, 13, 14].map((t) => fail(t, 'attacker', true)), ok(15, 'attacker'), // the real attack
    fail(100, 'bob'), fail(101, 'bob'), ok(102, 'bob'),                                 // a benign typo burst
    ok(200, 'alice'),                                                                    // benign
  ];

  it('well-tuned rule catches the attacker with no false alarms', () => {
    const s = score(events, { k: 5, window: 60 } as Rule);
    expect(s).toEqual({ detected: true, truePos: 1, falsePos: 0, falseNeg: 0 });
  });

  it('too-loose rule (k=2) also fires on the benign burst — a false positive', () => {
    const s = score(events, { k: 2, window: 60 });
    expect(s.truePos).toBe(1);
    expect(s.falsePos).toBe(1); // bob's two typos
  });

  it('too-tight rule (k=6) misses the attack entirely — a false negative', () => {
    const s = score(events, { k: 6, window: 60 });
    expect(s.detected).toBe(false);
    expect(s.falseNeg).toBe(1);
    expect(s.falsePos).toBe(0);
  });
});
