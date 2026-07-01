// 0-RTT resumption & replay, made visible. Toggle between a first visit (full handshake, data waits a round
// trip) and a return visit (0-RTT: request data rides in the very first packet, zero round trips). Then pick
// an HTTP method and let an attacker replay the captured early-data packet — a GET is harmless, a POST
// double-charges. The whole lesson: 0-RTT is free latency but only for replay-safe requests. Model from
// zerortt.ts.
import { useState } from 'react';
import { connect, safeForEarlyData, isIdempotent, replay } from './zerortt';

const METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'DELETE'];

export function ZeroRttSection() {
  const [returning, setReturning] = useState(true);
  const [method, setMethod] = useState('GET');
  const [replays, setReplays] = useState(2);

  const conn = connect(returning ? '0rtt' : 'full', returning);
  const full = connect('full', false);
  const idem = isIdempotent(method);
  const eligible = safeForEarlyData(method);
  const out = replay(method, conn.earlyData ? replays : 0);

  return (
    <div className="zrt">
      <p className="zrt-intro">
        TLS 1.3 and QUIC can send your request in the <strong>very first packet</strong> — zero round trips to
        the first byte. On a first visit you handshake normally and get a <strong>resumption ticket</strong>;
        on a return visit you encrypt request data with it as <strong>early data</strong>. The catch: early
        data has no server freshness yet, so it can be <strong>replayed</strong> — safe for a GET, a disaster
        for a POST.
      </p>

      <div className="zrt-toggle">
        <button type="button" className={!returning ? 'on' : ''} onClick={() => setReturning(false)}>first visit (full handshake)</button>
        <button type="button" className={returning ? 'on' : ''} onClick={() => setReturning(true)}>return visit (0-RTT)</button>
      </div>

      <div className="zrt-flights">
        <div className="zrt-flow">
          {conn.earlyData ? (
            <>
              <div className="zrt-msg early">→ ClientHello + <b>early data</b> (your request){' '}<span className="zrt-t">t=0</span></div>
              <div className="zrt-msg down">← ServerHello + response<span className="zrt-t">t=½ RTT</span></div>
            </>
          ) : (
            <>
              <div className="zrt-msg">→ ClientHello<span className="zrt-t">t=0</span></div>
              <div className="zrt-msg down">← ServerHello, keys{returning ? ' (resumed)' : ''}<span className="zrt-t">t=½ RTT</span></div>
              <div className="zrt-msg early">→ your request<span className="zrt-t">t=1 RTT</span></div>
            </>
          )}
        </div>
        <div className="zrt-rtt">
          <div className={`zrt-rttbox ${conn.rttToFirstByte === 0 ? 'ok' : ''}`}><span>{conn.mode === '0rtt' ? '0-RTT' : 'this connection'}</span><b>{conn.rttToFirstByte} RTT</b><i>to first byte</i></div>
          {conn.rttToFirstByte < full.rttToFirstByte && <div className="zrt-saved">saved 1 RTT vs a full handshake</div>}
        </div>
      </div>

      {conn.earlyData && (
        <div className="zrt-replay">
          <div className="zrt-rh">the early-data request:</div>
          <div className="zrt-methods">
            {METHODS.map((m) => (
              <button key={m} type="button" className={`zrt-m ${method === m ? 'on' : ''} ${isIdempotent(m) ? 'safe' : 'unsafe'}`} onClick={() => setMethod(m)}>{m}</button>
            ))}
          </div>
          <div className="zrt-mflags">
            <span className={`zrt-mbadge ${idem ? 'ok' : 'bad'}`}>{idem ? '✓ idempotent → a replay is harmless' : '✗ not idempotent → a replay does damage'}</span>
            <span className={`zrt-mbadge ${eligible ? 'ok' : 'warn'}`}>{eligible ? 'safe method → allowed in early data' : 'not a "safe" method → browsers keep it OUT of early data anyway'}</span>
          </div>
          <label className="zrt-rcount">😈 attacker replays the packet <input type="range" min={1} max={5} value={replays} onChange={(e) => setReplays(+e.target.value)} /><b>{replays}×</b></label>
          <div className={`zrt-outcome ${out.harmful ? 'bad' : idem ? 'ok' : 'warn'}`}>
            server processed it {out.deliveries}× → <b>{out.logicalEffects}</b> logical effect{out.logicalEffects === 1 ? '' : 's'}.
            {out.harmful
              ? ` ⚠ a ${method} isn't idempotent, so ${out.deliveries} deliveries = ${out.logicalEffects} real actions (e.g. ${out.logicalEffects} charges).`
              : idem
                ? ` a ${method} is idempotent — replays collapse to one effect. Harmless.`
                : ` delivered once, so no duplicate yet — but a ${method} isn't idempotent, so any replay would double it.`}
          </div>
        </div>
      )}

      <p className="zrt-foot">
        Defenses, none perfect: servers keep an <strong>anti-replay window</strong> (remember recently-used
        tickets/nonces) but can't share it perfectly across a load-balanced cluster, so some replays slip
        through; TLS also caps early-data age. The robust answer is at the application layer — <strong>only
        allow replay-safe requests in early data</strong> (browsers/CDNs restrict 0-RTT to GET/HEAD), and make
        anything with side effects <strong>idempotent</strong> (idempotency keys) so a duplicate is a no-op. QUIC
        forbids 0-RTT for the connection-migration path for the same reason. It's the classic latency-vs-safety
        trade: 0-RTT buys a round trip, and you pay for it with a replay you must design around. (RFC 8446 §8;
        RFC 9001.)
      </p>
    </div>
  );
}
