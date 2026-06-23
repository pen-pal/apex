// QoS packet scheduling, made visible. Three traffic classes share one link. Under
// STRICT PRIORITY the link drains VoIP first — great latency for VoIP, but bulk can
// STARVE. Under WEIGHTED ROUND ROBIN every class gets a share by weight, so nobody
// starves. Fill the queues, toggle the discipline, and watch the output. Real
// scheduling math (see qos.ts).
import { useEffect, useMemo, useState } from 'react';
import { schedule, type Discipline, type TClass } from './qos';

const COLORS: Record<string, string> = { voip: 'hsl(212 70% 52%)', video: 'hsl(28 75% 52%)', bulk: 'hsl(145 55% 42%)' };
const DEFAULTS: TClass[] = [
  { id: 'voip', priority: 0, weight: 1, queue: 8 },
  { id: 'video', priority: 1, weight: 2, queue: 6 },
  { id: 'bulk', priority: 2, weight: 4, queue: 10 },
];
const LABEL: Record<string, string> = { voip: 'VoIP (calls)', video: 'Video stream', bulk: 'Bulk download' };

export function QosSection() {
  const [classes, setClasses] = useState<TClass[]>(DEFAULTS.map((c) => ({ ...c })));
  const [discipline, setDiscipline] = useState<Discipline>('priority');
  const [linkSlots, setLinkSlots] = useState(10);
  const [step, setStep] = useState(linkSlots);
  const [playing, setPlaying] = useState(false);

  const result = useMemo(() => schedule(classes, discipline, linkSlots), [classes, discipline, linkSlots]);
  const totalQueued = classes.reduce((s, c) => s + c.queue, 0);

  useEffect(() => { setStep(result.order.length); }, [classes, discipline, linkSlots]);
  useEffect(() => {
    if (!playing) return;
    if (step >= result.order.length) { setPlaying(false); return; }
    const id = setTimeout(() => setStep((s) => Math.min(s + 1, result.order.length)), 350);
    return () => clearTimeout(id);
  }, [playing, step, result.order.length]);

  const shown = result.order.slice(0, step);
  const shareShown: Record<string, number> = {};
  for (const id of shown) shareShown[id] = (shareShown[id] ?? 0) + 1;
  const bump = (id: string, d: number) => { setClasses((cs) => cs.map((c) => (c.id === id ? { ...c, queue: Math.max(0, Math.min(16, c.queue + d)) } : c))); };

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>QoS scheduling — whose packet goes next?</h2></div>
        <p className="jsec-sub">
          When several kinds of traffic share one link, the scheduler decides the order. <strong>Strict priority</strong>
          {' '}sends the most important class first — perfect for latency-sensitive VoIP, but a busy high class can
          <strong> starve</strong> the rest. <strong>Weighted round robin</strong> gives every class a share by weight, so
          nobody is shut out. Fill the queues and compare.
        </p>

        <div className="qos-disc">
          <div className="seg">
            <button className={discipline === 'priority' ? 'on' : ''} onClick={() => setDiscipline('priority')}>Strict priority</button>
            <button className={discipline === 'wrr' ? 'on' : ''} onClick={() => setDiscipline('wrr')}>Weighted round robin</button>
          </div>
          <label className="qos-link">link capacity this window: {linkSlots}<input type="range" min={4} max={20} value={linkSlots} onChange={(e) => setLinkSlots(+e.target.value)} /></label>
        </div>

        <div className="qos-queues">
          {classes.map((c) => (
            <div className="qos-class" key={c.id}>
              <div className="qos-c-head">
                <span className="qos-dot" style={{ background: COLORS[c.id] }} />
                <span className="qos-name">{LABEL[c.id]}</span>
                <span className="qos-meta">prio {c.priority} · weight {c.weight}</span>
              </div>
              <div className="qos-q">
                {Array.from({ length: c.queue }, (_, i) => <span key={i} className="qos-pkt" style={{ background: COLORS[c.id] }} />)}
                {c.queue === 0 && <span className="qos-empty">empty</span>}
              </div>
              <div className="qos-q-ctrl">
                <button onClick={() => bump(c.id, -1)}>−</button><span>{c.queue} queued</span><button onClick={() => bump(c.id, 1)}>+</button>
              </div>
            </div>
          ))}
        </div>

        <div className="qos-play">
          <button className="ghost small" onClick={() => { setStep(0); setPlaying(false); }}>⏮</button>
          <button className="ghost small" onClick={() => { if (step >= result.order.length) setStep(0); setPlaying((p) => !p); }}>{playing ? '⏸' : '▶ run the link'}</button>
          <button className="ghost small" onClick={() => { setStep(result.order.length); setPlaying(false); }}>all</button>
          <span className="qos-prog">{step}/{result.order.length} sent · {totalQueued} queued</span>
        </div>

        <div className="qos-wire-label">output link (transmission order →)</div>
        <div className="qos-wire">
          {result.order.map((id, i) => <span key={i} className={`qos-out ${i < step ? 'on' : ''}`} style={{ background: i < step ? COLORS[id] : '#eef2f7' }} />)}
          {result.order.length === 0 && <span className="qos-empty">no packets queued</span>}
        </div>

        <div className="qos-shares">
          {classes.map((c) => {
            const sent = shareShown[c.id] ?? 0;
            const pct = step ? (sent / step) * 100 : 0;
            const starved = c.queue > 0 && sent === 0 && step >= result.order.length;
            return (
              <div className="qos-share-row" key={c.id}>
                <span className="qos-share-name" style={{ color: COLORS[c.id] }}>{c.id}</span>
                <div className="qos-share-bar"><div className="qos-share-fill" style={{ width: `${pct}%`, background: COLORS[c.id] }} /></div>
                <span className="qos-share-val">{sent}/{c.queue} sent · {Math.round(pct)}%{starved && <strong className="qos-starved"> STARVED</strong>}</span>
              </div>
            );
          })}
        </div>
        {discipline === 'priority' && result.starved.length > 0 && step >= result.order.length && (
          <p className="qos-warn">⚠ Strict priority starved {result.starved.join(', ')}: the higher-priority queues used the whole link. This is why pure priority needs a rate limit on the top classes — or you use WRR/WFQ to guarantee everyone a slice.</p>
        )}
        <p className="enc-note">Real routers combine both: a small strict-priority queue for real-time traffic (voice, gaming) that must never wait,
          and weighted fair queues underneath it for everything else. DiffServ (the DSCP bits in the IP header) is how packets get tagged into these classes.</p>
      </section>
    </div>
  );
}
