// Multipath TCP, made visible. One byte stream is striped across two paths (Wi-Fi and Cellular). Each segment
// carries a connection-level Data Sequence Number (DSN), so even though they race across the paths and arrive
// out of order, the receiver reassembles them into the exact original stream. Toggle a path off (walk out of
// Wi-Fi range) and watch every byte reroute onto the survivor — the connection never drops. Real model from
// mptcp.ts.
import { useMemo, useState } from 'react';
import { schedule, reassemble, arrivalOrder, throughput, type Path } from './mptcp';

const MSG = 'MULTIPATH-TCP';
const CHUNKS = MSG.split('');
const COLOR: Record<number, string> = { 0: 'hsl(212 60% 52%)', 1: 'hsl(280 50% 56%)' };

export function MptcpSection() {
  const [wifiUp, setWifiUp] = useState(true);
  const [cellUp, setCellUp] = useState(true);

  const paths: Path[] = useMemo(() => [
    { id: 0, name: 'Wi-Fi', capacity: 8, latencyMs: 40, up: wifiUp },
    { id: 1, name: 'Cellular', capacity: 4, latencyMs: 12, up: cellUp },
  ], [wifiUp, cellUp]);

  const segs = useMemo(() => schedule(CHUNKS, paths), [paths]);
  const arr = useMemo(() => arrivalOrder(segs), [segs]);
  const reassembled = reassemble(segs);
  const anyUp = wifiUp || cellUp;
  const scrambled = arr.some((s, i) => i > 0 && s.dsn < arr[i - 1].dsn);

  return (
    <div className="mpt">
      <p className="mpt-intro">
        One connection, two paths. The stream <code>{MSG}</code> is striped across <strong>Wi-Fi</strong> and
        <strong> Cellular</strong> subflows. Each byte carries a connection-level <strong>Data Sequence
        Number</strong>, so they can race across paths, arrive out of order, and still reassemble perfectly.
        Toggle a path to simulate walking out of range:
      </p>

      <div className="mpt-paths">
        {paths.map((p) => (
          <button key={p.id} type="button" className={`mpt-path ${p.up ? 'up' : 'down'}`} style={{ borderLeftColor: COLOR[p.id] }}
            onClick={() => (p.id === 0 ? setWifiUp((v) => !v) : setCellUp((v) => !v))}>
            <span className="mpt-pname">{p.id === 0 ? '📶' : '📱'} {p.name}</span>
            <span className="mpt-pmeta">{p.capacity} Mb/s · {p.latencyMs}ms · {p.up ? 'up' : 'DOWN'}</span>
          </button>
        ))}
        <div className="mpt-tput">aggregate <b>{throughput(paths)} Mb/s</b></div>
      </div>

      {!anyUp ? <div className="mpt-dead">✕ both paths down — connection stalls (in reality it waits for a path to return; the buffered data is not lost)</div> : (
        <>
          <div className="mpt-lanes">
            {paths.filter((p) => p.up).map((p) => (
              <div key={p.id} className="mpt-lane">
                <span className="mpt-lname" style={{ color: COLOR[p.id] }}>{p.name}</span>
                <div className="mpt-cells">
                  {segs.filter((s) => s.pathId === p.id).map((s) => (
                    <div key={s.dsn} className="mpt-seg" style={{ background: COLOR[p.id] }} title={`DSN ${s.dsn}, arrives ${Math.round(s.arrival)}ms`}><b>{s.chunk}</b><i>{s.dsn}</i></div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mpt-strip">
            <div className="mpt-slabel">arrival order (on the wire){scrambled ? ' — out of order!' : ''}</div>
            <div className="mpt-cells">
              {arr.map((s) => <div key={s.dsn} className="mpt-seg small" style={{ background: COLOR[s.pathId] }} title={`DSN ${s.dsn}`}><b>{s.chunk}</b><i>{s.dsn}</i></div>)}
            </div>
          </div>

          <div className="mpt-strip good">
            <div className="mpt-slabel">reassembled by DSN → the original stream</div>
            <div className="mpt-cells">
              {[...segs].sort((a, b) => a.dsn - b.dsn).map((s) => <div key={s.dsn} className="mpt-seg small out"><b>{s.chunk}</b><i>{s.dsn}</i></div>)}
            </div>
            <div className="mpt-result">= <code>{reassembled}</code> {reassembled === MSG ? '✓ exact' : '✗'}</div>
          </div>
        </>
      )}

      <p className="mpt-foot">
        The two-level sequence numbering is the clever bit. Each subflow uses ordinary TCP sequence numbers on
        its own path, so every firewall and NAT still sees plain, well-formed TCP (MPTCP had to be invisible to
        middleboxes to deploy at all). On top, the <strong>DSS option</strong> maps each subflow's bytes to
        connection-level DSNs, and the receiver reorders by those — so a byte sent on cellular and a byte sent on
        Wi-Fi slot back together correctly. Failover is just retransmission: bytes a dead path never acknowledged
        get re-sent on a live one, so a Wi-Fi→cellular handoff loses nothing (this is exactly what keeps an
        iPhone's Siri/Music session alive as you leave the house). The scheduler is where the tuning lives —
        naive striping can cause enough reordering to hurt, so real MPTCP prefers the lowest-latency path and
        fills others by capacity. The same "many paths, one stream" idea appears in <strong>QUIC's
        multipath</strong> extension and in SCTP's multihoming. (RFC 8684.)
      </p>
    </div>
  );
}
