// mDNS + DNS-SD made visible — finding the printer with no DNS server. Pick a
// service type to multicast a PTR query; the devices offering it answer with their
// instance names; pick one and the SRV/TXT/A chain resolves it to host:port. Same
// DNS records as the unicast journey, but multicast to 224.0.0.251:5353 over .local.
// Model in mdns.ts (tested).
import { useState } from 'react';
import { SERVICES, serviceTypes, browse, resolve, target, MDNS_GROUP, MDNS_GROUP_V6, MDNS_PORT, type Service, type DnsRecord } from './mdns';

const KIND: Record<DnsRecord['kind'], string> = {
  PTR: 'service type → instance',
  SRV: 'instance → host : port',
  TXT: 'instance → metadata',
  A: 'host → IP address',
};

export function MdnsSection() {
  const types = serviceTypes(SERVICES);
  const [type, setType] = useState<string>(types[0]);
  const [instance, setInstance] = useState<Service | null>(null);

  const found = browse(SERVICES, type);
  const chain = instance ? resolve(instance) : null;

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>mDNS &amp; DNS-SD — discovery with no server</h2></div>
        <p className="jsec-sub">
          On a home or office LAN there’s no DNS server for your devices. mDNS uses the <em>same DNS wire format</em>, but sends
          queries to the multicast group <code>{MDNS_GROUP}</code> (<code>{MDNS_GROUP_V6}</code> on IPv6), UDP <code>{MDNS_PORT}</code>,
          for names under <strong>.local</strong>. Every device both asks and answers. <strong>DNS-SD</strong> then layers a record
          chain on top so “find me a printer” becomes an IP and port.
        </p>

        <div className="md-step">1 · browse a service type <span className="md-q">(multicast PTR query)</span></div>
        <div className="md-types">
          {types.map((t) => (
            <button key={t} className={t === type ? 'on' : ''} onClick={() => { setType(t); setInstance(null); }}>{t}</button>
          ))}
        </div>

        <div className="md-step">2 · instances that answered</div>
        <div className="md-instances">
          {found.map((s) => (
            <button key={s.instance} className={`md-inst ${instance?.instance === s.instance ? 'on' : ''}`} onClick={() => setInstance(s)}>
              <span className="md-inst-name">{s.instance}</span>
              <span className="md-inst-type">{s.instance}.{s.type}</span>
            </button>
          ))}
        </div>

        {chain && instance && (
          <>
            <div className="md-step">3 · resolve it (PTR → SRV → TXT → A)</div>
            <div className="md-chain">
              {chain.map((r, i) => (
                <div key={i} className={`md-rec ${r.kind}`}>
                  <div className="md-rec-h"><span className="md-rec-kind">{r.kind}</span> <span className="md-rec-what">{KIND[r.kind]}</span></div>
                  <div className="md-rec-name">{r.name}</div>
                  <div className="md-rec-val">{r.value}</div>
                </div>
              ))}
            </div>
            <div className="md-target">→ connect to <strong>{target(instance)}</strong> ({instance.host} = {instance.ip}, port {instance.port})</div>
          </>
        )}

        <p className="md-note">
          The records are exactly PTR/SRV/TXT/A from ordinary DNS — that’s why DNS-SD needed no new protocol. The differences are all
          about <em>locality</em>: multicast instead of a server, the <code>.local</code> top-level name, a “QU” bit asking for a
          unicast reply to cut noise, and short TTLs with goodbye packets so a device that leaves disappears quickly. AirPrint,
          AirPlay, Chromecast and “Open on your other devices” all ride on it.
        </p>
      </section>
    </div>
  );
}
