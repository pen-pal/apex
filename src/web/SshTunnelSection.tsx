// SSH tunneling, made visible — the -L / -R / -D distinction everyone gets backwards. Pick a goal and a flag, and
// watch which side the listening port opens on, the hop path through the encrypted tunnel, and whether it meets the
// goal. Choosing -L when you meant -R opens the listener on the wrong side and fails. Model + tests in sshtunnel.ts.
import { useMemo, useState } from 'react';
import { plan, type Forward, type Goal } from './sshtunnel';

const GOALS: { id: Goal; label: string }[] = [
  { id: 'reach-internal', label: 'reach the DB on the bastion’s network from my laptop' },
  { id: 'expose-local', label: 'let someone on the bastion reach my local app' },
];
const FLAGS: { id: Forward; label: string }[] = [
  { id: 'L', label: '-L local' }, { id: 'R', label: '-R remote' }, { id: 'D', label: '-D dynamic' },
];

export function SshTunnelSection() {
  const [goal, setGoal] = useState<Goal>('reach-internal');
  const [fwd, setFwd] = useState<Forward>('L');
  const p = useMemo(() => plan(fwd, goal), [fwd, goal]);
  const listenLaptop = p.listener.side === 'laptop';

  return (
    <div className="ssht">
      <div className="ssht-controls">
        <div className="ssht-seg">
          <span className="ssht-seg-lbl">goal</span>
          {GOALS.map((g) => (
            <button key={g.id} type="button" className={goal === g.id ? 'on' : ''} onClick={() => setGoal(g.id)}>{g.label}</button>
          ))}
        </div>
        <div className="ssht-seg">
          <span className="ssht-seg-lbl">flag</span>
          {FLAGS.map((f) => (
            <button key={f.id} type="button" className={fwd === f.id ? 'on' : ''} onClick={() => setFwd(f.id)}>{f.label}</button>
          ))}
        </div>
      </div>

      <code className="ssht-cmd">{p.cmd}</code>

      <div className="ssht-diagram">
        <div className={`ssht-node ${listenLaptop ? 'ssht-listen' : ''}`}>
          <div className="ssht-node-h">💻 your laptop</div>
          <div className="ssht-svc">app · <code>localhost:3000</code></div>
          {listenLaptop && <div className="ssht-badge">⚡ listening {p.listener.text}</div>}
        </div>
        <div className="ssht-link"><span className="ssht-link-lbl">encrypted SSH tunnel</span></div>
        <div className={`ssht-node ${!listenLaptop ? 'ssht-listen' : ''}`}>
          <div className="ssht-node-h">🖥 bastion</div>
          <div className="ssht-svc"><code>db.internal:5432</code> · private net</div>
          {!listenLaptop && <div className="ssht-badge">⚡ listening {p.listener.text}</div>}
        </div>
      </div>

      <div className="ssht-trace">
        <div className="ssht-lbl">what happens when the tunnel is used</div>
        {p.hops.map((h, i) => (
          <div key={i} className={`ssht-hop ssht-${h.node}`}>
            <span className="ssht-step">{i + 1}</span>
            <span className="ssht-hop-node">{h.node === 'tunnel' ? 'SSH' : h.node === 'server' ? 'bastion' : 'laptop'}</span>
            <span className="ssht-hop-text">{h.text}</span>
          </div>
        ))}
        <div className={`ssht-verdict ${p.ok ? 'ok' : 'bad'}`}>{p.ok ? '✓ this meets the goal' : '✗ wrong flag for this goal'} — {p.reason}</div>
      </div>

      <p className="ssht-foot">
        The one rule that untangles it: the forward is named for <strong>where the listening port opens</strong>.
        <strong> -L</strong> opens it <em>locally</em> (on you) and the far end makes the last hop — reach a service the
        server can see but you can’t. <strong>-R</strong> opens it <em>remotely</em> (on the server) and tunnels back to
        you — publish your local service, or punch out of a network that won’t accept inbound connections (a reverse
        shell’s honest cousin). <strong>-D</strong> opens a local <strong>SOCKS</strong> proxy and the server dials
        whatever each request names — a one-hop VPN for proxy-aware apps. Chain several with <code>-J</code>/ProxyJump to
        reach through a bastion into a private network. It all rides one authenticated, encrypted channel — which is why
        a locked-down egress firewall that allows only port 22 still leaks like a sieve. (OpenSSH port forwarding.)
      </p>
    </div>
  );
}
