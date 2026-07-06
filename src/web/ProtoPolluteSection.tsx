// Prototype pollution, made visible (safely — this sandbox models its own prototype and never touches the real
// Object.prototype). Paste a JSON payload, choose the vulnerable or the safe deep-merge, and watch the fallout:
// with the vulnerable merge, a payload containing "__proto__" writes onto the shared prototype, so a BRAND-NEW
// empty object suddenly inherits the attacker's properties — even though the object you merged into looks empty.
// The safe merge drops the dangerous keys and nothing leaks. Real model from protopollute.ts.
import { useMemo, useState } from 'react';
import { demo } from './protopollute';

const PROBES = ['isAdmin', 'role', 'greeting'];
const ATTACK = '{\n  "user": "guest",\n  "__proto__": { "isAdmin": true, "role": "root" }\n}';
const ATTACK2 = '{\n  "user": "guest",\n  "constructor": { "prototype": { "isAdmin": true, "role": "root" } }\n}';
const CLEAN = '{\n  "user": "guest",\n  "prefs": { "theme": "dark" }\n}';

export function ProtoPolluteSection() {
  const [payload, setPayload] = useState(ATTACK);
  const [mode, setMode] = useState<'vulnerable' | 'safe'>('vulnerable');

  const result = useMemo(() => {
    try { return { ok: true as const, ...demo(payload, mode, PROBES) }; }
    catch { return { ok: false as const }; }
  }, [payload, mode]);

  const pollutedKeys = result.ok ? Object.keys(result.polluted) : [];
  const compromised = result.ok && result.freshObjectSees.isAdmin === true;

  return (
    <div className="ppl">
      <p className="ppl-intro">
        A server deep-merges attacker JSON onto a config object. In JavaScript, the key <code>__proto__</code> is
        a live link to the <strong>shared prototype every object inherits from</strong>. A naive merge that
        follows it writes attacker data onto that prototype — so <strong>every object in the program</strong>,
        including ones created later, starts seeing those properties. A filter that blocks only the literal
        <code>__proto__</code> key is dodged by <code>constructor.prototype</code> — a different path to the very
        same object. Edit the payload and merge:
      </p>

      <div className="ppl-presets">
        <button type="button" className="ppl-preset atk" onClick={() => setPayload(ATTACK)}>😈 __proto__ payload</button>
        <button type="button" className="ppl-preset atk" onClick={() => setPayload(ATTACK2)}>😈 constructor.prototype</button>
        <button type="button" className="ppl-preset" onClick={() => setPayload(CLEAN)}>clean config</button>
        <div className="ppl-modes">
          <button type="button" className={`ppl-mode ${mode === 'vulnerable' ? 'on bad' : ''}`} onClick={() => setMode('vulnerable')}>vulnerable merge</button>
          <button type="button" className={`ppl-mode ${mode === 'safe' ? 'on ok' : ''}`} onClick={() => setMode('safe')}>safe merge</button>
        </div>
      </div>

      <textarea className="ppl-json" value={payload} onChange={(e) => setPayload(e.target.value)} spellCheck={false} rows={4} />
      {!result.ok && <div className="ppl-err">⚠ invalid JSON</div>}

      {result.ok && (
        <>
          <div className="ppl-panels">
            <div className="ppl-panel">
              <div className="ppl-ph">the merged object</div>
              <pre className="ppl-obj">{JSON.stringify(result.target, null, 1) || '{}'}</pre>
              <div className="ppl-note">{Object.keys(result.target).length && mode === 'vulnerable' && pollutedKeys.length ? 'looks normal — the attack is nowhere in here' : 'the object you merged into'}</div>
            </div>
            <div className={`ppl-panel ${pollutedKeys.length ? 'danger' : ''}`}>
              <div className="ppl-ph">🌐 the shared prototype</div>
              <pre className="ppl-obj">{JSON.stringify(result.polluted, null, 1)}</pre>
              <div className="ppl-note">{pollutedKeys.length ? `⚠ POLLUTED with ${pollutedKeys.join(', ')}` : 'clean'}</div>
            </div>
          </div>

          <div className={`ppl-fresh ${compromised ? 'danger' : 'ok'}`}>
            <div className="ppl-ph">a brand-new <code>{'{}'}</code> now inherits:</div>
            <div className="ppl-probes">
              {PROBES.map((k) => {
                const v = result.freshObjectSees[k];
                return <div key={k} className={`ppl-probe ${v !== undefined ? 'hit' : ''}`}><span>{'{}'}.{k}</span><b>{v === undefined ? 'undefined' : JSON.stringify(v)}</b></div>;
              })}
            </div>
          </div>

          {compromised && (
            <div className="ppl-impact">☠ <b>impact:</b> a login check like <code>if (user.isAdmin) grantAdmin()</code> now passes for <b>every</b> user — including <code>{'{}'}</code>, empty request bodies, and objects that never saw the payload.</div>
          )}
        </>
      )}

      <p className="ppl-foot">
        The dangerous part is action-at-a-distance: the vulnerability doesn't corrupt the object you're looking
        at — it corrupts the <em>prototype</em>, so the damage shows up in unrelated code that merely reads a
        property. Real impact has ranged from auth bypass (<code>isAdmin</code>) to denial of service (poisoning
        a property that library code trusts) to RCE (polluting fields a template engine or child-process spawn
        reads). It hit lodash, jQuery, and countless query-string / config parsers. Fixes: <strong>drop the
        dangerous keys</strong> <code>__proto__</code>/<code>constructor</code>/<code>prototype</code> during
        merge; parse into a <strong>null-prototype object</strong> (<code>Object.create(null)</code>) or a
        <strong> Map</strong> that has no prototype to pollute; <code>Object.freeze(Object.prototype)</code> as a
        blunt backstop; validate input against a schema; and use <code>Object.defineProperty</code> or structured
        clones instead of recursive assignment. The root lesson is that a <em>shared mutable</em> base object is
        a global variable in disguise — and attacker-reachable writes to it are a global compromise. (Olivier
        Arteau, 2018.)
      </p>
    </div>
  );
}
