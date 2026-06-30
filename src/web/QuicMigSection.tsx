// QUIC connection migration, made visible. Pick TCP or QUIC, then "switch networks" (wifi → cellular) and
// watch what the server uses to find your connection: TCP's 4-tuple changes and no socket matches — dead,
// full reconnect; QUIC's connection ID is unchanged, so the same connection is recognized from the new IP
// and only needs a quick path validation. Real model from quicmig.ts.
import { useState } from 'react';
import { migrate, type Proto, type Endpoint } from './quicmig';

const WIFI: Endpoint = { ip: '192.168.1.20', port: 51000 };
const CELL: Endpoint = { ip: '10.55.3.7', port: 49000 };
const SERVER: Endpoint = { ip: '93.184.216.34', port: 443 };
const CID = 'a1b2c3';

export function QuicMigSection() {
  const [proto, setProto] = useState<Proto>('quic');
  const [moved, setMoved] = useState(true);
  const client = moved ? CELL : WIFI;
  const r = migrate(proto, WIFI, client, SERVER, CID);

  return (
    <div className="qmig">
      <p className="qmig-intro">
        You're mid-download and walk out of wifi onto cellular — your IP changes. Does the connection survive?
        It comes down to <strong>how the server finds which connection a packet belongs to</strong>. TCP uses
        the <strong>4-tuple</strong> (your IP+port → server IP+port); QUIC carries an explicit
        <strong> connection ID</strong> in every packet, independent of addresses.
      </p>

      <div className="qmig-controls">
        <div className="qmig-proto">
          <button type="button" className={proto === 'tcp' ? 'on' : ''} onClick={() => setProto('tcp')}>TCP</button>
          <button type="button" className={proto === 'quic' ? 'on' : ''} onClick={() => setProto('quic')}>QUIC</button>
        </div>
        <button type="button" className={`qmig-switch ${moved ? 'on' : ''}`} onClick={() => setMoved((m) => !m)}>
          {moved ? '📶 on cellular — switch back to wifi' : '📡 on wifi — switch to cellular'}
        </button>
      </div>

      <div className="qmig-wire">
        <div className="qmig-node">
          <div className="qmig-nh">📱 client</div>
          <div className={`qmig-addr ${moved ? 'changed' : ''}`}>{client.ip}:{client.port}</div>
          <div className="qmig-net">{moved ? 'cellular' : 'wifi'}</div>
        </div>
        <div className="qmig-pkt">
          <div className="qmig-pkt-h">packet's demux key</div>
          <code className={r.matched ? 'ok' : 'bad'}>{r.newKey}</code>
          <div className="qmig-pkt-cmp">was: <code>{r.oldKey}</code></div>
        </div>
        <div className="qmig-node">
          <div className="qmig-nh">🖥️ server</div>
          <div className="qmig-addr">{SERVER.ip}:{SERVER.port}</div>
          <div className={`qmig-find ${r.matched ? 'ok' : 'bad'}`}>{r.matched ? '✓ connection found' : '✗ no matching connection'}</div>
        </div>
      </div>

      <div className={`qmig-verdict ${r.survives ? 'ok' : 'bad'}`}>
        <div className="qmig-vmain">{!moved ? 'no network change' : r.survives ? '✓ connection survives the switch' : '✗ connection is lost'}</div>
        <div className="qmig-vsub">
          {proto === 'tcp'
            ? (moved ? 'the 4-tuple changed, so the packet matches no socket' : 'same 4-tuple — nothing to do')
            : 'the connection ID is the same on any network — the server recognizes it'}
        </div>
      </div>

      <div className="qmig-recovery">
        <div className="qmig-rh">{r.recovery.reconnect ? 'Recovery — full reconnect' : moved ? 'Recovery — path validation' : 'No recovery needed'}<span className="qmig-rtt">{r.recovery.rtts} RTT{r.recovery.rtts === 1 ? '' : 's'}{r.recovery.reconnect ? ' + slow start' : ''}</span></div>
        {moved && (
          <ol className="qmig-steps">
            {r.recovery.steps.map((s, i) => <li key={i} className={proto === 'quic' ? 'q' : 't'}>{s}</li>)}
          </ol>
        )}
      </div>

      <p className="qmig-foot">
        Migration is why QUIC matters for mobile: a phone roaming between cells or wifi keeps its streams,
        congestion state (mostly), and TLS keys — no stall, no re-handshake. The <strong>path validation</strong>
        (PATH_CHALLENGE/RESPONSE) stops an attacker from hijacking a flow by spoofing your address, and the
        <strong> anti-amplification</strong> limit (send ≤ 3× what you've received from an unvalidated address)
        stops the server being used as a reflection amplifier. Clients also keep a pool of spare connection IDs
        and switch to a fresh one per path, so a network observer can't link your wifi and cellular sessions to
        one identity. The congestion controller does reset for the new path, since its capacity is unknown.
        (RFC 9000 §9.)
      </p>
    </div>
  );
}
