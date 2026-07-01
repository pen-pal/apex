// Silly Window Syndrome, made visible. Drag the slow reader's pace — how many bytes it frees per window
// advertisement — and compare two transfers of the same data: naive TCP, which sends a segment for each tiny
// opening (headers swamp the payload), versus SWS avoidance (Nagle + Clark), which coalesces into full-MSS
// segments. Each segment is drawn as header (waste) + payload (goodput). Real arithmetic from swsyndrome.ts.
import { useState } from 'react';
import { scenario, type Transfer } from './swsyndrome';

const PAYLOAD = 16384, MSS = 1460, HEADER = 40;
const pct = (x: number) => (x * 100).toFixed(x < 0.1 ? 1 : 0) + '%';

function SegView({ t, label, tone }: { t: Transfer; label: string; tone: string }) {
  const headerFrac = HEADER / (HEADER + t.segSize);
  return (
    <div className={`sws-lane ${tone}`}>
      <div className="sws-lane-h">{label}<i>{t.segments.toLocaleString()} segment{t.segments === 1 ? '' : 's'} · {t.segSize}B payload each</i></div>
      <div className="sws-seg" title={`${HEADER}B header + ${t.segSize}B payload`}>
        <div className="sws-hdr" style={{ width: `${headerFrac * 100}%` }}>{headerFrac > 0.14 ? `${HEADER}B hdr` : ''}</div>
        <div className="sws-pay" style={{ width: `${(1 - headerFrac) * 100}%` }}>{1 - headerFrac > 0.12 ? `${t.segSize}B data` : ''}</div>
      </div>
      <div className="sws-effrow">
        <div className="sws-efftrack"><div className={`sws-efffill ${tone}`} style={{ width: `${t.efficiency * 100}%` }} /></div>
        <span className="sws-effval">{pct(t.efficiency)} goodput</span>
      </div>
      <div className="sws-lane-s">{t.wireBytes.toLocaleString()} bytes on the wire for {PAYLOAD.toLocaleString()} bytes of data</div>
    </div>
  );
}

export function SwsSection() {
  const [readChunk, setReadChunk] = useState(1);
  const sc = scenario(PAYLOAD, readChunk, MSS, HEADER);

  return (
    <div className="sws">
      <p className="sws-intro">
        TCP's receiver advertises a <strong>window</strong> — its free buffer space. If the receiving app reads
        <em> slowly</em>, it frees only a few bytes at a time; the receiver advertises that tiny opening, and an
        eager sender fires off a segment just big enough to fill it. Now a handful of payload bytes ride inside a
        {' '}{HEADER}-byte TCP/IP header — the "silly window." Drag how much the slow reader frees per step:
      </p>

      <label className="sws-slider">
        slow reader frees <b>{readChunk}</b> byte{readChunk === 1 ? '' : 's'} per window
        <input type="range" min={1} max={MSS} value={readChunk} onChange={(e) => setReadChunk(+e.target.value)} />
      </label>

      <SegView t={sc.naive} label="🔴 naive TCP — send on every tiny opening" tone="bad" />
      <SegView t={sc.avoided} label="🟢 SWS avoidance (Nagle sender + Clark receiver)" tone="ok" />

      <div className="sws-verdict">
        Same {(PAYLOAD / 1024).toFixed(0)} KB of data. Naive TCP puts <b className="sws-bad">{sc.naive.wireBytes.toLocaleString()}</b> bytes on the
        wire; avoidance puts <b className="sws-good">{sc.avoided.wireBytes.toLocaleString()}</b> — a
        <b> {sc.speedup.toFixed(1)}×</b> difference, all of it wasted headers.
      </div>

      <p className="sws-foot">
        The two fixes have to cooperate because either side can cause the syndrome. <strong>Clark's algorithm</strong>
        {' '}on the receiver refuses to <em>advertise</em> a window increase until it can offer a full MSS (or half
        the buffer) — it hides the dribbles, so the sender is never tempted. <strong>Nagle's algorithm</strong> on
        the sender refuses to <em>transmit</em> a small segment while earlier small data is still unacknowledged,
        coalescing bytes until it has a full segment or an ACK arrives. Together they turn a storm of runt packets
        into a few fat ones. The catch — and a real-world gotcha — is that Nagle plus TCP's <strong>delayed
        ACK</strong> can deadlock a request/response app for ~40 ms: the sender holds a small segment waiting for
        an ACK, while the receiver holds the ACK waiting for data to piggyback on. That's exactly why latency-
        sensitive code sets <code>TCP_NODELAY</code> to disable Nagle. So the same mechanism that saves bandwidth
        on bulk transfers hurts interactive ones — the classic throughput-vs-latency trade-off, which is why it's
        a per-socket switch and not a global default. (RFC 813 Clark; RFC 896 Nagle; RFC 1122.)
      </p>
    </div>
  );
}
