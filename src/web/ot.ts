// 1-out-of-2 Oblivious Transfer (OT) — the strange handshake at the root of secure two-party computation.
// The sender holds two secrets m0, m1. The receiver wants exactly ONE of them, say m_b, and the protocol
// guarantees two things at once: the receiver learns m_b and NOTHING about m_{1-b}, while the sender never
// finds out WHICH one (b) the receiver took. Neither party trusts the other, yet both constraints hold.
// OT is "complete" for multiparty computation: garbled circuits, private set intersection, and most MPC
// are built on top of it. We implement the classic Even–Goldreich–Lempel (EGL) RSA construction on the
// project's toy RSA. Reference: Even, Goldreich & Lempel, "A Randomized Protocol for Signing Contracts"
// (CACM 1985); Rabin (1981).

import { N, E, D, modpow } from './blindsig';

export interface OtTranscript {
  x0: number; x1: number;   // sender's two random pads (public)
  v: number;                // receiver's masked query (hides b)
  enc0: number; enc1: number; // sender's two encrypted messages
  k: number;                // receiver's secret blinding value
  choice: 0 | 1;
  output: number;           // what the receiver decrypts — must equal m_choice
  otherAttempt: number;     // what the SAME decryption step yields for the un-chosen branch (garbled)
}

const sub = (a: number, b: number) => ((a - b) % N + N) % N;

/** Run the EGL 1-2 OT end to end. x0,x1,k are the protocol's random values, passed in so the run is a pure
 *  function (the UI/tests supply them; in reality they're fresh randomness).
 *  Steps: sender publishes (N,e) + randoms x0,x1.  Receiver picks b, secret k, sends v = x_b + k^e.
 *  Sender (not knowing b) replies enc_i = m_i + (v − x_i)^d.  Receiver computes m_b = enc_b − k. */
export function runOT(m0: number, m1: number, choice: 0 | 1, k: number, x0: number, x1: number): OtTranscript {
  const ke = modpow(k, E, N);                         // receiver blinds its choice with k^e
  const v = (((choice === 0 ? x0 : x1) + ke) % N);    // v = x_b + k^e  (mod N)
  // Sender, blind to b, derives a key for EACH branch: k_i = (v − x_i)^d. Only the chosen branch yields k.
  const k0 = modpow(sub(v, x0), D, N);
  const k1 = modpow(sub(v, x1), D, N);
  const enc0 = (m0 + k0) % N;
  const enc1 = (m1 + k1) % N;
  const encChosen = choice === 0 ? enc0 : enc1;
  const encOther = choice === 0 ? enc1 : enc0;
  // Receiver subtracts its own k. For the chosen branch (v−x_b)=k^e so (v−x_b)^d=k → exact recovery.
  return { x0, x1, v, enc0, enc1, k, choice, output: sub(encChosen, k), otherAttempt: sub(encOther, k) };
}
