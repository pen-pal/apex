import { describe, it, expect } from 'vitest';
import { KDFS, byId, attackerGuessesPerSec, crackSeconds, humanTime, DEFENDER_HASH_SECONDS } from '../src/web/pwhash';

describe('KDF ladder', () => {
  it('memory and GPU-resistance improve over the generations', () => {
    expect(byId('argon2').memoryKiB).toBeGreaterThan(byId('scrypt').memoryKiB);
    expect(byId('scrypt').memoryKiB).toBeGreaterThan(byId('bcrypt').memoryKiB);
    expect(byId('pbkdf2').gpuAdvantage).toBeGreaterThan(byId('argon2').gpuAdvantage); // memory-hardness kills the GPU edge
  });
});

describe('attacker throughput', () => {
  it('on plain CPU every KDF is equal (defender tuned them to the same cost)', () => {
    const cores = 1000;
    const cpu = KDFS.map((k) => attackerGuessesPerSec(k, cores, false));
    expect(new Set(cpu).size).toBe(1); // identical on CPU
    expect(cpu[0]).toBe(cores / DEFENDER_HASH_SECONDS);
  });

  it('a GPU farm helps crack PBKDF2 far more than Argon2', () => {
    const pb = attackerGuessesPerSec(byId('pbkdf2'), 1000, true);
    const ar = attackerGuessesPerSec(byId('argon2'), 1000, true);
    expect(pb / ar).toBeGreaterThan(100); // PBKDF2 gets a ~1000× GPU boost; Argon2 ~1.5×
  });
});

describe('crack time', () => {
  it('grows exponentially with password entropy', () => {
    const pb = byId('pbkdf2');
    const t40 = crackSeconds(pb, 40, 1000, true);
    const t60 = crackSeconds(pb, 60, 1000, true);
    expect(t60 / t40).toBeCloseTo(Math.pow(2, 20), 0); // 20 more bits ≈ 2^20× longer
  });

  it('Argon2 stays far harder than PBKDF2 to crack under a GPU farm', () => {
    const e = 50, cores = 100_000;
    expect(crackSeconds(byId('argon2'), e, cores, true)).toBeGreaterThan(crackSeconds(byId('pbkdf2'), e, cores, true) * 100);
  });

  it('humanTime renders sensible units', () => {
    expect(humanTime(45)).toBe('45 s');
    expect(humanTime(3600 * 5)).toBe('5.0 h');
    expect(humanTime(Infinity)).toBe('∞');
  });
});
