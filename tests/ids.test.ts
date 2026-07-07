import { describe, it, expect } from 'vitest';
import { signatureFlags, anomalyFlags, isAttack, outcome, type Kind, type Event } from '../src/web/ids';

// Independent oracle: IDS detection semantics. Signature fires only on known attacks (a DB entry exists); anomaly
// fires at/above the threshold regardless of kind. The tradeoff falls out of that: signature never false-positives
// but misses every novel attack; anomaly catches novel attacks but false-positives on high-scoring benign traffic.
// Asserted from the definitions, not the code's own output.

const ev = (kind: Kind, anomaly: number): Event => ({ id: 'x', kind, desc: '', anomaly });

describe('IDS: signature vs anomaly', () => {
  it('signature fires on known attacks only — misses novel, never on normal', () => {
    expect(signatureFlags(ev('known', 0.9))).toBe(true);
    expect(signatureFlags(ev('novel', 0.9))).toBe(false);
    expect(signatureFlags(ev('normal', 0.9))).toBe(false);
  });
  it('anomaly fires at or above the (inclusive) threshold, regardless of kind', () => {
    expect(anomalyFlags(ev('novel', 0.8), 0.7)).toBe(true);
    expect(anomalyFlags(ev('normal', 0.8), 0.7)).toBe(true);
    expect(anomalyFlags(ev('known', 0.5), 0.7)).toBe(false);
    expect(anomalyFlags(ev('novel', 0.7), 0.7)).toBe(true);
  });
  it('outcome classifies the confusion matrix correctly', () => {
    expect(outcome(true, true)).toBe('true-positive');
    expect(outcome(true, false)).toBe('false-positive');
    expect(outcome(false, true)).toBe('false-negative');
    expect(outcome(false, false)).toBe('true-negative');
  });
  it('the tradeoff: signature misses a novel attack, anomaly catches it', () => {
    const novel = ev('novel', 0.99);
    expect(outcome(signatureFlags(novel), isAttack(novel))).toBe('false-negative');
    expect(outcome(anomalyFlags(novel, 0.7), isAttack(novel))).toBe('true-positive');
  });
  it('anomaly false-positives on unusual-but-benign traffic', () => {
    const backup = ev('normal', 0.85);
    expect(outcome(anomalyFlags(backup, 0.7), isAttack(backup))).toBe('false-positive');
  });
});
