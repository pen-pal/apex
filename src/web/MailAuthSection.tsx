// Email authentication, made visible — from the attacker's seat. From: bank.example is free to write; SPF, DKIM,
// and DMARC decide whether it's believed. Drive the three inputs an attacker actually controls — the sending IP,
// the body, and who signed it — and watch the verdict. The lessons you can PRODUCE: a MITM who tampers in transit
// relays from its OWN IP, so SPF fails and the broken DKIM signature fails too → caught; a valid DKIM signature
// from the WRONG domain (d=attacker.test) verifies but doesn't ALIGN with the From → caught; but SPF only
// authenticates the sender, not the content, so a tamper that somehow comes from an authorized IP still passes
// DMARC on SPF alignment — SPF passing does NOT mean the body is intact. Real RSA + SHA-256 in mailauth.ts (tested).
import { useMemo, useState } from 'react';
import { spfCheck, dkimSign, dkimVerify, dmarc, type Policy } from './mailauth';
import { rsaKeygen } from './rsa';

const BANK_KEY = rsaKeygen(61n, 53n, 17n); // bank.example DKIM key
const ATK_KEY = rsaKeygen(71n, 59n, 17n);  // the attacker's own DKIM key (a different domain)
const FROM = 'bank.example';
const ALLOWED = ['198.51.100.10'];
const BANK_IP = '198.51.100.10';
const ATK_IP = '203.0.113.66';
const GOOD_BODY = 'Your monthly statement is ready to view.';
const TAMPERED = GOOD_BODY + ' PS: wire $5000 to acct 12345 immediately.';

type Ip = 'bank' | 'attacker';
type Signer = 'bank' | 'attacker' | 'none';
const PRESETS: { id: string; label: string; ip: Ip; body: string; signer: Signer }[] = [
  { id: 'legit', label: '✅ Genuine bank email', ip: 'bank', body: GOOD_BODY, signer: 'bank' },
  { id: 'mitm', label: '✂️ MITM tampers in transit', ip: 'attacker', body: TAMPERED, signer: 'bank' },
  { id: 'relay', label: '🕵️ Tamper from an authorized relay', ip: 'bank', body: TAMPERED, signer: 'bank' },
  { id: 'unaligned', label: '🎭 Valid DKIM, wrong domain', ip: 'attacker', body: 'Click to verify your account!', signer: 'attacker' },
];

export function MailAuthSection() {
  const [ip, setIp] = useState<Ip>('bank');
  const [body, setBody] = useState(GOOD_BODY);
  const [signer, setSigner] = useState<Signer>('bank');
  const [policy, setPolicy] = useState<Policy>('reject');
  const preset = (p: typeof PRESETS[number]) => { setIp(p.ip); setBody(p.body); setSigner(p.signer); };

  const r = useMemo(() => {
    const senderIp = ip === 'bank' ? BANK_IP : ATK_IP;
    const spf = spfCheck(senderIp, FROM, ALLOWED); // pass+aligned iff the sender is one of bank.example's IPs
    const dkim = signer === 'bank'
      ? dkimVerify(body, dkimSign(GOOD_BODY, BANK_KEY), BANK_KEY, FROM)          // bank signed the ORIGINAL body; d=bank.example
      : signer === 'attacker'
        ? dkimVerify(body, dkimSign(body, ATK_KEY), ATK_KEY, 'attacker.test')    // attacker signs THIS body with their key; d=attacker.test
        : { pass: false, domain: '—' };                                          // unsigned
    const d = dmarc(FROM, spf, dkim, policy);
    return { senderIp, spf, dkim, d };
  }, [ip, body, signer, policy]);

  const tampered = body !== GOOD_BODY;

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>SPF · DKIM · DMARC — is this email really from them?</h2></div>
        <p className="jsec-sub">
          Anyone can put <code>From: bank.example</code> on a message. Three DNS-published records make that claim checkable:
          <strong> SPF</strong> (which server IPs may send for a domain), <strong>DKIM</strong> (a signature over the body), and
          <strong> DMARC</strong>, which insists one of them passes <em>and</em> <strong>aligns</strong> with the visible From domain.
          You control what an attacker controls — drive it and watch what slips through.
        </p>

        <div className="mail-pick">
          {PRESETS.map((p) => <button key={p.id} onClick={() => preset(p)}>{p.label}</button>)}
        </div>

        <div className="mail-compose">
          <div className="mail-row"><span>From:</span> <code>noreply@{FROM}</code> <em>(the attacker just types this)</em></div>
          <div className="mail-row"><span>sending IP:</span>
            <button className={`ma-opt ${ip === 'bank' ? 'on' : ''}`} onClick={() => setIp('bank')}>{BANK_IP} · bank’s server</button>
            <button className={`ma-opt ${ip === 'attacker' ? 'on' : ''}`} onClick={() => setIp('attacker')}>{ATK_IP} · attacker’s server</button>
          </div>
          <div className="mail-row"><span>DKIM signature:</span>
            <button className={`ma-opt ${signer === 'bank' ? 'on' : ''}`} onClick={() => setSigner('bank')}>bank’s key (d={FROM})</button>
            <button className={`ma-opt ${signer === 'attacker' ? 'on' : ''}`} onClick={() => setSigner('attacker')}>attacker re-signs (d=attacker.test)</button>
            <button className={`ma-opt ${signer === 'none' ? 'on' : ''}`} onClick={() => setSigner('none')}>unsigned</button>
          </div>
          <label className="mail-bodyedit"><span>body {tampered && <em className="ma-tamp">✎ altered</em>}:</span>
            <textarea value={body} spellCheck={false} rows={2} onChange={(e) => setBody(e.target.value)} />
          </label>
        </div>

        <div className="mail-checks">
          <div className={`mail-check ${r.spf.pass ? 'ok' : 'bad'}`}>
            <b>SPF</b><span>{r.spf.pass ? '✓ pass' : '✗ fail'}</span>
            <em>{r.spf.pass ? `${r.senderIp} is an authorized sender for ${FROM}` : `${r.senderIp} is not a ${FROM} sender — SPF checks the IP, not the content`}</em>
          </div>
          <div className={`mail-check ${r.dkim.pass ? 'ok' : 'bad'}`}>
            <b>DKIM</b><span>{r.dkim.pass ? `✓ valid · d=${r.dkim.domain}` : '✗ fail'}</span>
            <em>{r.dkim.pass ? `signature verifies over this exact body, signed by ${r.dkim.domain}` : signer === 'none' ? 'no signature present' : 'signature does not verify — the body was altered after signing'}</em>
          </div>
          <div className={`mail-check ${r.d.pass ? 'ok' : 'bad'}`}>
            <b>DMARC</b><span>{r.d.pass ? '✓ aligned' : '✗ unaligned'}</span>
            <em>SPF-aligned: {r.d.spfAligned ? 'yes' : 'no'} · DKIM-aligned (d = From?): {r.d.dkimAligned ? 'yes' : 'no'}</em>
          </div>
        </div>

        <div className="mail-policy">
          DMARC policy: {(['none', 'quarantine', 'reject'] as Policy[]).map((p) => (
            <button key={p} className={policy === p ? 'on' : ''} onClick={() => setPolicy(p)}>p={p}</button>
          ))}
        </div>

        <div className={`mail-verdict ${r.d.action === 'deliver' ? (tampered && r.d.pass ? 'warn' : 'ok') : r.d.action === 'reject' ? 'bad' : 'warn'}`}>
          {r.d.action === 'deliver' ? '📥 Delivered to inbox' : r.d.action === 'quarantine' ? '🗑️ Sent to spam (quarantined)' : '⛔ Rejected / bounced'}
          {' — '}{r.d.reason}
          {r.d.action === 'deliver' && tampered && r.d.spfAligned && !r.d.dkimAligned && <> ⚠️ <b>and the body was tampered</b> — SPF aligned so DMARC passed, but SPF never checked the content. Only DKIM does, and here it wasn’t what aligned.</>}
        </div>

        <p className="mail-foot">
          Read the three together and the attacker’s dilemma is clear. A spoofer on their own server fails SPF for
          <code> bank.example</code> and can’t make DKIM <em>align</em> — they can produce a perfectly valid signature, but only for
          <code> attacker.test</code>, and DMARC demands the authenticated domain match the visible From, so <code>p=reject</code> bounces it.
          The sharp edges: <strong>SPF authenticates the sender, not the content</strong> — a tamper that leaves from an authorized IP (a
          compromised relay, or a mailing list that re-sends) passes DMARC on SPF alignment even though the body changed, because SPF never
          hashed it; only <strong>DKIM</strong> binds the body, and DKIM survives forwarding while SPF doesn’t, which is exactly why DMARC
          accepts <em>either</em>. (ARC preserves authentication across forwarders; BIMI rewards DMARC-passing senders with a logo. RFC 7208 / 6376 / 7489.)
        </p>
      </section>
    </div>
  );
}
