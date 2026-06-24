// TTL & per-hop checksum recompute, made visible. Set an initial TTL and watch a packet
// cross a row of routers: each decrements the TTL and recomputes the real IPv4 header
// checksum (old value struck through, new highlighted). Lower the TTL until the packet
// dies mid-path and an ICMP Time Exceeded bounces back — the mechanism traceroute uses.
// Real checksum from the engine core; logic in ttlhop.ts (tested against 0xb861).
import { useMemo, useState } from 'react';
import { walk, checksumFor } from './ttlhop';

const ROUTERS = 5;
const hx = (n: number) => '0x' + n.toString(16).padStart(4, '0');

export function TtlHopSection() {
  const [ttl, setTtl] = useState(64);
  const j = useMemo(() => walk(ttl, ROUTERS), [ttl]);

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>TTL &amp; the recomputed checksum — a router’s real job</h2></div>
        <p className="jsec-sub">
          Every router does the same two things to every packet: subtract one from the <strong>Time To Live</strong>, and — because TTL
          lives in the header — recompute the 16-bit <strong>header checksum</strong>. The TTL stops packets from circling a routing
          loop forever; when it hits zero the packet is dropped and an <strong>ICMP Time Exceeded</strong> is sent home. Lower the start
          TTL and watch a packet die early.
        </p>

        <div className="ttl-set">
          <label>initial TTL <input type="range" min={1} max={64} value={ttl} onChange={(e) => setTtl(+e.target.value)} /><b>{ttl}</b></label>
          <span className="ttl-cksum0">start checksum {hx(checksumFor(ttl))}</span>
        </div>

        <div className="ttl-path">
          <div className="ttl-host">📤<span>source</span><em>TTL={ttl}</em></div>
          {j.hops.map((h) => (
            <div key={h.hop} className="ttl-hopwrap">
              <div className="ttl-wire" />
              <div className={`ttl-router ${h.expired ? 'dead' : 'live'}`}>
                <div className="ttl-rtitle">router {h.hop}</div>
                <div className="ttl-ttl">TTL {h.ttlIn} → <b>{h.ttlOut}</b></div>
                <div className="ttl-ck">cksum <s>{hx(checksumFor(h.ttlIn))}</s> <b>{hx(h.checksum)}</b></div>
                {h.expired && <div className="ttl-icmp">⚠ TTL=0 → drop<br />ICMP Time Exceeded ↩</div>}
              </div>
            </div>
          ))}
          {!j.expired && <div className="ttl-host"><div className="ttl-wire" />🎯<span>destination</span><em>delivered</em></div>}
        </div>

        <div className={`ttl-verdict ${j.expired ? 'bad' : 'ok'}`}>
          {j.expired
            ? `Packet expired at router ${j.hops.length} — it never reached the destination. The source learns this router's address from the ICMP reply (that's one traceroute probe).`
            : `Packet reached the destination in ${j.deliveredAtHop} hops, arriving with TTL ${j.hops[j.hops.length - 1].ttlOut}.`}
        </div>

        <p className="ttl-foot">
          The checksum change is predictable: TTL is the high byte of a 16-bit header word, so subtracting one from TTL subtracts
          0x0100 from the running sum and therefore <em>adds</em> 0x0100 to the one’s-complement checksum (RFC 1624 lets routers do this
          incrementally instead of re-summing the whole header). Traceroute sends packets with TTL = 1, 2, 3, … and reads the ICMP
          Time Exceeded from each router in turn to map the path. (IPv6 drops the header checksum entirely, trusting the layers below.)
        </p>
      </section>
    </div>
  );
}
