// Browser site isolation, made visible. Set the document's COOP and COEP headers and watch two
// things resolve: whether the page becomes crossOriginIsolated (unlocking SharedArrayBuffer and
// high-resolution timers, both disabled for everyone after Spectre), and which cross-origin
// subresources are still allowed to embed under COEP's opt-in rule. Pure policy logic from
// siteisolation.ts (tested against the HTML isolation + Fetch CORP rules). No fake side channels.
import { useMemo, useState } from 'react';
import { isolation, loadSubresource, type COOP, type COEP, type Subresource } from './siteisolation';

const COOPS: COOP[] = ['unsafe-none', 'same-origin-allow-popups', 'same-origin'];
const COEPS: COEP[] = ['unsafe-none', 'require-corp', 'credentialless'];
const SUBS: Subresource[] = [
  { label: '/logo.png (same-origin)', crossOrigin: false, corp: 'none', cors: false },
  { label: 'cdn.other.com/lib.js (no CORP)', crossOrigin: true, corp: 'none', cors: false },
  { label: 'cdn.other.com/opted.js (CORP: cross-origin)', crossOrigin: true, corp: 'cross-origin', cors: false },
  { label: 'api.other.com/data (CORS)', crossOrigin: true, corp: 'none', cors: true },
];

export function IsoSection() {
  const [coop, setCoop] = useState<COOP>('same-origin');
  const [coep, setCoep] = useState<COEP>('require-corp');
  const iso = useMemo(() => isolation(coop, coep), [coop, coep]);
  const loads = useMemo(() => SUBS.map((s) => loadSubresource(coep, s)), [coep]);

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Site isolation — COOP, COEP &amp; the road to crossOriginIsolated</h2></div>
        <p className="jsec-sub">
          After Spectre showed that anything in your process can be read by speculative side channels, browsers disabled
          <code> SharedArrayBuffer</code> and high-res timers — and made you EARN them back by proving nothing untrusted shares your address
          space. Two headers do it: <strong>COOP</strong> gives the page its own context group, and <strong>COEP</strong> forces every
          embedded cross-origin resource to opt in. Get both right and the page is <strong>crossOriginIsolated</strong>.
        </p>

        <div className="iso-pickers">
          <div className="iso-pick">
            <span className="iso-plbl">Cross-Origin-Opener-Policy</span>
            <div className="iso-opts">{COOPS.map((c) => <button key={c} className={coop === c ? 'on' : ''} onClick={() => setCoop(c)}>{c}</button>)}</div>
          </div>
          <div className="iso-pick">
            <span className="iso-plbl">Cross-Origin-Embedder-Policy</span>
            <div className="iso-opts">{COEPS.map((c) => <button key={c} className={coep === c ? 'on' : ''} onClick={() => setCoep(c)}>{c}</button>)}</div>
          </div>
        </div>

        <div className={`iso-status ${iso.crossOriginIsolated ? 'on' : 'off'}`}>
          <div className="iso-badge">{iso.crossOriginIsolated ? '🔒 crossOriginIsolated = true' : '🔓 crossOriginIsolated = false'}</div>
          <div className="iso-feats">
            <span className={iso.ownContextGroup ? 'yes' : 'no'}>{iso.ownContextGroup ? '✓' : '✗'} own browsing-context group</span>
            <span className={iso.sharedArrayBuffer ? 'yes' : 'no'}>{iso.sharedArrayBuffer ? '✓' : '✗'} SharedArrayBuffer</span>
            <span className={iso.highResTimers ? 'yes' : 'no'}>{iso.highResTimers ? '✓' : '✗'} high-resolution timers</span>
          </div>
          <p className="iso-explain">{iso.explain}</p>
        </div>

        <h3 className="iso-h3">Cross-origin subresources under this COEP</h3>
        <div className="iso-subs">
          {loads.map((r, i) => (
            <div key={i} className={`iso-sub ${r.loads ? (r.credentialsStripped ? 'warn' : 'ok') : 'block'}`}>
              <span className="iso-suburl">{r.label}</span>
              <span className="iso-subverdict">{r.loads ? (r.credentialsStripped ? '⚠ loads (no cookies)' : '✓ loads') : '✗ blocked'}</span>
              <span className="iso-subreason">{r.reason}</span>
            </div>
          ))}
        </div>

        <p className="iso-foot">
          The point isn’t the headers for their own sake — it’s the guarantee they buy: a process containing <em>only</em> resources that
          consented to be there, so a Spectre gadget has nothing cross-origin to read. That guarantee is the price of admission for
          <code> SharedArrayBuffer</code> (needed by Wasm threads, ffmpeg.wasm, SQLite-WASM) and precise timers. COOP also independently
          hardens against cross-window attacks like XS-Leaks by cutting the <code>window.opener</code> reference. This is the same instinct as
          OS process isolation, pushed into the browser’s origin model.
        </p>
      </section>
    </div>
  );
}
