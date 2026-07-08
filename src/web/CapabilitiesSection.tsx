// Linux capabilities, made visible — least privilege vs the exploit. Toggle which capabilities the (exploited) web
// server holds, or pick a preset, and watch which operations succeed: it only needs CAP_NET_BIND_SERVICE to bind :80,
// so dropping everything else boxes an attacker in, while full root hands them every dangerous power. Model + tests in
// capabilities.ts.
import { useMemo, useState } from 'react';
import { CAPS, OPS, permits, assess, ALL_CAPS, LEAST_PRIVILEGE } from './capabilities';

export function CapabilitiesSection() {
  const [held, setHeld] = useState<Set<string>>(() => LEAST_PRIVILEGE());

  const toggle = (id: string) => setHeld((h) => { const n = new Set(h); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const verdict = useMemo(() => assess(held), [held]);

  return (
    <div className="lcap">
      <div className="lcap-presets">
        <span className="lcap-presets-lbl">the process runs with:</span>
        <button type="button" onClick={() => setHeld(ALL_CAPS())}>root — all capabilities</button>
        <button type="button" onClick={() => setHeld(LEAST_PRIVILEGE())}>least privilege</button>
        <button type="button" onClick={() => setHeld(new Set())}>drop all</button>
      </div>

      <div className="lcap-caps">
        <div className="lcap-lbl">capabilities held — click to grant or drop</div>
        <div className="lcap-chips">
          {CAPS.map((c) => (
            <button key={c.id} type="button" className={`lcap-chip ${held.has(c.id) ? 'on' : ''}`} onClick={() => toggle(c.id)} title={c.allows}>
              <code>{c.label}</code><span>{c.allows}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="lcap-ops">
        <div className="lcap-lbl">what the exploited server can do now</div>
        {OPS.map((o) => {
          const ok = permits(held, o);
          return (
            <div key={o.id} className={`lcap-op ${ok ? 'lcap-ok' : 'lcap-no'} ${o.danger ? 'lcap-danger' : ''}`}>
              <span className="lcap-op-res">{ok ? '✓' : '✗'}</span>
              <span className="lcap-op-label">{o.danger && ok && <span className="lcap-skull">🔓 </span>}{o.label}</span>
              <span className="lcap-op-detail">{o.detail}</span>
              <code className="lcap-op-cap">{o.cap ?? 'no cap'}</code>
            </div>
          );
        })}
      </div>

      <div className={`lcap-verdict lcap-v-${verdict.kind}`}>{verdict.text}</div>

      <p className="lcap-foot">
        “Root” was never one thing — the kernel splits it into ~40 <strong>capabilities</strong>, each a single class of
        privileged action, and checks operations against the ones a process actually holds. That’s coarser than
        <strong> seccomp</strong>, which filters individual syscalls; the two compose (drop capabilities <em>and</em>
        filter syscalls). The whole game is <strong>least privilege</strong>: a web server needs exactly
        CAP_NET_BIND_SERVICE and drops the rest, so a remote-code-execution bug in it can’t read <code>/etc/shadow</code>,
        load a rootkit, or escape the container. The one to fear is <strong>CAP_SYS_ADMIN</strong> — it’s such a grab-bag
        (mounts, namespaces, more) that holding it is close to full root, which is why <code>--privileged</code> containers
        and careless <code>--cap-add</code> are how most container escapes start. (Linux capabilities; man capabilities(7).)
      </p>
    </div>
  );
}
