// WireGuard cryptokey routing, made visible. Two peers, each a public key + a list of AllowedIPs. That one list is both
// the outbound route (a destination goes to the peer whose AllowedIPs covers it) and the inbound ACL (a packet
// decrypted with a peer's key is accepted only if its source is in that peer's AllowedIPs). Send to different
// destinations and watch them route or drop; receive from a peer with different source IPs and watch spoofs get
// rejected. Model + tests in wgroute.ts.
import { useMemo, useState } from 'react';
import { routeOutbound, acceptInbound, DEFAULT_PEERS } from './wgroute';

const DESTS = ['10.0.0.2', '10.0.0.3', '192.168.1.50', '8.8.8.8'];
const SRCS = ['192.168.1.50', '10.0.0.2', '10.0.0.3'];

export function WireGuardSection() {
  const peers = useMemo(() => DEFAULT_PEERS(), []);
  const [dst, setDst] = useState('192.168.1.50');
  const [inPeer, setInPeer] = useState(1);
  const [src, setSrc] = useState('10.0.0.2');

  const route = useMemo(() => routeOutbound(peers, dst), [peers, dst]);
  const accepted = useMemo(() => acceptInbound(peers[inPeer], src), [peers, inPeer, src]);

  return (
    <div className="wg">
      <div className="wg-peers">
        <div className="wg-lbl">peers — a public key and its AllowedIPs</div>
        {peers.map((p, i) => (
          <div key={p.name} className={`wg-peer ${route?.peer.name === p.name ? 'wg-routed' : ''} ${i === inPeer ? 'wg-insel' : ''}`}>
            <div className="wg-peer-h"><code>{p.name}</code><span className="wg-key">{p.pubkey}</span></div>
            <div className="wg-cidrs">{p.allowedIps.map((c) => (
              <code key={c} className={`wg-cidr ${route?.peer.name === p.name && route.cidr === c ? 'wg-match' : ''}`}>{c}</code>
            ))}</div>
          </div>
        ))}
      </div>

      <div className="wg-panels">
        <div className="wg-panel">
          <div className="wg-lbl">outbound — send a packet to</div>
          <div className="wg-chips">
            {DESTS.map((d) => <button key={d} type="button" className={dst === d ? 'on' : ''} onClick={() => setDst(d)}>{d}</button>)}
          </div>
          <div className={`wg-result ${route ? 'wg-ok' : 'wg-bad'}`}>
            {route
              ? <>→ encrypted to <b>{route.peer.name}</b> — its AllowedIPs <code>{route.cidr}</code> covers <code>{dst}</code> (longest prefix). Sent to that peer’s endpoint.</>
              : <>✗ dropped — no peer’s AllowedIPs covers <code>{dst}</code>. There’s no default route; a full tunnel would need a peer with <code>0.0.0.0/0</code>.</>}
          </div>
        </div>

        <div className="wg-panel">
          <div className="wg-lbl">inbound — a packet decrypted with</div>
          <div className="wg-chips">
            {peers.map((p, i) => <button key={p.name} type="button" className={inPeer === i ? 'on' : ''} onClick={() => setInPeer(i)}>{p.name}’s key</button>)}
          </div>
          <div className="wg-lbl wg-lbl2">claiming source</div>
          <div className="wg-chips">
            {SRCS.map((s) => <button key={s} type="button" className={src === s ? 'on' : ''} onClick={() => setSrc(s)}>{s}</button>)}
          </div>
          <div className={`wg-result ${accepted ? 'wg-ok' : 'wg-bad'}`}>
            {accepted
              ? <>✓ accepted — <code>{src}</code> is in <b>{peers[inPeer].name}</b>’s AllowedIPs, so this peer is allowed to send from it.</>
              : <>✗ dropped as spoofed — <code>{src}</code> is not in <b>{peers[inPeer].name}</b>’s AllowedIPs, so it may not claim that source, even with a valid key.</>}
          </div>
        </div>
      </div>

      <p className="wg-foot">
        WireGuard threw out the VPN playbook. There’s <strong>no PKI</strong>: a peer is just a Curve25519 public key you
        list, like an SSH <code>authorized_keys</code>. The handshake is a <strong>1-RTT Noise IK</strong> exchange that
        derives symmetric keys; after it, every packet is <strong>ChaCha20-Poly1305</strong> with a counter nonce, and an
        idle tunnel sends nothing. The idea above is <strong>cryptokey routing</strong>: a peer’s <code>AllowedIPs</code>
        is simultaneously the routing table (which destinations encrypt to this peer) and the firewall (which source
        addresses this peer is allowed to send) — one list, bound to one key, replacing the separate routing and
        <code>iptables</code> rules a traditional VPN needs. It’s also why WireGuard <em>roams</em>: identity is the key,
        not the IP, so a peer’s endpoint can change and the tunnel just follows. (WireGuard.)
      </p>
    </div>
  );
}
