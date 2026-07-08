// Remote attestation, made visible. An enclave's CPU signs a quote (measurement + your nonce); you verify it before
// trusting the remote machine with a secret. Toggle whether the quote is from genuine hardware, runs the expected code,
// and answers your fresh challenge, and watch it accept or reject. Model + tests in attest.ts.
import { useMemo, useState } from 'react';
import { verifyQuote, type Quote } from './attest';

const EXPECT = 'sha256:9f2c…app-v2';
const TAMPERED = 'sha256:1b8e…modified';
const CHALLENGE = 'nonce-7a3f';
const STALE = 'nonce-old-11';

const STEPS = [
  'your code runs in a TEE the host OS & cloud operator can’t read',
  'the CPU security processor signs a quote: measurement (code hash) + your nonce',
  'you verify the quote, then release your secret into the enclave',
];

export function AttestSection() {
  const [genuine, setGenuine] = useState(true);
  const [rightCode, setRightCode] = useState(true);
  const [fresh, setFresh] = useState(true);

  const quote: Quote = useMemo(() => ({
    sigChainsToVendorRoot: genuine,
    measurement: rightCode ? EXPECT : TAMPERED,
    nonce: fresh ? CHALLENGE : STALE,
  }), [genuine, rightCode, fresh]);
  const r = useMemo(() => verifyQuote(quote, EXPECT, CHALLENGE), [quote]);

  return (
    <div className="rat">
      <div className="rat-flow">
        <div className="rat-lbl">how attestation works</div>
        {STEPS.map((s, i) => <div key={i} className="rat-step"><span className="rat-step-n">{i + 1}</span><span>{s}</span></div>)}
      </div>

      <div className="rat-verify">
        <div className="rat-lbl">the quote you received — verify before trusting</div>
        <div className="rat-checks">
          <label className={`rat-check ${genuine ? 'ok' : 'bad'}`}><input type="checkbox" checked={genuine} onChange={(e) => setGenuine(e.target.checked)} /> signature chains to the hardware vendor’s root</label>
          <label className={`rat-check ${rightCode ? 'ok' : 'bad'}`}><input type="checkbox" checked={rightCode} onChange={(e) => setRightCode(e.target.checked)} /> measurement = the code you expect</label>
          <label className={`rat-check ${fresh ? 'ok' : 'bad'}`}><input type="checkbox" checked={fresh} onChange={(e) => setFresh(e.target.checked)} /> nonce = your challenge (fresh)</label>
        </div>
        <div className="rat-quote">
          <span>measurement: <code className={rightCode ? '' : 'rat-wrong'}>{quote.measurement}</code> <span className="rat-exp">expected {EXPECT}</span></span>
          <span>nonce: <code className={fresh ? '' : 'rat-wrong'}>{quote.nonce}</code> <span className="rat-exp">challenge {CHALLENGE}</span></span>
        </div>
        <div className={`rat-verdict ${r.ok ? 'rat-ok' : 'rat-bad'}`}>
          <b>{r.ok ? '✓ secret provisioned' : `✗ rejected (${r.reject})`}</b> — {r.reason}
        </div>
      </div>

      <p className="rat-foot">
        Cloud confidential computing sells a strange promise: run on someone else’s machine, and not even <em>they</em>
        can see your data. A <strong>TEE</strong> — Intel SGX/TDX, AMD SEV, a confidential VM — encrypts an enclave’s
        memory in hardware and blocks the host OS and hypervisor from reading it. But encryption alone is worthless if
        you can’t tell you’re talking to a real enclave running <em>your</em> code, so the trust hinges on
        <strong> attestation</strong>: the silicon vouches, cryptographically, for exactly what booted. It’s the same
        chain-of-trust idea as a TLS certificate — a vendor root signing down to a leaf — but the leaf is a
        <strong> measurement of software</strong>, not a domain name, which is also how <code>Secure Boot</code> and a
        <code> TPM</code> attest a whole machine. Its limit: you’re trusting the hardware vendor and their key, and
        side-channels have broken enclaves before. (Confidential computing; SGX/SEV/TDX remote attestation.)
      </p>
    </div>
  );
}
