// IPv4 vs IPv6 header comparison, made visible. The two headers side by side, each
// field colored by what IPv6 did to it: kept, renamed, removed, or added. Click a
// field for the why. The story: IPv6 made the header a fixed 40 bytes, dropped the
// per-hop checksum and in-header fragmentation, and moved options to extension
// headers — so routers forward faster on a predictable layout. Real layouts (ipcompare.ts).
import { useState } from 'react';
import { IPV4_FIELDS, IPV6_FIELDS, headerBytes, type Field } from './ipcompare';

const CLASS_LABEL: Record<string, string> = { kept: 'kept', renamed: 'renamed / changed', removed: 'removed in IPv6', added: 'new in IPv6' };

export function IpCompareSection() {
  const [sel, setSel] = useState<Field | null>(null);

  const column = (title: string, sub: string, fields: Field[]) => (
    <div className="ipc-col">
      <div className="ipc-col-h">{title}<span className="ipc-bytes">{sub}</span></div>
      {fields.map((f) => (
        <button key={f.name} className={`ipc-field ${f.change} ${sel?.name === f.name && sel?.note === f.note ? 'sel' : ''}`} onClick={() => setSel(f)}>
          <span className="ipc-fn">{f.name}</span>
          <span className="ipc-bits">{f.bits === 0 ? 'var' : `${f.bits}b`}</span>
        </button>
      ))}
    </div>
  );

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>IPv4 vs IPv6 — what the header lost and gained</h2></div>
        <p className="jsec-sub">
          IPv6 isn’t just bigger addresses — it’s a <em>simpler</em> header. IPv4’s is variable-length with a per-hop
          checksum and fragmentation fields a router must touch; IPv6 fixed it at 40 bytes, dropped the checksum, moved
          fragmentation out of routers, and turned options into chained extension headers. Click any field to see why.
        </p>

        <div className="ipc-cols">
          {column('IPv4', `${headerBytes(IPV4_FIELDS)} bytes + options`, IPV4_FIELDS)}
          {column('IPv6', `${headerBytes(IPV6_FIELDS)} bytes, fixed`, IPV6_FIELDS)}
        </div>

        <div className="ipc-legend">
          {(['kept', 'renamed', 'removed', 'added'] as const).map((c) => <span key={c}><i className={`ipc-sw ${c}`} /> {CLASS_LABEL[c]}</span>)}
        </div>

        {sel ? (
          <div className={`ipc-detail ${sel.change}`}>
            <div className="ipc-d-head"><strong>{sel.name}</strong> · {sel.bits === 0 ? 'variable' : `${sel.bits} bits`} · <span className="ipc-d-class">{CLASS_LABEL[sel.change]}</span>{sel.maps && <span className="ipc-maps"> ↔ {sel.maps}</span>}</div>
            <p className="ipc-note-text">{sel.note}</p>
          </div>
        ) : <div className="ipc-hint">Click a field in either header to see what changed and why.</div>}

        <div className="ipc-summary">
          <div className="ipc-sum-h">Why IPv6 simplified the header</div>
          <ul>
            <li><strong>Fixed 40-byte header</strong> — no IHL, no options to parse: a router knows exactly where every field is, so forwarding is faster and hardware-friendly.</li>
            <li><strong>No header checksum</strong> — IPv4 routers recompute it at every hop (TTL changed); IPv6 drops it, trusting the L2 frame CRC and the L4 (TCP/UDP) checksum.</li>
            <li><strong>No router fragmentation</strong> — the Identification/Flags/Fragment-Offset fields are gone; only the source host may fragment (guided by Path-MTU Discovery).</li>
            <li><strong>Extension headers</strong> — rare features (fragmentation, routing, security) chain <em>after</em> the base header via Next Header, instead of bloating every packet.</li>
            <li><strong>128-bit addresses</strong> — 2¹²⁸ of them, ending address exhaustion and the need for NAT.</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
