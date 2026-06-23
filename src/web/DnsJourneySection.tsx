// DNS resolution journey — watch a name become an address by walking the
// delegation hierarchy: stub → recursive → root → TLD → authoritative, with
// referrals (NS) handing off one label closer each hop, and caching/TTL shown
// honestly. The walk is the real RFC 1034 §4.3 model (see dnsjourney.ts).
import { useEffect, useMemo, useState } from 'react';
import { resolve, type RecordType, type ServerRole, type DnsRecord } from './dnsjourney';

const SERVERS: { role: ServerRole; label: string; sub: string }[] = [
  { role: 'stub', label: 'Stub resolver', sub: 'your device' },
  { role: 'recursive', label: 'Recursive resolver', sub: '1.1.1.1 / ISP' },
  { role: 'root', label: 'Root server', sub: '. (13 roots)' },
  { role: 'tld', label: 'TLD server', sub: 'the .com zone' },
  { role: 'authoritative', label: 'Authoritative', sub: 'owns the zone' },
];
const KIND_LABEL: Record<string, string> = { query: 'QUERY', referral: 'REFERRAL', answer: 'ANSWER' };

export function DnsJourneySection() {
  const [domain, setDomain] = useState('www.example.com');
  const [qtype, setQtype] = useState<RecordType>('A');
  const [warm, setWarm] = useState(false);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);

  const journey = useMemo(() => resolve(domain.trim() || 'www.example.com', qtype, warm), [domain, qtype, warm]);
  const hops = journey.hops;

  useEffect(() => { setStep(0); setPlaying(false); }, [domain, qtype, warm]);
  useEffect(() => {
    if (!playing) return;
    if (step >= hops.length) { setPlaying(false); return; }
    const id = setTimeout(() => setStep((s) => Math.min(s + 1, hops.length)), 1300);
    return () => clearTimeout(id);
  }, [playing, step, hops.length]);

  const current = step > 0 ? hops[step - 1] : null;
  const visited = new Set<ServerRole>();
  for (let i = 0; i < step; i++) { visited.add(hops[i].from); visited.add(hops[i].to); }

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>DNS resolution — how a name finds its address</h2></div>
        <p className="jsec-sub">
          Your device asks one question; the recursive resolver does the walking — from a root server down through
          the TLD to the domain’s own authoritative servers, each <strong>referring</strong> it one label closer.
          Then it <strong>caches</strong> the answer, which is why the next visit is instant. Step through it.
        </p>

        <div className="dns-controls">
          <label>domain
            <input value={domain} onChange={(e) => setDomain(e.target.value)} spellCheck={false} placeholder="www.example.com" />
          </label>
          <label>type
            <select value={qtype} onChange={(e) => setQtype(e.target.value as RecordType)}>
              <option value="A">A (IPv4)</option>
              <option value="AAAA">AAAA (IPv6)</option>
            </select>
          </label>
          <label className="dns-warm">
            <input type="checkbox" checked={warm} onChange={(e) => setWarm(e.target.checked)} /> warm cache
          </label>
          <div className="dns-play">
            <button className="ghost small" onClick={() => { setStep(0); setPlaying(false); }}>⏮</button>
            <button className="ghost small" disabled={step === 0} onClick={() => { setStep((s) => Math.max(0, s - 1)); setPlaying(false); }}>‹</button>
            <button className="ghost small" disabled={step >= hops.length} onClick={() => { setStep((s) => Math.min(hops.length, s + 1)); setPlaying(false); }}>step ›</button>
            <button className="ghost small" onClick={() => { if (step >= hops.length) setStep(0); setPlaying((p) => !p); }}>{playing ? '⏸' : '▶ play'}</button>
            <span className="dns-prog">{step}/{hops.length}</span>
          </div>
        </div>

        <div className="dns-servers">
          {SERVERS.map((s) => {
            const inUse = warm && (s.role === 'root' || s.role === 'tld' || s.role === 'authoritative');
            const cls = [
              'dns-server',
              visited.has(s.role) ? 'visited' : '',
              current && current.from === s.role ? 'from' : '',
              current && current.to === s.role ? 'to' : '',
              inUse ? 'skipped' : '',
            ].join(' ');
            return (
              <div key={s.role} className={cls}>
                <div className="ds-icon">{iconFor(s.role)}</div>
                <div className="ds-label">{s.label}</div>
                <div className="ds-sub">{s.sub}</div>
              </div>
            );
          })}
        </div>

        <div className="dns-detail">
          {current ? (
            <>
              <div className="dns-d-head">
                <span className={`dns-kind ${current.kind}`}>{KIND_LABEL[current.kind]}</span>
                <span className="dns-route">{roleLabel(current.from)} → {roleLabel(current.to)}</span>
                {current.cached && <span className="dns-cache-badge">⚡ from cache</span>}
              </div>
              <p className="dns-note">{current.note}</p>
              {current.records.length > 0 && (
                <div className="dns-records">
                  {current.records.map((r, i) => <RecordRow key={i} r={r} />)}
                </div>
              )}
            </>
          ) : (
            <p className="dns-note">Press <strong>step ›</strong> to send the first query. {warm ? 'With a warm cache the resolver answers in one hop.' : 'On a cold cache it walks the whole hierarchy.'}</p>
          )}
          {step >= hops.length && journey.answer && (
            <div className="dns-final">✓ resolved <strong>{journey.qname}</strong> {journey.qtype} = <strong>{journey.answer.value}</strong> · cached for {journey.answer.ttl}s (TTL)</div>
          )}
        </div>

        <p className="enc-note">Caching with a TTL is the whole reason DNS scales: the root and TLD servers would melt if every
          lookup walked the full tree. Lower a record’s TTL for faster changes; raise it for fewer queries.</p>
      </section>
    </div>
  );
}

function RecordRow({ r }: { r: DnsRecord }) {
  return (
    <div className="dns-rec">
      <span className={`dns-rtype ${r.type}`}>{r.type}</span>
      <span className="dns-rname">{r.name}</span>
      <span className="dns-rarrow">→</span>
      <code className="dns-rval">{r.value}</code>
      <span className="dns-rttl">TTL {r.ttl}s</span>
    </div>
  );
}

const iconFor = (role: ServerRole) => ({ stub: '💻', recursive: '🔁', root: '🌐', tld: '🏷️', authoritative: '📇' }[role]);
const roleLabel = (role: ServerRole) => SERVERS.find((s) => s.role === role)?.label ?? role;
