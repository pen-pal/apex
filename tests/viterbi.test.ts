import { describe, it, expect } from 'vitest';
import { encode, decode, encStep } from '../src/web/viterbi';

describe('convolutional encoder — rate 1/2, K=3, generators (7,5)', () => {
  it('matches hand-computed generator outputs from state 0', () => {
    // G1=111: u^m1^m2 ; G2=101: u^m2. From state 0 (m1=m2=0), input 1 → both taps = 1 → "11".
    expect(encStep(0, 1)).toEqual({ out: [1, 1], next: 2 });
    expect(encStep(0, 0)).toEqual({ out: [0, 0], next: 0 });
    // state 2 means m1=1,m2=0: input 0 → o1=0^1^0=1, o2=0^0=0 → "10", shift to state 1
    expect(encStep(2, 0)).toEqual({ out: [1, 0], next: 1 });
  });

  it('encodes 101 to the hand-derived codeword and flushes to state 0', () => {
    // Hand trace of 1,0,1 + flush 0,0: 11 10 00 10 11
    const e = encode([1, 0, 1]);
    expect(e.codeword).toEqual([1, 1, 1, 0, 0, 0, 1, 0, 1, 1]);
    expect(e.transitions[e.transitions.length - 1].to).toBe(0); // terminated in state 0
  });
});

describe('Viterbi decoder', () => {
  it('decodes a clean codeword with zero corrections', () => {
    const e = encode([1, 0, 1]);
    const d = decode(e.codeword);
    expect(d.decoded).toEqual([1, 0, 1]);
    expect(d.corrections).toEqual([]);
    expect(d.endState).toBe(0); // traceback returns to state 0
  });

  it('CORRECTS a single bit error (the whole point of FEC)', () => {
    const e = encode([1, 0, 1]);
    const recv = [...e.codeword];
    recv[2] ^= 1; // flip one received bit
    const d = decode(recv);
    expect(d.decoded).toEqual([1, 0, 1]); // message still recovered
    expect(d.corrections).toEqual([2]); // and it pinpoints exactly the flipped position
  });

  it('round-trips several messages and corrects a flip in each', () => {
    for (const msg of [[0], [1], [1, 1, 0, 1], [1, 0, 1, 1, 0], [0, 0, 1, 0, 1, 1]]) {
      const clean = encode(msg).codeword;
      expect(decode(clean).decoded).toEqual(msg);
      expect(decode(clean).corrections).toEqual([]);
      // flip the middle bit — within this code's 2-error correcting power
      const corrupted = [...clean];
      corrupted[Math.floor(corrupted.length / 2)] ^= 1;
      expect(decode(corrupted).decoded).toEqual(msg);
      expect(decode(corrupted).corrections.length).toBe(1);
    }
  });

  it('CORRECTS TWO separated bit errors from a hand-stated received word (full d_free=5 power)', () => {
    // Direct decoder anchor: the codeword for [1,0,1] is 11 10 00 10 11. Independently flip two
    // well-separated received bits — position 0 (1→0) and position 6 (1→0) — and write the
    // corrupted word out by hand. d_free=5 ⇒ up to floor((5-1)/2)=2 errors are correctable.
    const received = [0, 1, /*|*/ 1, 0, /*|*/ 0, 0, /*|*/ 0, 0, /*|*/ 1, 1];
    const d = decode(received);
    expect(d.decoded).toEqual([1, 0, 1]); // both errors corrected, message recovered
    expect(d.corrections).toEqual([0, 6]); // and it pinpoints exactly the two flipped positions
  });

  it('the surviving trellis path is marked for every stage', () => {
    const d = decode(encode([1, 0, 1]).codeword);
    expect(d.stages.length).toBe(5); // 3 message + 2 flush stages
    for (const st of d.stages) expect(st.edges.some((e) => e.ml)).toBe(true); // an ML edge per stage
  });
});
