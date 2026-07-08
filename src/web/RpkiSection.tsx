// RPKI Route Origin Validation, made visible — the defense for the BGP-hijack section. The prefix owner signed a ROA;
// a router doing ROV classifies each announcement Valid / Invalid / NotFound and drops Invalid. Pick an announcement
// (legit, same-prefix hijack, sub-prefix hijack, unsigned) and toggle ROV to watch the hijack get stopped — or slip
// through when ROV is off. Model + tests in rpki.ts.
import { useMemo, useState } from 'react';
import { validate, accept, DEFAULT_ROAS, ANNOUNCEMENTS } from './rpki';

const BADGE: Record<string, string> = { Valid: 'rpki-valid', Invalid: 'rpki-invalid', NotFound: 'rpki-notfound' };

export function RpkiSection() {
  const roas = useMemo(() => DEFAULT_ROAS(), []);
  const anns = useMemo(() => ANNOUNCEMENTS(), []);
  const [rov, setRov] = useState(true);
  const [idx, setIdx] = useState(1); // start on the same-prefix hijack

  const ann = anns[idx];
  const result = useMemo(() => validate(roas, ann), [roas, ann]);
  const accepted = accept(result.validity, rov);
  const isHijack = ann.label.includes('hijack');

  return (
    <div className="rpki">
      <div className="rpki-top">
        <div className="rpki-roa">
          <div className="rpki-lbl">the signed ROA (published by the prefix owner)</div>
          {roas.map((r) => (
            <code key={r.prefix} className="rpki-roa-line">{r.prefix} → AS{r.origin} · maxLength /{r.maxLength} <span className="rpki-sig">✓ signed</span></code>
          ))}
        </div>
        <label className="rpki-rov"><input type="checkbox" checked={rov} onChange={(e) => setRov(e.target.checked)} /> Route Origin Validation on the router</label>
      </div>

      <div className="rpki-anns">
        <span className="rpki-lbl2">a BGP announcement arrives:</span>
        {anns.map((a, i) => (
          <button key={a.label} type="button" className={idx === i ? 'on' : ''} onClick={() => setIdx(i)}>{a.label}</button>
        ))}
      </div>

      <div className="rpki-detail">
        <div className="rpki-ann"><code>{ann.prefix}</code> originated by <code>AS{ann.origin}</code></div>
        <div className={`rpki-result ${BADGE[result.validity]}`}>
          <span className="rpki-badge">{result.validity}</span>
          <span className="rpki-reason">{result.reason}</span>
        </div>
        <div className={`rpki-decision ${accepted ? 'rpki-in' : 'rpki-drop'}`}>
          {accepted
            ? (result.validity === 'Invalid'
              ? <>→ <b>route installed</b> — ROV is off, so the router doesn’t check the ROA and the {isHijack ? 'hijack succeeds, exactly as in the BGP-hijack section' : 'route is accepted'}.</>
              : <>→ <b>route installed</b> — {result.validity === 'Valid' ? 'authorized origin.' : 'unsigned space isn’t dropped, so it’s accepted (RPKI’s coverage gap).'}</>)
            : <>→ <b>dropped by ROV</b> — the router rejects the Invalid announcement, so {isHijack ? 'the hijack never enters the routing table. This is the fix.' : 'the route is not installed.'}</>}
        </div>
      </div>

      <p className="rpki-foot">
        BGP has no built-in idea of who <em>owns</em> a prefix, which is the whole reason the hijack in the other section
        works. <strong>RPKI</strong> adds that idea out of band: the RIR that allocated your address block signs a
        certificate, and you sign a <strong>ROA</strong> saying which AS may originate it, up to what length. Routers
        fetch validated ROAs and run <strong>Route Origin Validation</strong> on every announcement — <em>Valid</em> (a
        ROA authorizes this origin), <em>Invalid</em> (a ROA exists but this origin or length isn’t allowed — a hijack),
        or <em>NotFound</em> (unsigned space). Most drop Invalid and keep the rest. Its limits are real: it only checks
        the <strong>origin</strong> AS, not the whole path (a hijacker can forge a valid-looking origin — that needs
        BGPsec/ASPA), and it only helps for prefixes that have a ROA, so adoption is the game. (RFC 6811.)
      </p>
    </div>
  );
}
