// Email authentication, made visible. Pick a scenario — legit mail, a spoofer, a
// tampered body, a forward — and watch SPF, DKIM, and DMARC adjudicate it. SPF checks the
// sending IP; DKIM verifies a real RSA signature over the body (tamper it and it breaks);
// DMARC requires one of them to both pass AND align with the visible From, then applies
// the policy. Real RSA + SHA-256 in mailauth.ts (tested, incl. the spoofing case).
import { useMemo, useState } from 'react';
import { spfCheck, dkimSign, dkimVerify, dmarc, type Policy } from './mailauth';
import { rsaKeygen } from './rsa';

const KEY = rsaKeygen(61n, 53n, 17n); // bank.example DKIM key
const FROM = 'bank.example';
const ALLOWED = ['198.51.100.10'];
const GOOD_BODY = 'Your monthly statement is ready to view.';

type Scn = 'legit' | 'spoof' | 'tamper' | 'forward';
const SCENARIOS: { id: Scn; label: string; senderIp: string; envDomain: string; body: string; resign: boolean }[] = [
  { id: 'legit', label: '✅ Genuine bank email', senderIp: '198.51.100.10', envDomain: FROM, body: GOOD_BODY, resign: true },
  { id: 'spoof', label: '🎭 Spoofer (own server, forged From)', senderIp: '203.0.113.66', envDomain: 'attacker.test', body: 'Click to verify your account!', resign: false },
  { id: 'tamper', label: '✂️ Genuine mail, body altered in transit', senderIp: '198.51.100.10', envDomain: FROM, body: GOOD_BODY + ' PS: wire $5000 to acct 12345.', resign: false },
  { id: 'forward', label: '↪️ Forwarded (SPF breaks, DKIM survives)', senderIp: '203.0.113.99', envDomain: FROM, body: GOOD_BODY, resign: false },
];

export function MailAuthSection() {
  const [scn, setScn] = useState<Scn>('legit');
  const [policy, setPolicy] = useState<Policy>('reject');
  const s = SCENARIOS.find((x) => x.id === scn)!;

  const result = useMemo(() => {
    // DKIM signature is always created by the real bank over the ORIGINAL body
    const sig = dkimSign(GOOD_BODY, KEY);
    const spf = spfCheck(s.senderIp, s.envDomain, ALLOWED);
    const dkim = dkimVerify(s.body, sig, KEY, FROM); // verifies against the delivered body
    const d = dmarc(FROM, spf, dkim, policy);
    return { spf, dkim, d };
  }, [s, policy]);

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>SPF · DKIM · DMARC — is this email really from them?</h2></div>
        <p className="jsec-sub">
          Anyone can put <code>From: bank.example</code> on a message. Three DNS-published records make that claim checkable:
          <strong> SPF</strong> (which servers may send), <strong>DKIM</strong> (a signature over the body), and <strong>DMARC</strong>,
          which insists one of them passes <em>and</em> matches the visible From domain — then says what to do if not.
        </p>

        <div className="mail-pick">
          {SCENARIOS.map((x) => <button key={x.id} className={scn === x.id ? 'on' : ''} onClick={() => setScn(x.id)}>{x.label}</button>)}
        </div>

        <div className="mail-env">
          <div><span>From:</span> <code>noreply@{FROM}</code></div>
          <div><span>sending IP:</span> <code>{s.senderIp}</code></div>
          <div><span>envelope domain:</span> <code>{s.envDomain}</code></div>
          <div className="mail-body"><span>body:</span> “{s.body}”</div>
        </div>

        <div className="mail-checks">
          <div className={`mail-check ${result.spf.pass ? 'ok' : 'bad'}`}>
            <b>SPF</b><span>{result.spf.pass ? '✓ pass' : '✗ fail'}</span>
            <em>{result.spf.pass ? `${s.senderIp} is an authorized sender for ${s.envDomain}` : `${s.senderIp} not authorized for ${s.envDomain}`}</em>
          </div>
          <div className={`mail-check ${result.dkim.pass ? 'ok' : 'bad'}`}>
            <b>DKIM</b><span>{result.dkim.pass ? '✓ pass' : '✗ fail'}</span>
            <em>{result.dkim.pass ? 'signature verifies — body is intact and from bank.example' : 'signature does not verify — body was altered or not signed by bank.example'}</em>
          </div>
          <div className={`mail-check ${result.d.pass ? 'ok' : 'bad'}`}>
            <b>DMARC</b><span>{result.d.pass ? '✓ aligned' : '✗ unaligned'}</span>
            <em>SPF-aligned: {result.d.spfAligned ? 'yes' : 'no'} · DKIM-aligned: {result.d.dkimAligned ? 'yes' : 'no'}</em>
          </div>
        </div>

        <div className="mail-policy">
          DMARC policy: {(['none', 'quarantine', 'reject'] as Policy[]).map((p) => (
            <button key={p} className={policy === p ? 'on' : ''} onClick={() => setPolicy(p)}>p={p}</button>
          ))}
        </div>

        <div className={`mail-verdict ${result.d.action === 'deliver' ? 'ok' : result.d.action === 'reject' ? 'bad' : 'warn'}`}>
          {result.d.action === 'deliver' ? '📥 Delivered to inbox' : result.d.action === 'quarantine' ? '🗑️ Sent to spam (quarantined)' : '⛔ Rejected / bounced'}
          {' — '}{result.d.reason}
        </div>

        <p className="mail-foot">
          The forwarding case is why DMARC accepts <em>either</em> SPF or DKIM: a forwarder relays from its own IP (breaking SPF) but
          doesn’t touch the signed body (DKIM survives). The spoofing case is the crux — an attacker’s server can pass its own
          SPF, but it can’t make that authentication <em>align</em> with <code>bank.example</code>, so DMARC <code>p=reject</code> bounces
          it. (ARC preserves authentication across forwarders; BIMI rewards DMARC-passing senders with a logo.)
        </p>
      </section>
    </div>
  );
}
