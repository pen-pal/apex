// IP fragmentation & MTU, made visible. A datagram bigger than the link MTU gets
// split into fragments — each with a copied header, an 8-byte-unit offset, and the
// More-Fragments flag on all but the last. Toggle Don't-Fragment and instead watch
// Path-MTU Discovery: the router drops the packet and an ICMP message tells the
// sender to shrink. Real RFC 791 rules (see fragment.ts).
import { useMemo, useState } from 'react';
import { fragment, reassemble, pmtud, IP_HEADER } from './fragment';

const MTUS = [{ v: 1500, n: 'Ethernet' }, { v: 1492, n: 'PPPoE' }, { v: 1280, n: 'IPv6 min' }, { v: 576, n: 'IPv4 min path' }];

export function FragmentSection() {
  const [payload, setPayload] = useState(4000);
  const [mtu, setMtu] = useState(1500);
  const [df, setDf] = useState(false);

  const frag = useMemo(() => fragment(payload, mtu), [payload, mtu]);
  const re = useMemo(() => reassemble(frag.fragments), [frag]);
  const pm = useMemo(() => pmtud(IP_HEADER + payload, mtu), [payload, mtu]);
  const totalPacket = IP_HEADER + payload;

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>IP fragmentation &amp; MTU</h2></div>
        <p className="jsec-sub">
          Each link has a maximum frame size — its <strong>MTU</strong>. A datagram bigger than that must be
          <strong> fragmented</strong>: the payload is split into pieces that each fit, every piece carrying the same
          header plus an offset so the destination can reassemble them. But if the sender sets <strong>Don’t-Fragment</strong>,
          the router drops an oversized packet and reports back — that’s how Path-MTU Discovery finds the safe size.
        </p>

        <div className="frag-controls">
          <label>payload: {payload} B<input type="range" min={200} max={6000} step={20} value={payload} onChange={(e) => setPayload(+e.target.value)} /></label>
          <label>link MTU: {mtu} B<input type="range" min={296} max={1500} step={4} value={mtu} onChange={(e) => setMtu(+e.target.value)} /></label>
          <div className="frag-mtus">{MTUS.map((m) => <button key={m.v} className={`ghost small ${mtu === m.v ? 'on' : ''}`} onClick={() => setMtu(m.v)}>{m.v} <em>{m.n}</em></button>)}</div>
          <label className="frag-df"><input type="checkbox" checked={df} onChange={(e) => setDf(e.target.checked)} /> Don’t-Fragment (DF)</label>
        </div>

        <div className="frag-summary">datagram = {IP_HEADER}-byte header + {payload}-byte payload = <strong>{totalPacket} B</strong> · link carries up to <strong>{mtu} B</strong></div>

        {!df ? (
          totalPacket <= mtu ? (
            <div className="frag-fits">✓ Fits in one packet ({totalPacket} ≤ {mtu}) — no fragmentation needed.</div>
          ) : (
            <>
              <div className="frag-note">Too big for the link → split into <strong>{frag.fragments.length} fragments</strong> (max {frag.maxPayloadPerFrag} B payload each, the MTU minus the 20-byte header, rounded down to a multiple of 8).</div>
              <div className="frag-blocks">
                {frag.fragments.map((f) => (
                  <div key={f.index} className={`frag-block ${f.mf ? 'mf' : 'last'}`} style={{ flexGrow: f.size }}>
                    <div className="fb-hdr">hdr</div>
                    <div className="fb-body">
                      <div className="fb-i">fragment {f.index}</div>
                      <div className="fb-meta">bytes {f.byteStart}–{f.byteStart + f.size - 1}</div>
                      <div className="fb-meta">offset={f.offsetUnits} · MF={f.mf ? 1 : 0} · {f.size} B</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="frag-reassemble">↺ Reassembly: order by offset → {re.totalBytes} B {re.complete ? '✓ complete (last fragment has MF=0)' : ''}. Lose <em>one</em> fragment and the destination can’t rebuild it — the whole datagram is discarded.</div>
            </>
          )
        ) : (
          pm.delivered ? (
            <div className="frag-fits">✓ DF set, but it fits ({totalPacket} ≤ {mtu}) — delivered whole.</div>
          ) : (
            <div className="frag-pmtud">
              <div className="frag-drop">✗ DF set and {totalPacket} &gt; {mtu}: the router <strong>drops</strong> the packet (it may not fragment).</div>
              <div className="frag-icmp">← ICMP: <strong>{pm.icmp!.type}</strong>, next-hop MTU = <strong>{pm.icmp!.nextHopMtu}</strong></div>
              <div className="frag-shrink">→ The sender lowers its packet size to <strong>{pm.newPacketSize} B</strong> (payload ≤ {pm.newPacketSize - IP_HEADER}) and retries. That’s Path-MTU Discovery — the modern default, because end-to-end fragmentation is fragile.</div>
            </div>
          )
        )}
        <p className="enc-note">Fragmentation is best avoided: a single lost fragment kills the whole datagram, firewalls/NAT often mishandle fragments,
          and reassembly costs the receiver memory (a classic DoS vector). IPv6 went further — routers never fragment; only the source may, guided by PMTUD.</p>
      </section>
    </div>
  );
}
