// IPv6 SLAAC, made visible. Type a MAC and watch the host mint its own addresses with
// no DHCP: the Modified EUI-64 derivation (insert FF:FE, flip the U/L bit), the
// link-local fe80:: address, a global address from an advertised /64 prefix, and the
// solicited-node multicast it joins for Duplicate Address Detection. A second panel
// classifies any IPv6 address you type by its leading bits. Real logic in slaac.ts.
import { useMemo, useState } from 'react';
import { parse, compress, eui64, withPrefix, linkLocal, solicitedNode, classify } from './slaac';

const hex2 = (n: number) => n.toString(16).padStart(2, '0');

export function SlaacSection() {
  const [mac, setMac] = useState('00:1a:2b:3c:4d:5e');
  const [prefix, setPrefix] = useState('2001:db8::');
  const [probe, setProbe] = useState('fe80::1');

  const built = useMemo(() => {
    try {
      const bytes = mac.split(/[:-]/);
      if (bytes.length !== 6 || bytes.some((b) => isNaN(parseInt(b, 16)))) return null;
      const e = eui64(mac);
      const ll = linkLocal(e.iid);
      const ga = withPrefix(parse(prefix), e.iid);
      const sn = solicitedNode(ga);
      return { e, ll: compress(ll), ga: compress(ga), sn: compress(sn) };
    } catch { return null; }
  }, [mac, prefix]);

  const cls = useMemo(() => {
    try { return classify(parse(probe)); } catch { return null; }
  }, [probe]);

  const macBytes = mac.split(/[:-]/).map((b) => parseInt(b, 16) & 0xff);

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>SLAAC — a host that addresses itself</h2></div>
        <p className="jsec-sub">
          With no DHCP server in sight, an IPv6 host builds its own addresses. It turns its 48-bit MAC into a 64-bit
          <strong> interface identifier</strong> (Modified EUI-64), then glues that onto the link-local prefix and any global /64 a
          router advertises. Edit the MAC and prefix and watch every address recompute.
        </p>

        <div className="slaac-io">
          <label>MAC address <input value={mac} onChange={(e) => setMac(e.target.value)} spellCheck={false} /></label>
          <label>Advertised /64 prefix <input value={prefix} onChange={(e) => setPrefix(e.target.value)} spellCheck={false} /></label>
        </div>

        {!built ? <div className="slaac-bad">Enter a MAC as 6 hex octets, e.g. <code>00:1a:2b:3c:4d:5e</code></div> : (
          <>
            <div className="slaac-eui">
              <div className="slaac-step">
                <span className="slaac-k">1 · split the MAC</span>
                <span className="slaac-bytes">
                  {macBytes.slice(0, 3).map((b, i) => <em key={i}>{hex2(b)}</em>)}
                  <i className="slaac-gap">▏</i>
                  {macBytes.slice(3).map((b, i) => <em key={i}>{hex2(b)}</em>)}
                </span>
              </div>
              <div className="slaac-step">
                <span className="slaac-k">2 · insert <code>ff:fe</code></span>
                <span className="slaac-bytes">
                  {macBytes.slice(0, 3).map((b, i) => <em key={i}>{hex2(b)}</em>)}
                  <em className="slaac-ins">ff</em><em className="slaac-ins">fe</em>
                  {macBytes.slice(3).map((b, i) => <em key={i}>{hex2(b)}</em>)}
                </span>
              </div>
              <div className="slaac-step">
                <span className="slaac-k">3 · flip the U/L bit (^0x02)</span>
                <span className="slaac-bytes">
                  <em className="slaac-flip" title={`${hex2(macBytes[0])} → ${hex2(built.e.flippedFirstByte)}`}>{hex2(built.e.flippedFirstByte)}</em>
                  {built.e.bytes.slice(1).map((b, i) => <em key={i} className={i === 2 || i === 3 ? 'slaac-ins' : ''}>{hex2(b)}</em>)}
                </span>
              </div>
            </div>

            <div className="slaac-addrs">
              <div className="slaac-addr"><span className="slaac-label">Link-local</span><code>{built.ll}</code><span className="slaac-tag">fe80::/64 · on-link only</span></div>
              <div className="slaac-addr global"><span className="slaac-label">Global</span><code>{built.ga}</code><span className="slaac-tag">prefix ⊕ interface id</span></div>
              <div className="slaac-addr"><span className="slaac-label">Solicited-node</span><code>{built.sn}</code><span className="slaac-tag">joined for DAD / neighbor discovery</span></div>
            </div>
          </>
        )}

        <div className="slaac-classify">
          <div className="jsec-head"><h2>Classify any IPv6 address</h2></div>
          <p className="jsec-sub">Every IPv6 address announces its kind in its leading bits — no lookup needed. Type one:</p>
          <input className="slaac-probe" value={probe} onChange={(e) => setProbe(e.target.value)} spellCheck={false} />
          {cls && (
            <div className="slaac-result">
              <div className="slaac-type">{cls.type}</div>
              <div className="slaac-prefix">matches <code>{cls.prefix}</code>{cls.scope && <> · scope <strong>{cls.scope}</strong></>}</div>
              {cls.note && <div className="slaac-note">{cls.note}</div>}
            </div>
          )}
        </div>

        <p className="slaac-foot">
          The host doesn’t just assume the address works — it runs <strong>Duplicate Address Detection</strong>: it joins the
          solicited-node multicast group and sends a Neighbor Solicitation to its own tentative address. Silence means the address is
          unique and becomes usable. (Privacy addresses, RFC 8981, replace the MAC-derived identifier with a random one so you can’t be
          tracked across networks by your hardware address.)
        </p>
      </section>
    </div>
  );
}
