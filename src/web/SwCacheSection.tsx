// Service Worker caching strategies, made visible. Pick a strategy and toggle whether the network is up and whether a
// copy is cached; watch which source answers (cache / network / error), whether it's fast and fresh, and whether it
// revalidates in the background. Model + tests in swcache.ts.
import { useMemo, useState } from 'react';
import { handle, type Strategy } from './swcache';

const STRATS: { id: Strategy; label: string }[] = [
  { id: 'cache-first', label: 'cache-first' }, { id: 'network-first', label: 'network-first' },
  { id: 'stale-while-revalidate', label: 'stale-while-revalidate' }, { id: 'network-only', label: 'network-only' },
  { id: 'cache-only', label: 'cache-only' },
];

export function SwCacheSection() {
  const [strategy, setStrategy] = useState<Strategy>('stale-while-revalidate');
  const [online, setOnline] = useState(true);
  const [cached, setCached] = useState(true);
  const o = useMemo(() => handle(strategy, { online, cached }), [strategy, online, cached]);

  return (
    <div className="swc">
      <div className="swc-controls">
        <div className="swc-seg"><span className="swc-seg-lbl">strategy</span>
          {STRATS.map((s) => <button key={s.id} type="button" className={strategy === s.id ? 'on' : ''} onClick={() => setStrategy(s.id)}>{s.label}</button>)}</div>
        <div className="swc-togs">
          <label className="swc-tog"><input type="checkbox" checked={online} onChange={(e) => setOnline(e.target.checked)} /> network online</label>
          <label className="swc-tog"><input type="checkbox" checked={cached} onChange={(e) => setCached(e.target.checked)} /> copy in cache</label>
        </div>
      </div>

      <div className="swc-flow">
        <div className="swc-node">📄 page<br /><span>fetch()</span></div>
        <div className="swc-arrow">→</div>
        <div className="swc-node swc-sw">⚙ Service&nbsp;Worker</div>
        <div className="swc-sources">
          <div className={`swc-src ${o.served === 'cache' ? 'swc-used' : ''} ${cached ? '' : 'swc-absent'}`}>🗃 cache<br /><span>{cached ? 'has a copy' : 'empty'}</span>{o.revalidates && <em className="swc-reval">↻ updating</em>}</div>
          <div className={`swc-src ${o.served === 'network' ? 'swc-used' : ''} ${online ? '' : 'swc-absent'}`}>🌐 network<br /><span>{online ? 'online' : 'offline'}</span></div>
        </div>
      </div>

      <div className={`swc-outcome swc-${o.served}`}>
        <div className="swc-served">{o.served === 'error' ? '✗ request failed' : `served from ${o.served}`}</div>
        {o.served !== 'error' && (
          <div className="swc-badges">
            <span className={o.fast ? 'swc-b-good' : 'swc-b-warn'}>{o.fast ? '⚡ fast' : '🐢 slower'}</span>
            <span className={o.fresh ? 'swc-b-good' : 'swc-b-warn'}>{o.fresh ? '✓ fresh' : '~ possibly stale'}</span>
            {o.revalidates && <span className="swc-b-good">↻ revalidating</span>}
          </div>
        )}
        <div className="swc-note">{o.note}</div>
      </div>

      <p className="swc-foot">
        A <strong>Service Worker</strong> is a script the browser keeps running beside your page; it intercepts every
        <code> fetch</code> and answers however you tell it to — which is what makes a web app work offline and load
        instantly on repeat visits. There’s no universally right policy, only a tradeoff: <strong>cache-first</strong>
        is instant and offline-proof but can go stale (perfect for the versioned app shell — JS/CSS that only changes on
        deploy); <strong>network-first</strong> is current but slower and needs a fallback (a live feed);
        <strong> stale-while-revalidate</strong> serves the old copy now and quietly fetches the new one for next time
        (avatars, thumbnails). The cache is content-addressed and you control eviction, so the hard parts are
        cache-busting on deploy and not trapping users on a stale version. (Service Workers; Workbox codifies these.)
      </p>
    </div>
  );
}
