// Remote attestation — how you trust code running on a machine you don't own. A TEE (Intel SGX/TDX, AMD SEV, a
// confidential VM) runs an enclave that the host OS and cloud operator can't read or tamper with. To convince a remote
// party of that, the CPU's security processor emits a QUOTE: a signed statement carrying a MEASUREMENT (a hash of the
// exact code/VM that was loaded) and the verifier's NONCE, under a key that chains to the hardware manufacturer's root.
// The relying party accepts only if the signature chains to the trusted vendor root (it's genuine TEE hardware, not an
// emulator), the measurement equals the code it expects (unmodified software), and the nonce matches its challenge
// (fresh, not a replayed old quote). Then — and only then — it releases its secret into the enclave. This models that
// three-step check.

export interface Quote { sigChainsToVendorRoot: boolean; measurement: string; nonce: string }

export type Reject = 'signature' | 'measurement' | 'nonce' | null;
export interface Result { ok: boolean; reject: Reject; reason: string }

export function verifyQuote(q: Quote, expectedMeasurement: string, challenge: string): Result {
  if (!q.sigChainsToVendorRoot) {
    return { ok: false, reject: 'signature', reason: 'The quote’s signature doesn’t chain to the hardware vendor’s root, so this isn’t a genuine TEE — it could be an emulator or a spoofed report. Nothing else it claims can be believed.' };
  }
  if (q.measurement !== expectedMeasurement) {
    return { ok: false, reject: 'measurement', reason: `Genuine hardware, but the measurement (${q.measurement}) isn’t the code you expect (${expectedMeasurement}) — the binary was modified or it’s a different image. Don’t send secrets to code you didn’t vet.` };
  }
  if (q.nonce !== challenge) {
    return { ok: false, reject: 'nonce', reason: 'Right hardware and right code, but the nonce doesn’t match your challenge — this is a replayed old quote, not proof the enclave is live right now. An attacker could capture one good quote and reuse it.' };
  }
  return { ok: true, reject: null, reason: 'Genuine TEE, running exactly the expected code, answering this challenge freshly — so you can provision your secret into the enclave, trusting a machine you don’t control and an operator you don’t trust to stay out of it.' };
}
