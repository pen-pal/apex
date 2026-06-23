// Subnetting — make CIDR visible. A /n prefix draws a line through the 32 bits:
// everything left of it is the network (fixed), everything right is the host
// (varies). This section shows that line on the actual bits, computes the block,
// and lets you split it into equal child subnets (VLSM). Math is real (subnet.ts).
import { useMemo, useState } from 'react';
import { subnet, splitInto, parseIp } from './subnet';

export function SubnetSection() {
  const [cidr, setCidr] = useState('192.168.1.0/24');
  const s = useMemo(() => subnet(cidr), [cidr]);
  const prefix = s.ok ? s.prefix : 24;
  const [splitPrefix, setSplitPrefix] = useState(26);

  const ipInt = useMemo(() => parseIp((cidr.split('/')[0] || '').trim()) ?? 0, [cidr]);
  const blocks = useMemo(() => (s.ok ? splitInto(cidr, Math.max(splitPrefix, s.prefix + 1)) : null), [cidr, splitPrefix, s]);

  const bits = Array.from({ length: 32 }, (_, i) => (ipInt >>> (31 - i)) & 1);

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Subnetting &amp; CIDR — where the network ends and the host begins</h2></div>
        <p className="jsec-sub">
          A CIDR prefix <code>/n</code> fixes the top <em>n</em> bits as the network and leaves the rest for hosts.
          Type a block and watch the boundary fall on the actual 32 bits; then split it into equal subnets.
        </p>

        <div className="sub-controls">
          <label>CIDR
            <input className="sub-input" value={cidr} onChange={(e) => setCidr(e.target.value)} spellCheck={false} placeholder="192.168.1.0/24" />
          </label>
          {s.ok && (
            <label className="sub-prefix">prefix /{prefix}
              <input type="range" min={0} max={32} value={prefix} onChange={(e) => setCidr(`${s.network}/${e.target.value}`)} />
            </label>
          )}
        </div>

        {!s.ok ? <p className="enc-err">{s.error}</p> : (
          <>
            <div className="sub-bits">
              {bits.map((b, i) => {
                const isNet = i < prefix;
                const octetEnd = i % 8 === 7 && i !== 31;
                return (
                  <span key={i} className={`sub-bit ${isNet ? 'net' : 'host'} ${i === prefix - 1 ? 'edge' : ''} ${octetEnd ? 'octet' : ''}`}>{b}</span>
                );
              })}
            </div>
            <div className="sub-bitlegend">
              <span><i className="sw net" /> network bits ({prefix})</span>
              <span><i className="sw host" /> host bits ({32 - prefix})</span>
            </div>

            <div className="sub-grid">
              <Cell k="network" v={`${s.network}/${prefix}`} hl />
              <Cell k="broadcast" v={s.broadcast} />
              <Cell k="netmask" v={s.mask} />
              <Cell k="wildcard" v={s.wildcard} />
              <Cell k="host range" v={`${s.firstHost} – ${s.lastHost}`} />
              <Cell k="usable hosts" v={s.usableHosts.toLocaleString()} hl />
              <Cell k="total addresses" v={s.totalAddresses.toLocaleString()} />
              <Cell k="mask bits" v={`/${prefix}`} />
            </div>

            <div className="sub-split-head">
              <span>Split this /{prefix} into</span>
              <select value={splitPrefix} onChange={(e) => setSplitPrefix(Number(e.target.value))}>
                {Array.from({ length: Math.min(32 - prefix, 10) }, (_, i) => prefix + 1 + i).map((p) => (
                  <option key={p} value={p}>/{p} · {2 ** (p - prefix)} subnets</option>
                ))}
              </select>
            </div>

            {blocks && blocks.length > 0 ? (
              <>
                <div className="sub-map">
                  {blocks.map((b, i) => (
                    <button key={b.network} className="sub-seg" style={{ background: i % 2 ? 'hsl(212 70% 90%)' : 'hsl(212 70% 82%)' }}
                      title={`${b.network}/${b.prefix} · ${b.usableHosts} hosts`} onClick={() => setCidr(`${b.network}/${b.prefix}`)}>
                      {blocks.length <= 16 ? `.${b.network.split('.')[3]}` : ''}
                    </button>
                  ))}
                </div>
                <div className="sub-blocklist">
                  {blocks.slice(0, 64).map((b) => (
                    <button key={b.network} className="sub-block" onClick={() => setCidr(`${b.network}/${b.prefix}`)}>
                      <code>{b.network}/{b.prefix}</code><span>{b.usableHosts.toLocaleString()} hosts</span>
                    </button>
                  ))}
                  {blocks.length > 64 && <span className="sub-more">+{blocks.length - 64} more subnets</span>}
                </div>
              </>
            ) : <p className="enc-note">This block can’t be split further (already a /{prefix}).</p>}
          </>
        )}
        <p className="enc-note">Each extra prefix bit halves the block: a /24 (254 hosts) becomes two /25s (126 each), four /26s (62), and
          so on. VLSM just means using different prefix lengths for different needs — a /30 for a router link, a /23 for a big LAN.</p>
      </section>
    </div>
  );
}

function Cell({ k, v, hl }: { k: string; v: string; hl?: boolean }) {
  return (
    <div className={`sub-cell ${hl ? 'hl' : ''}`}>
      <span className="sub-k">{k}</span>
      <code className="sub-v">{v}</code>
    </div>
  );
}
