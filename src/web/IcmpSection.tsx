// ICMP explorer, made visible. The internet's control/error messages as a clickable
// table: each type expands to its codes, what triggers it, and a jump to the Apex
// section where you already saw it in action (traceroute uses Time Exceeded; the
// fragmentation section uses Frag-Needed). Real RFC 792 values (see icmp.ts).
import { useState } from 'react';
import { ICMP_TYPES, type IcmpType } from './icmp';
import { metaById } from './sections';

export function IcmpSection({ onOpen }: { onOpen?: (id: string) => void }) {
  const [open, setOpen] = useState<number | null>(8); // start on Echo Request (ping)

  const card = (t: IcmpType) => {
    const expanded = open === t.type;
    return (
      <div key={t.type} className={`icmp-card ${t.category} ${expanded ? 'open' : ''}`}>
        <button className="icmp-head" onClick={() => setOpen(expanded ? null : t.type)}>
          <span className="icmp-type">type {t.type}</span>
          <span className="icmp-name">{t.name}</span>
          <span className={`icmp-cat ${t.category}`}>{t.category}</span>
        </button>
        {expanded && (
          <div className="icmp-body">
            <div className="icmp-codes">
              {t.codes.map((c) => <div key={c.code} className="icmp-code"><span className="icmp-cn">code {c.code}</span> {c.meaning}</div>)}
            </div>
            <p className="icmp-trigger">{t.trigger}</p>
            {t.seenIn && metaById[t.seenIn] && (
              <button className="icmp-link" onClick={() => onOpen?.(t.seenIn!)}>▶ seen in: {metaById[t.seenIn].icon} {metaById[t.seenIn].label}</button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>ICMP — the internet’s error &amp; control messages</h2></div>
        <p className="jsec-sub">
          IP just forwards packets; when something goes wrong — TTL hits zero, no route exists, a packet is too big —
          a router sends back an <strong>ICMP</strong> message saying what happened. <strong>ping</strong> (Echo) and
          <strong> traceroute</strong> (Time Exceeded) are built entirely on it. Click a type to see its codes and where
          Apex already shows it.
        </p>

        <div className="icmp-grid">
          <div className="icmp-col">
            <div className="icmp-col-h">Query messages</div>
            {ICMP_TYPES.filter((t) => t.category === 'query').map(card)}
          </div>
          <div className="icmp-col">
            <div className="icmp-col-h">Error messages</div>
            {ICMP_TYPES.filter((t) => t.category === 'error').map(card)}
          </div>
        </div>
        <p className="enc-note">ICMP carries no ports and isn’t a transport — it rides directly in IP (protocol 1). Each error message also echoes back
          the IP header + first 8 bytes of the offending packet, so the sender can match the error to the exact flow that caused it. Blanket-blocking
          ICMP “for security” is a classic mistake: it breaks Path-MTU Discovery, leaving connections that mysteriously hang on large transfers.</p>
      </section>
    </div>
  );
}
