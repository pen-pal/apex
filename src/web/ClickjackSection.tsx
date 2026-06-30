// Clickjacking, made visible. The attacker's page shows a tempting decoy button; drag the "reveal"
// slider to expose the transparent iframe of the bank's real "Transfer" button sitting right under it —
// your click would land there. Then set the bank's framing policy and watch the browser refuse to load
// the frame at all, so there's nothing to overlay. Real policy logic from clickjack.ts.
import { useMemo, useState } from 'react';
import { canFrame, type FramePolicy } from './clickjack';

const BANK = 'https://bank.com';
const POLICIES: { label: string; policy: FramePolicy }[] = [
  { label: 'no protection', policy: { xfo: null, frameAncestors: null } },
  { label: 'X-Frame-Options: DENY', policy: { xfo: 'DENY', frameAncestors: null } },
  { label: 'X-Frame-Options: SAMEORIGIN', policy: { xfo: 'SAMEORIGIN', frameAncestors: null } },
  { label: "frame-ancestors 'none'", policy: { xfo: null, frameAncestors: ["'none'"] } },
  { label: "frame-ancestors 'self'", policy: { xfo: null, frameAncestors: ["'self'"] } },
];
const FRAMERS = ['https://evil.com', 'https://bank.com'];

export function ClickjackSection() {
  const [pi, setPi] = useState(0);
  const [framer, setFramer] = useState(FRAMERS[0]);
  const [reveal, setReveal] = useState(0);

  const d = useMemo(() => canFrame(BANK, framer, POLICIES[pi].policy), [pi, framer]);

  return (
    <div className="cj">
      <div className="cj-controls">
        <div className="cj-row"><span className="cj-cl">bank.com framing policy:</span>
          {POLICIES.map((p, i) => <button key={i} type="button" className={`cj-pbtn ${pi === i ? 'on' : ''}`} onClick={() => setPi(i)}>{p.label}</button>)}
        </div>
        <div className="cj-row"><span className="cj-cl">attacker page is:</span>
          {FRAMERS.map((f) => <button key={f} type="button" className={`cj-pbtn ${framer === f ? 'on' : ''}`} onClick={() => setFramer(f)}>{f}</button>)}
          <label className="cj-reveal">reveal the trick <input type="range" min={0} max={100} value={reveal} onChange={(e) => setReveal(+e.target.value)} /></label>
        </div>
      </div>

      <div className="cj-browser">
        <div className="cj-urlbar">🌐 {framer === BANK ? 'bank.com (an internal page)' : 'evil.com/free-prize'}</div>
        <div className="cj-stage">
          <div className="cj-decoy">
            <h3>🎁 You won! Click below to claim your prize</h3>
            <button type="button" className="cj-decoy-btn">Claim my prize →</button>
            <p className="cj-decoy-sub">(this is the only thing the victim thinks they're clicking)</p>
          </div>
          {d.allowed ? (
            <div className="cj-overlay" style={{ opacity: reveal / 100 }}>
              <div className="cj-iframe">
                <div className="cj-iframe-h">⟨ iframe: bank.com ⟩</div>
                <button type="button" className="cj-target-btn">⚠ Transfer $5,000 to attacker</button>
              </div>
            </div>
          ) : (
            <div className="cj-blocked"><b>⛔ frame blocked</b><span>{d.reason}</span><span>the browser refused to render bank.com here — nothing to overlay</span></div>
          )}
        </div>
      </div>

      <div className={`cj-verdict ${d.clickjackable ? 'bad' : 'ok'}`}>
        {d.clickjackable
          ? <>🚨 <b>CLICKJACKABLE</b> — {d.reason}. The decoy sits over the real button, so the victim's click transfers the money.</>
          : d.allowed
            ? <>✓ framed, but <b>same-origin</b> — not a cross-site clickjacking vector.</>
            : <>🛡️ <b>safe</b> — {d.reason}.</>}
      </div>

      <p className="cj-foot">
        The attack needs three things: the target must be <em>framable</em>, the victim must be <em>logged in</em> (so the framed actions carry
        their cookies), and the action must complete in a <em>single click</em>. Break any one and it fails — which is why the primary defense is
        simply to forbid framing: send <strong>X-Frame-Options: DENY</strong> (or SAMEORIGIN) and, better, the modern
        <strong> Content-Security-Policy: frame-ancestors 'none'</strong> (frame-ancestors supersedes XFO and supports an allowlist for legitimate
        embedders). Defense-in-depth adds <em>SameSite cookies</em> (the framed request may not even be authenticated cross-site) and confirmation
        steps for sensitive actions. It’s the framing-side complement to <strong>CORS</strong> and <strong>site isolation</strong>. (OWASP; RFC 7034.)
      </p>
    </div>
  );
}
