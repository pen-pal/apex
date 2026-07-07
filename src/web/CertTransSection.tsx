// Certificate Transparency — a rogue CA forged a cert for your bank, and you set the world's rules. Toggle whether
// browsers enforce CT, whether the attacker logs the forged cert (to get an SCT), and whether you monitor the logs.
// The forged cert is then accepted-and-invisible (no CT), rejected (CT on, not logged), or accepted-but-caught
// (logged → it's in the public Merkle log, and the inclusion proof below shows it there). Model + tests in ct.ts.
import { useMemo, useState } from 'react';
import { certOutcome, logInclusion } from './ct';
import { buildTree } from './merkle';
import { hex } from './sha256';

const ROGUE = 'your-bank.com ⚠ SketchyCA';
const LEGIT = ['google.com', 'wikipedia.org', 'github.com', 'mozilla.org', 'amazon.com', 'cloudflare.com', 'apple.com'];

export function CertTransSection() {
  const [ctEnforced, setCt] = useState(true);
  const [logged, setLogged] = useState(true);
  const [monitored, setMonitored] = useState(true);

  const o = certOutcome(ctEnforced, logged, monitored);
  const certs = logged ? [...LEGIT, ROGUE] : LEGIT; // logging adds the rogue leaf to the public log
  const rogueIdx = certs.length - 1;
  const tree = useMemo(() => buildTree(certs), [logged]);
  const incl = useMemo(() => (logged ? logInclusion(certs, rogueIdx) : null), [logged]);
  const nlev = tree.levels.length;
  const short = (b: Uint8Array) => hex(b).slice(0, 6);

  const toggle = (v: boolean, set: (b: boolean) => void, label: string) => (
    <button type="button" className={`ctlog-tog ${v ? 'ctlog-on' : ''}`} onClick={() => set(!v)}>{v ? '☑' : '☐'} {label}</button>
  );

  return (
    <div className="ctlog">
      <div className="ctlog-cert">
        <span className="ctlog-cert-ico">📜</span>
        <div>
          <strong>Forged certificate for <code>your-bank.com</code></strong>
          <span className="ctlog-cert-sub">issued by a compromised CA you never authorized — cryptographically valid, so a browser can't tell by the signature alone.</span>
        </div>
      </div>

      <div className="ctlog-togs">
        {toggle(ctEnforced, setCt, 'browsers enforce CT')}
        {toggle(logged, setLogged, 'attacker logged the cert')}
        {toggle(monitored, setMonitored, 'you monitor the logs')}
      </div>

      <div className={`ctlog-verdict ctlog-${o.verdict}`}>
        <div className="ctlog-verdict-h">
          <span>browser {o.browserAccepts ? 'accepts ✓' : 'rejects ✗'}</span>
          <span>mis-issuance {o.detected ? 'detected ✓' : 'undetected'}</span>
        </div>
        <p>{
          o.verdict === 'silent-compromise' ? 'Pre-CT world: the forged cert is cryptographically valid, the browser accepts it, and you have no way to know it exists. This is the hole CT was built to close.'
          : o.verdict === 'rejected' ? 'CT enforced and the cert was never logged, so it has no SCT — the browser refuses it outright. To make it work the attacker must log it… which is the trap.'
          : o.verdict === 'caught' ? 'The attacker logged it to get an SCT, so the browser accepts it — but it now sits in a public append-only log, and your monitor spotted a cert for your-bank.com you never requested. Caught: revoke it and pull the CA’s trust.'
          : 'Logged, so it works — and it’s public. You just weren’t watching. Anyone running a monitor (or crt.sh) could still find it; CT makes mis-issuance discoverable even when you personally miss it.'
        }</p>
      </div>

      {logged && incl && (
        <div className="ctlog-log">
          <div className="ctlog-lbl">public CT log — Merkle tree · root = <code>{short(tree.root)}…</code> (the signed tree head)</div>
          <div className="ctlog-tree">
            {Array.from({ length: nlev }, (_, li) => nlev - 1 - li).map((level) => {
              const pathIdx = Math.floor(rogueIdx / 2 ** level);
              const sibIdx = pathIdx ^ 1;
              return (
                <div key={level} className="ctlog-row">
                  {tree.levels[level].map((h, i) => {
                    const isPath = i === pathIdx;
                    const isSib = i === sibIdx && level < nlev - 1;
                    return (
                      <code key={i} className={`ctlog-node ${isPath ? 'ctlog-path' : ''} ${isSib ? 'ctlog-sib' : ''}`}
                        title={level === 0 ? certs[i] : `node ${short(h)}`}>
                        {level === 0 ? (i === rogueIdx ? '⚠ rogue' : certs[i].split('.')[0].slice(0, 5)) : short(h)}
                      </code>
                    );
                  })}
                </div>
              );
            })}
          </div>
          <div className="ctlog-proof">
            <span className={`ctlog-proof-lbl ${incl.verifies ? 'ctlog-ok' : ''}`}>inclusion proof {incl.verifies ? '✓ verifies' : '✗'}</span>
            <span className="ctlog-proof-txt">
              the <b className="ctlog-path-k">rogue leaf</b> plus {incl.proof.length} <b className="ctlog-sib-k">sibling hashes</b> (one per level)
              recompute the root — proof this exact cert is in the log, in {incl.proof.length} hashes instead of the whole log.
            </span>
          </div>
        </div>
      )}

      <p className="ctlog-foot">
        CT doesn't stop mis-issuance — any of hundreds of CAs can still sign a cert for your domain. It makes it
        <strong> undeniable and discoverable</strong>: a working cert must carry an <strong>SCT</strong> (a signed promise
        it was logged), the logs are <strong>append-only Merkle trees</strong> anyone can audit, and monitors watch them
        for your name. The rogue CA is cornered — log it and get caught, or don't and get rejected. Real CT adds
        <em> consistency</em> proofs (the log never rewrote history) and gossip so a log can't show different roots to
        different people. It's how the 2015 Symantec test-cert mis-issuances came to light. (RFC 6962.)
      </p>
    </div>
  );
}
