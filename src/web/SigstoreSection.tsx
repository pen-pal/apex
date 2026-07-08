// Sigstore keyless signing, made visible. A short flow of how a release is signed with no long-lived key, then the
// verification that trips people up: the cert is expired by the time you check, so trust comes from the identity in it
// and the Rekor log's timestamp, not the cert's own validity. Toggle the three checks and watch it accept or reject.
// Model + tests in sigstore.ts.
import { useMemo, useState } from 'react';
import { verifyBundle, type Bundle } from './sigstore';

const EXPECTED = 'github.com/acme/app · release.yml @ v2.1.0';
const WRONG = 'github.com/evil-fork/app · build.yml @ main';

const STEPS = [
  ['sign', 'sign the artifact with a fresh ephemeral keypair'],
  ['fulcio', 'prove identity over OIDC → Fulcio issues a 10-min cert binding the key to that identity'],
  ['rekor', 'log the signature + cert in Rekor (a transparency log) — get a signed timestamp'],
  ['discard', 'throw the private key away — there is nothing to leak or rotate'],
];

export function SigstoreSection() {
  const [b, setB] = useState<Bundle>({ sigValid: true, identityMatches: true, inRekor: true });
  const r = useMemo(() => verifyBundle(b), [b]);
  const flip = (k: keyof Bundle) => setB((s) => ({ ...s, [k]: !s[k] }));

  return (
    <div className="sgs">
      <div className="sgs-flow">
        <div className="sgs-lbl">how it was signed (no key kept)</div>
        <div className="sgs-steps">
          {STEPS.map(([k, txt], i) => (
            <div key={k} className="sgs-step"><span className="sgs-step-n">{i + 1}</span><span>{txt}</span></div>
          ))}
        </div>
      </div>

      <div className="sgs-verify">
        <div className="sgs-lbl">now verify it — you trust exactly one signer</div>
        <div className="sgs-expected">expected identity: <code>{EXPECTED}</code></div>
        <div className="sgs-checks">
          <label className={`sgs-check ${b.sigValid ? 'ok' : 'bad'}`}><input type="checkbox" checked={b.sigValid} onChange={() => flip('sigValid')} /> signature verifies against the cert’s key</label>
          <label className={`sgs-check ${b.identityMatches ? 'ok' : 'bad'}`}><input type="checkbox" checked={b.identityMatches} onChange={() => flip('identityMatches')} /> cert identity = the expected signer</label>
          <label className={`sgs-check ${b.inRekor ? 'ok' : 'bad'}`}><input type="checkbox" checked={b.inRekor} onChange={() => flip('inRekor')} /> entry present in the Rekor log</label>
        </div>
        <div className="sgs-bundle">
          <span>cert identity: <code className={b.identityMatches ? '' : 'sgs-wrong'}>{b.identityMatches ? EXPECTED : WRONG}</code></span>
          <span className="sgs-expired">⚠ this cert expired 94 days ago — it was only valid for 10 minutes</span>
        </div>
        <div className={`sgs-verdict ${r.ok ? 'sgs-ok' : 'sgs-bad'}`}>
          <b>{r.ok ? '✓ trusted' : `✗ rejected (${r.reject})`}</b> — {r.reason}
        </div>
      </div>

      <p className="sgs-foot">
        Signing software the old way means guarding a private key for years — and most projects do it badly or not at
        all, which is how a compromised maintainer (xz-utils) or build server (SolarWinds) poisons everyone downstream.
        <strong> Sigstore</strong> removes the key: you authenticate as an <strong>identity</strong> (a person’s SSO, or
        more powerfully a CI workflow like <code>github.com/acme/app</code>’s release job), <strong>Fulcio</strong> mints
        a throwaway certificate for it, and <strong>Rekor</strong> — the same transparency-log idea as Certificate
        Transparency — makes every signature public and timestamped. Verification then checks the identity you expect and
        the log entry, not a key you have to trust forever. It’s what backs <code>cosign</code>, npm and PyPI provenance,
        and GitHub’s artifact attestations. The catch is the flip side: your trust root is now the OIDC provider and the
        log operators. (Sigstore: Fulcio + Rekor.)
      </p>
    </div>
  );
}
