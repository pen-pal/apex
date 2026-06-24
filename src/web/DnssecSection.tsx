// DNSSEC, made visible. A signed delegation chain from the root trust anchor down to an
// A record: each zone publishes a DNSKEY, the parent holds a DS (a real SHA-256 of the
// child's key) and signs it, and the leaf zone signs the answer. The resolver validates
// link by link. Flip a tamper switch — corrupt a DS digest, a parent's RRSIG, or the
// leaf signature — and watch validation turn from SECURE to BOGUS at exactly that link.
// Real logic in dnssec.ts: real SHA-256 digests, real (toy-modulus) RSA signatures.
import { useMemo, useState } from 'react';
import { demoZones, validateChain, digestKey, type Leaf } from './dnssec';

const LEAF: Leaf = { owner: 'www.example.com', type: 'A', value: '93.184.216.34' };

export function DnssecSection() {
  const zones = useMemo(demoZones, []);
  const [tamper, setTamper] = useState<{ dsAtZone?: number; sigAtZone?: number; leafSig?: boolean }>({});

  const v = useMemo(() => validateChain(zones, LEAF, tamper), [zones, tamper]);
  const set = (t: typeof tamper) => setTamper((cur) => (JSON.stringify(cur) === JSON.stringify(t) ? {} : t));

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>DNSSEC — a signed path from the root to the answer</h2></div>
        <p className="jsec-sub">
          Plain DNS will believe anyone. DNSSEC fixes that with a chain of signatures anchored at a single trusted key — the root’s.
          Each zone’s parent vouches for it with a <strong>DS</strong> record (a SHA-256 hash of the child’s key) that the parent
          <em> signs</em>; the zone then signs its own records. Validate the chain, then break a link and watch it go bogus.
        </p>

        <div className="dsec-tampers">
          <span>Tamper:</span>
          <button className={tamper.dsAtZone === 1 ? 'on' : ''} onClick={() => set({ dsAtZone: 1 })}>corrupt com’s DS</button>
          <button className={tamper.sigAtZone === 2 ? 'on' : ''} onClick={() => set({ sigAtZone: 2 })}>break com’s RRSIG</button>
          <button className={tamper.leafSig ? 'on' : ''} onClick={() => set({ leafSig: true })}>forge the A record</button>
        </div>

        <div className={`dsec-banner ${v.secure ? 'secure' : 'bogus'}`}>
          {v.secure ? '🔒 SECURE — every link from the root anchor to the answer validated' : '⛔ BOGUS — chain broken; a real resolver returns SERVFAIL'}
        </div>

        <ol className="dsec-chain">
          {v.steps.map((s, i) => {
            const z = s.kind === 'anchor' ? zones[0] : s.kind === 'leaf' ? zones[2] : zones[i];
            return (
              <li key={i} className={`dsec-link ${s.ok ? 'ok' : 'bad'} ${i === v.brokeAt ? 'broke' : ''}`}>
                <div className="dsec-icon">{s.kind === 'anchor' ? '⚓' : s.kind === 'ds' ? '🔗' : '✍️'}</div>
                <div className="dsec-body">
                  <div className="dsec-label">{s.label} <span className="dsec-status">{s.ok ? '✓' : '✗'}</span></div>
                  <div className="dsec-detail">{s.detail}</div>
                  {z && (s.kind === 'anchor' || s.kind === 'ds') && (
                    <div className="dsec-keyline">
                      DNSKEY <code>n={String((s.kind === 'anchor' ? zones[0] : zones[i]).key.n)} e={String((s.kind === 'anchor' ? zones[0] : zones[i]).key.e)}</code>
                      {s.kind === 'ds' && <> · DS <code>{digestKey(zones[i].key).slice(0, 16)}…</code></>}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        <p className="dsec-foot">
          The same idea as a TLS certificate chain, but for a different trust anchor: instead of a CA root signing certificates, the DNS
          <em> root</em> signs delegations. In real DNSSEC a zone splits its key into a long-lived <strong>KSK</strong> (hashed into the
          parent’s DS) and a working <strong>ZSK</strong> (signs the RRsets); the digests are SHA-256 and the signatures are RSA, ECDSA,
          or Ed25519. Note what DNSSEC does <em>not</em> do: it authenticates records, it doesn’t encrypt them — that’s what DoH/DoT add.
        </p>
      </section>
    </div>
  );
}
