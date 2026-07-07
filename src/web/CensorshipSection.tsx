// Censorship circumvention — reaching Tor from behind a national firewall. Three blocks stacked (DPI, relay
// blocklist, SNI filter), each defeated by one technique (obfs4, bridge, domain fronting). Auto-plays a connection
// accumulating disguises until it slips through, and you can toggle each technique. Model + verdict in censorship.ts.
import { useEffect, useState } from 'react';
import { verdict, FULL_CENSOR, type Conn } from './censorship';

const CHECKS = [
  { key: 'dpi', name: 'Deep packet inspection', note: 'fingerprints Tor’s TLS handshake', defeat: 'obfs4' },
  { key: 'blocklist', name: 'Relay blocklist', note: 'blocks every public Tor relay', defeat: 'a bridge' },
  { key: 'sni', name: 'SNI filter', note: 'blocks connections to forbidden hostnames', defeat: 'domain fronting' },
];
const SEQ: Conn[] = [
  { obfuscated: false, bridge: false, fronted: false },
  { obfuscated: true, bridge: false, fronted: false },
  { obfuscated: true, bridge: true, fronted: false },
  { obfuscated: true, bridge: true, fronted: true },
];

export function CensorshipSection() {
  const [conn, setConn] = useState<Conn>(SEQ[0]);
  const [auto, setAuto] = useState(true);
  const [ai, setAi] = useState(0);
  useEffect(() => {
    if (!auto) return;
    setConn(SEQ[ai]);
    const through = ai >= SEQ.length - 1;
    const t = setTimeout(() => setAi((i) => (i + 1) % SEQ.length), through ? 2600 : 1700);
    return () => clearTimeout(t);
  }, [auto, ai]);

  const v = verdict(conn, FULL_CENSOR);
  const toggle = (k: keyof Conn) => { setAuto(false); setConn((c) => ({ ...c, [k]: !c[k] })); };

  return (
    <div className="cen">
      <p className="cen-intro">
        A national firewall doesn’t just block a list of sites — it actively hunts and blocks the tools people use to
        get around it, Tor included. It stacks three kinds of block, and each is beaten by one technique. Watch a
        connection pick them up one at a time until it slips through — or flip them yourself.
      </p>

      <div className="cen-toggles">
        <button type="button" className={`cen-tog ${conn.obfuscated ? 'on' : ''}`} onClick={() => toggle('obfuscated')}>{conn.obfuscated ? '✓ ' : ''}obfs4 <span>make traffic look random</span></button>
        <button type="button" className={`cen-tog ${conn.bridge ? 'on' : ''}`} onClick={() => toggle('bridge')}>{conn.bridge ? '✓ ' : ''}bridge <span>unlisted entry relay</span></button>
        <button type="button" className={`cen-tog ${conn.fronted ? 'on' : ''}`} onClick={() => toggle('fronted')}>{conn.fronted ? '✓ ' : ''}domain fronting <span>hide behind a CDN</span></button>
        <button type="button" className={`cen-play ${auto ? 'on' : ''}`} onClick={() => setAuto((a) => !a)}>{auto ? '❚❚' : '▶'}</button>
      </div>

      <div className="cen-path">
        <div className="cen-node you">🧑<span>you</span><em>censored</em></div>
        <div className="cen-fw">
          <div className="cen-fw-lbl">🧱 the firewall</div>
          <div className="cen-checks">
            {CHECKS.map((c, i) => {
              const state = v.stage > i ? 'pass' : (v.blocked && v.stage === i ? 'block' : 'unreached');
              return (
                <div key={c.key} className={`cen-check ${state}`}>
                  <div className="cen-c-name">{c.name}</div>
                  <div className="cen-c-note">{c.note}</div>
                  <div className="cen-c-status">{state === 'pass' ? '✓ passed' : state === 'block' ? `✗ BLOCKED — ${c.defeat} defeats this` : '· not reached'}</div>
                </div>
              );
            })}
          </div>
        </div>
        <div className={`cen-node tor ${v.blocked ? 'off' : 'on'}`}>🧅<span>Tor</span><em>{v.blocked ? 'unreachable' : 'reached ✓'}</em></div>
      </div>

      <div className={`cen-verdict ${v.blocked ? 'bad' : 'ok'}`}>
        {v.blocked ? <>⛔ blocked — {v.by}</> : <>🔓 the connection reaches Tor — DPI sees only random bytes, the entry relay isn’t on any list, and the SNI names an unblockable CDN</>}
      </div>

      <p className="cen-foot">
        Each technique defeats exactly one layer: a <strong>pluggable transport</strong> like <strong>obfs4</strong> reshapes
        the byte stream so DPI finds no protocol to fingerprint; a <strong>bridge</strong> is a Tor entry relay kept out of
        the public directory and handed out sparingly, so blocking the known relays doesn’t catch it; and
        <strong> domain fronting</strong> puts an innocuous CDN domain in the visible TLS SNI while the real destination
        travels in the encrypted inner request, so a censor must block the whole CDN or let it through. It’s a moving arms
        race — censors fingerprint each transport in turn, so new ones keep appearing. (Tor pluggable transports; obfs4;
        Meek/domain fronting.)
      </p>
    </div>
  );
}
