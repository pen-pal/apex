// CDN / cache hierarchy, made visible. Request an object and watch it cascade
// browser → edge → origin: the first request is a slow cold miss, the next is an
// instant browser hit, and once TTLs expire the request revalidates at the origin.
// Advance time to age the caches. Real cache logic (see cachehierarchy.ts).
import { useMemo, useState } from 'react';
import { CacheHierarchy, TIERS, LATENCY, TTL, type Tier } from './cachehierarchy';

const OBJECTS = ['/logo.png', '/app.js', '/data.json', '/api/user', '/style.css'];
const TIER_LABEL: Record<Tier, string> = { browser: 'Browser cache', edge: 'CDN edge', origin: 'Origin server' };

type Event = { kind: 'req'; object: string } | { kind: 'time'; delta: number };

export function CacheHierarchySection() {
  const [events, setEvents] = useState<Event[]>([]);

  const { snap, now, last, hitRatio, requests } = useMemo(() => {
    const c = new CacheHierarchy();
    let now = 0;
    let last = null as ReturnType<CacheHierarchy['request']> | null;
    for (const e of events) {
      if (e.kind === 'time') now += e.delta;
      else last = c.request(e.object, now);
    }
    return { snap: c.snapshot(now), now, last, hitRatio: c.hitRatio, requests: c.requests };
  }, [events]);

  const req = (object: string) => setEvents((es) => [...es, { kind: 'req', object }]);
  const advance = (delta: number) => setEvents((es) => [...es, { kind: 'time', delta }]);
  const reset = () => setEvents([]);

  const outcomeAt = (tier: Tier) => last?.path.find((p) => p.tier === tier)?.outcome ?? null;

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>CDN &amp; caching — why the web feels fast</h2></div>
        <p className="jsec-sub">
          A request for an object cascades down a hierarchy of caches: your <strong>browser</strong>, then a nearby
          <strong> CDN edge</strong>, then the far-away <strong>origin</strong>. Each tier serves a <em>hit</em> if it holds
          a fresh copy, else a <em>miss</em> that falls through to the next tier. The first request is slow; the rest are
          instant — until the TTL expires and it must revalidate. Request an object and advance time.
        </p>

        <div className="cdn-controls">
          <span className="cdn-objs">request:</span>
          {OBJECTS.map((o) => <button key={o} className="ghost small" onClick={() => req(o)}>{o}</button>)}
          <span className="cdn-time">· t = {now}s</span>
          <button className="ghost small" onClick={() => advance(5)}>+5s</button>
          <button className="ghost small" onClick={() => advance(30)}>+30s</button>
          <button className="ghost small" onClick={() => advance(120)}>+120s</button>
          <button className="ghost small" onClick={reset}>↺ reset</button>
        </div>

        {last && (
          <div className="cdn-result">
            <strong>{last.object}</strong> served by <strong>{TIER_LABEL[last.servedBy]}</strong> in <strong>{last.latencyMs} ms</strong>
            {last.revalidated && ' · 304 revalidated (cheap refresh)'}
            {last.servedBy === 'origin' && !last.revalidated && ' · cold miss — full fetch'}
            {last.servedBy === 'browser' && ' · instant — never left the device'}
          </div>
        )}

        <div className="cdn-tiers">
          {TIERS.map((tier, i) => {
            const oc = outcomeAt(tier);
            const served = last?.servedBy === tier;
            return (
              <div key={tier}>
                {i > 0 && <div className={`cdn-arrow ${oc ? 'on' : ''}`}>↓ {oc === 'miss' ? 'miss — fall through' : ''}</div>}
                <div className={`cdn-tier ${oc ?? ''} ${served ? 'served' : ''}`}>
                  <div className="cdn-tier-head">
                    <span className="cdn-tier-name">{TIER_LABEL[tier]}</span>
                    <span className="cdn-tier-lat">{LATENCY[tier]} ms · TTL {TTL[tier] === Infinity ? '∞' : TTL[tier] + 's'}</span>
                    {oc && <span className={`cdn-badge ${oc}`}>{oc.toUpperCase()}</span>}
                  </div>
                  <div className="cdn-objs-held">
                    {snap[tier].length === 0 && <span className="cdn-empty">— empty —</span>}
                    {snap[tier].map((e) => {
                      const expired = e.ttlLeft === 0 && tier !== 'origin';
                      return <span key={e.object} className={`cdn-obj ${expired ? 'expired' : ''}`}>{e.object}<em>{tier === 'origin' || e.ttlLeft === Infinity ? '∞' : expired ? 'expired' : `${e.ttlLeft}s`}</em></span>;
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="cdn-stats">
          <span>requests: <strong>{requests}</strong></span>
          <span>cache hit ratio: <strong>{Math.round(hitRatio * 100)}%</strong></span>
        </div>
        <p className="enc-note">The whole game of a CDN is raising the hit ratio: each edge hit avoids a slow trip to the origin and
          shields it from load. TTLs trade freshness for speed — short TTLs mean fresher content but more origin traffic; long TTLs are faster but
          risk serving stale data, which is why cache invalidation (purging) is famously one of the hard problems.</p>
      </section>
    </div>
  );
}
