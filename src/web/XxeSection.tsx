// XXE, made visible. Pick an attack variant (file disclosure, SSRF, or the billion-laughs DoS), see its XML
// payload, and toggle the three parser defenses. Watch the outcome and the step-by-step flow — and notice that
// only disabling DTD processing stops every variant, while narrower settings each miss one. The billion-laughs
// expansion is drawn as a bar chart climbing from bytes to gigabytes. Real model from xxe.ts.
import { useState } from 'react';
import { parse, payloadText, billionLaughsSizes, type Attack, type Config } from './xxe';

const ATTACKS: { key: Attack; label: string }[] = [
  { key: 'file', label: 'File disclosure' }, { key: 'ssrf', label: 'SSRF (metadata)' }, { key: 'billion-laughs', label: 'Billion laughs (DoS)' },
];
const ACTOR: Record<string, string> = { attacker: 'a', parser: 'p', target: 't' };
const fmt = (b: number) => (b >= 1e9 ? (b / 1e9) + ' GB' : b >= 1e6 ? (b / 1e6) + ' MB' : b >= 1e3 ? (b / 1e3) + ' KB' : b + ' B');

export function XxeSection() {
  const [attack, setAttack] = useState<Attack>('file');
  const [disableDtd, setDisableDtd] = useState(false);
  const [disableExt, setDisableExt] = useState(false);
  const [limit, setLimit] = useState(false);

  const cfg: Config = { allowDtd: !disableDtd, allowExternalEntities: !disableExt, expansionLimit: limit ? 1e6 : 1e12 };
  const r = parse(attack, cfg);
  const sizes = billionLaughsSizes(9, 10, 3);
  const maxSize = sizes[sizes.length - 1];

  const verdict = r.outcome === 'blocked'
    ? { cls: 'ok', text: <><b>✓ BLOCKED</b> — {r.blockedBy}.</> }
    : r.outcome === 'dos'
      ? { cls: 'bad', text: <><b>⚠ DENIAL OF SERVICE</b> — a few lines expanded to {(r.expandedBytes! / 1e9).toFixed(0)} GB and exhausted memory.</> }
      : r.outcome === 'file-read'
        ? { cls: 'bad', text: <><b>⚠ FILE DISCLOSED</b> — the server read a local file and returned it.</> }
        : { cls: 'bad', text: <><b>⚠ SSRF</b> — the server fetched internal cloud metadata for the attacker.</> };

  return (
    <div className="xxe">
      <p className="xxe-intro">
        XML lets an inline DTD define <strong>entities</strong> (text macros) whose value can be pulled from an
        <strong> external</strong> file or URL. A parser that trusts this will read <code>file:///etc/passwd</code>,
        fetch internal URLs, or blow up on self-referential entities — all from XML an attacker uploads. Pick a
        variant:
      </p>

      <div className="xxe-tabs">
        {ATTACKS.map((a) => <button key={a.key} type="button" className={`xxe-tab ${attack === a.key ? 'on' : ''}`} onClick={() => setAttack(a.key)}>{a.label}</button>)}
      </div>

      <pre className="xxe-payload">{payloadText(attack)}</pre>

      <div className="xxe-defenses">
        <label className={`xxe-def ${disableDtd ? 'on' : ''}`}><input type="checkbox" checked={disableDtd} onChange={(e) => setDisableDtd(e.target.checked)} /> disable DTD processing <i>(the complete fix)</i></label>
        <label className={`xxe-def ${disableExt ? 'on' : ''}`}><input type="checkbox" checked={disableExt} onChange={(e) => setDisableExt(e.target.checked)} /> disable external entities</label>
        <label className={`xxe-def ${limit ? 'on' : ''}`}><input type="checkbox" checked={limit} onChange={(e) => setLimit(e.target.checked)} /> entity-expansion limit (1 MB)</label>
      </div>

      <div className={`xxe-verdict ${verdict.cls}`}>{verdict.text}</div>

      <ol className="xxe-timeline">
        {r.steps.map((s, i) => (
          <li key={i} className={`xxe-step ${s.blocked ? 'blocked' : ''}`}>
            <span className={`xxe-actor ${ACTOR[s.actor]}`}>{s.actor}</span>
            <span className="xxe-detail">{s.detail}</span>
            {s.blocked && <span className="xxe-x">✕</span>}
          </li>
        ))}
      </ol>

      {attack === 'billion-laughs' && (
        <div className="xxe-bl">
          <div className="xxe-bl-h">entity expansion — 9 levels, each ×10</div>
          {sizes.map((sz, i) => (
            <div key={i} className="xxe-bl-row">
              <span className="xxe-bl-lvl">&{'abcdefghij'[i]};</span>
              <div className="xxe-bl-track"><div className="xxe-bl-fill" style={{ width: `${(Math.log10(sz) / Math.log10(maxSize)) * 100}%` }} /></div>
              <span className="xxe-bl-sz">{fmt(sz)}</span>
            </div>
          ))}
        </div>
      )}

      <p className="xxe-foot">
        The reason XXE is so common is that XML parsers historically enabled external-entity resolution
        <em> by default</em>, and XML hides in places you forget are XML: SOAP and SAML messages, SVG and DOCX/XLSX
        uploads (they're zipped XML), RSS feeds, config files, and old REST APIs. So an “image uploader” or a
        “single sign-on” endpoint quietly parses attacker-controlled XML with a library that will happily read
        your disk. The defenses form a clear hierarchy: the one that matters is <strong>turn off DOCTYPE/DTD
        processing entirely</strong> (<code>disallow-doctype-decl</code>, <code>FEATURE_SECURE_PROCESSING</code>,
        <code> libxml_disable_entity_loader</code>) — DTDs are essentially never needed in modern data XML, and
        disabling them kills file reads, SSRF, and billion-laughs in one move. Blocking only external entities
        leaves the internal-entity DoS open; only capping expansion leaves file/SSRF open — which is why “disable
        the whole feature” beats “patch each symptom.” XXE is the XML cousin of the same theme running through
        SSRF, ARP spoofing and DNS rebinding: an unauthenticated, over-helpful feature trusted by default.
        (OWASP XXE Prevention; CWE-611, CWE-776.)
      </p>
    </div>
  );
}
