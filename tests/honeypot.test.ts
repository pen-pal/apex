import { describe, it, expect } from 'vitest';
import { honeypotDetect, idsDetect, confusion, attackerProbesDecoy, type Conn } from '../src/web/honeypot';

// Independent oracle: hand-built traffic with the alerts and confusion counts worked out from the detector
// definitions. Legit hosts connect to real services; a benign backup job is chatty; the attacker scans. The point
// is the contrast — the honeypot has zero false positives by construction, the threshold IDS does not.

const DECOY = 'decoy';
const TRAFFIC: Conn[] = [
  { src: 'alice', dst: 'web' }, { src: 'alice', dst: 'web' },
  { src: 'backup', dst: 'db' }, { src: 'backup', dst: 'db' }, { src: 'backup', dst: 'db' }, { src: 'backup', dst: 'db' }, // chatty but benign
  { src: 'attacker', dst: 'web', attack: true }, { src: 'attacker', dst: 'db', attack: true },
  { src: 'attacker', dst: 'backup', attack: true }, { src: 'attacker', dst: DECOY, attack: true }, // the attacker probes the decoy
];

describe('honeypotDetect', () => {
  it('flags exactly the sources that touch the decoy', () => {
    expect(honeypotDetect(TRAFFIC, DECOY)).toEqual(['attacker']);
  });
  it('flags nobody when no one touches the decoy', () => {
    expect(honeypotDetect(TRAFFIC.filter((c) => c.dst !== DECOY), DECOY)).toEqual([]);
  });
});

describe('idsDetect (threshold on connection count)', () => {
  it('flags every source at or above the threshold', () => {
    expect(idsDetect(TRAFFIC, 4).sort()).toEqual(['attacker', 'backup']); // both made >= 4 attempts
    expect(idsDetect(TRAFFIC, 5)).toEqual([]);                             // nobody made 5
  });
});

describe('the contrast — honeypot precision vs threshold false alarms', () => {
  it('honeypot: catches the attacker with ZERO false positives', () => {
    const c = confusion(TRAFFIC, honeypotDetect(TRAFFIC, DECOY));
    expect(c).toEqual({ tp: 1, fp: 0, fn: 0 });
  });
  it('threshold IDS at T=4: catches the attacker but false-flags the benign backup host', () => {
    const c = confusion(TRAFFIC, idsDetect(TRAFFIC, 4));
    expect(c.tp).toBe(1);
    expect(c.fp).toBe(1); // backup
  });
});

describe('attackerProbesDecoy — realism vs fingerprinting skill (the honeypot recall trade-off)', () => {
  it('a convincing decoy is probed; a fake one is skipped', () => {
    expect(attackerProbesDecoy(3, 3)).toBe(true);
    expect(attackerProbesDecoy(3, 2)).toBe(true);
    expect(attackerProbesDecoy(1, 2)).toBe(false); // too obviously fake — fingerprinted and avoided
  });
  it('when the attacker skips the decoy, the honeypot misses it (a false negative)', () => {
    const skipped = TRAFFIC.filter((c) => !(c.src === 'attacker' && c.dst === DECOY));
    expect(honeypotDetect(skipped, DECOY)).toEqual([]);
    expect(confusion(skipped, honeypotDetect(skipped, DECOY)).fn).toBe(1); // attacker went undetected by the honeypot
  });
});
