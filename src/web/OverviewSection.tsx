// The overview / home catalog — a browsable, filterable map of every section, grouped, so the breadth
// is discoverable at a glance (reached by clicking the Apex logo). Guided JOURNEYS sit on top (curated
// ordered walks); below, a single search box + an accordion of groups (collapsed by default, click to
// expand) make the 200-section catalog navigable WITHOUT duplicating the top nav. Pure presentation over
// the section + path registries, plus local search/expand state.
import { useEffect, useMemo, useRef, useState } from 'react';
import { GROUPS, metaById } from './sections';
import { PATHS, FEATURED_JOURNEYS, pathById, type LearningPath } from './paths';

// Ambient hero art: a packet drifting a lattice, painted from the live theme tokens. No data — pure atmosphere,
// echoing the "watch a packet travel the wire" idea. Repaints on resize and theme flip; honors reduced-motion.
function HeroArt() {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const css = (k: string) => getComputedStyle(document.documentElement).getPropertyValue(k).trim();
    const reduce = window.matchMedia?.('(prefers-reduced-motion:reduce)').matches;
    let raf = 0, t0 = performance.now();
    const draw = (now: number) => {
      const p = cv.parentElement!;
      const dpr = Math.min(window.devicePixelRatio || 1, 2), w = p.clientWidth, h = p.clientHeight;
      cv.width = w * dpr; cv.height = h * dpr;
      const g = cv.getContext('2d')!; g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const line = css('--line'), ac = css('--accent'), am = css('--gold'), ink = css('--muted');
      const N = 6, m = 28, sx = (w - 2 * m) / (N - 1), sy = (h - 2 * m) / (N - 1);
      g.clearRect(0, 0, w, h); g.strokeStyle = line; g.lineWidth = 1;
      for (let i = 0; i < N; i++) {
        g.beginPath(); g.moveTo(m, m + i * sy); g.lineTo(w - m, m + i * sy); g.stroke();
        g.beginPath(); g.moveTo(m + i * sx, m); g.lineTo(m + i * sx, h - m); g.stroke();
      }
      g.fillStyle = ink;
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { g.beginPath(); g.arc(m + j * sx, m + i * sy, 1.3, 0, 7); g.fill(); }
      const path = [[0, 0], [1, 0], [1, 1], [2, 1], [2, 2], [3, 2], [3, 3], [4, 3], [4, 4], [5, 4], [5, 5]];
      const T = (now - t0) / 1400, seg = Math.floor(T) % (path.length - 1), k = T % 1, a = path[seg], b = path[seg + 1];
      const px = m + (a[0] + (b[0] - a[0]) * k) * sx, py = m + (a[1] + (b[1] - a[1]) * k) * sy;
      g.fillStyle = ac; g.beginPath(); g.arc(m, m, 3.5, 0, 7); g.fill();
      g.beginPath(); g.arc(w - m, h - m, 3.5, 0, 7); g.fill();
      g.fillStyle = am; g.shadowColor = am; g.shadowBlur = 8; g.beginPath(); g.arc(px, py, 4.5, 0, 7); g.fill(); g.shadowBlur = 0;
      if (!reduce) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    const ro = new ResizeObserver(() => { t0 = performance.now(); });
    ro.observe(cv.parentElement!);
    const mo = new MutationObserver(() => { /* token colors re-read each frame; nudge a repaint if reduced-motion */ if (reduce) requestAnimationFrame(draw); });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => { cancelAnimationFrame(raf); ro.disconnect(); mo.disconnect(); };
  }, []);
  return <canvas ref={ref} aria-hidden="true" />;
}

export function OverviewSection({ onPick, onStartPath, current }: { onPick: (id: string) => void; onStartPath: (pathId: string) => void; current: string }) {
  const total = GROUPS.reduce((n, g) => n + g.ids.length, 0);
  const [q, setQ] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<LearningPath | null>(null);

  // Escape closes the journey preview.
  useEffect(() => {
    if (!preview) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPreview(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [preview]);

  const ql = q.trim().toLowerCase();
  const searching = ql !== '';
  const toggle = (label: string) => setExpanded((s) => { const n = new Set(s); n.has(label) ? n.delete(label) : n.add(label); return n; });
  const [showAllJ, setShowAllJ] = useState(false);
  const [jq, setJq] = useState('');
  const journeyMatches = useMemo(() => {
    const t = jq.trim().toLowerCase();
    if (!t) return PATHS;
    return PATHS.filter((p) => p.title.toLowerCase().includes(t) || p.blurb.toLowerCase().includes(t)
      || p.steps.some((s) => (metaById[s.id]?.label ?? s.id).toLowerCase().includes(t)));
  }, [jq]);

  const card = (p: LearningPath) => (
    <button key={p.id} type="button" className="jp-card" onClick={() => setPreview(p)}>
      <div className="jp-card-top">
        <span className="jp-icon" aria-hidden="true">{p.icon}</span>
        <span className="jp-title">{p.title}</span>
        <span className="jp-count">{p.steps.length} steps</span>
      </div>
      <p className="jp-blurb">{p.blurb}</p>
      <div className="jp-trail">
        {p.steps.slice(0, 4).map((s, i) => (
          <span key={s.id} className="jp-stop">
            {i > 0 && <span className="jp-arrow" aria-hidden="true">→</span>}
            <span className="jp-stop-lbl">{metaById[s.id]?.label ?? s.id}</span>
          </span>
        ))}
        {p.steps.length > 4 && (
          <span className="jp-stop"><span className="jp-arrow" aria-hidden="true">→</span><span className="jp-stop-lbl jp-more">+{p.steps.length - 4} more</span></span>
        )}
      </div>
      <span className="jp-start">Preview journey →</span>
    </button>
  );

  const visible = useMemo(() => GROUPS.map((g) => ({
    ...g,
    ids: searching ? g.ids.filter((id) => { const m = metaById[id]; return m && (m.label.toLowerCase().includes(ql) || g.label.toLowerCase().includes(ql)); }) : g.ids,
  })).filter((g) => g.ids.length > 0), [ql, searching]);
  const matchCount = visible.reduce((n, g) => n + g.ids.length, 0);
  // While searching, every matching group auto-expands; otherwise honor the accordion state.
  const isOpen = (label: string) => searching || expanded.has(label);

  return (
    <div className="ov">
      <div className="ov-hero">
        <div className="ov-hero-text">
          <div className="ov-kicker">Learn a system by running it</div>
          <h1 className="ov-htitle">
            The systems that run the world, as playgrounds you can <em>build, break, and&nbsp;watch.</em>
          </h1>
          <p className="ov-lede">
            Not another wiki. Each of the {total} sections is a <strong>live simulation</strong> in your browser — real bytes,
            real checksums, honest crypto, every model checked against an independent reference. Wire it up, press go, and watch
            the mechanics move. New here? Take a guided journey below; after something specific? Search or pick an area above.
          </p>
        </div>
        <div className="ov-hero-art"><HeroArt /></div>
      </div>
      <div className="ov-feats">
        {([
          ['01', 'Validated', 'Every model is checked against an independent source — an RFC, a FIPS/NIST test vector, or a reference implementation.'],
          ['02', 'In-browser', 'The simulator is the page. No downloads, no accounts, no server round-trip.'],
          ['03', 'Cinematic', 'Sections auto-play their mechanism — a moving picture, not a static diagram.'],
          ['04', 'Offline', 'Fully static, no backend. Once loaded it runs on a plane, in a lab, behind an airgap.'],
        ] as const).map(([n, t, d]) => (
          <div className="ov-feat" key={n}>
            <span className="ov-feat-n">{n}</span>
            <h3 className="ov-feat-t">{t}</h3>
            <p className="ov-feat-d">{d}</p>
          </div>
        ))}
      </div>

      {!searching && (
        <div className="jp">
          <div className="jp-head"><span className="jp-eyebrow">Guided journeys</span><h2>Walk one idea end to end</h2></div>
          <div className="jp-featured">
            <span className="jp-featured-lbl">Start here</span>
            <div className="jp-grid">
              {FEATURED_JOURNEYS.map((id) => pathById[id]).filter(Boolean).map(card)}
            </div>
          </div>
          <div className="jp-browse">
            {showAllJ || jq ? (
              <>
                <div className="jp-browse-head">
                  <span className="jp-browse-lbl">All {PATHS.length} journeys</span>
                  <input className="jp-filter" type="search" value={jq} placeholder="🔎 filter journeys…" onChange={(e) => setJq(e.target.value)} aria-label="Filter journeys" />
                  <button type="button" className="jp-collapse" onClick={() => { setShowAllJ(false); setJq(''); }}>collapse ▴</button>
                </div>
                {journeyMatches.length ? (
                  <div className="jp-grid">{journeyMatches.map(card)}</div>
                ) : (
                  <div className="jp-noresult">No journeys match “{jq}”.</div>
                )}
              </>
            ) : (
              <button type="button" className="jp-showall" onClick={() => setShowAllJ(true)}>Show all {PATHS.length} journeys →</button>
            )}
          </div>
        </div>
      )}

      {/* The full catalog duplicates the top-nav groups on desktop, so it's shown only on mobile (≤680px),
          where the top nav collapses to a Browse button and this becomes the navigation surface. */}
      <div className="ov-catalog">
      <div className="ov-controls">
        <div className="ov-browse-head">
          <h2>Browse all {total} sections</h2>
          <input className="ov-filter" type="search" value={q} placeholder="🔎 Search…" onChange={(e) => setQ(e.target.value)} aria-label="Search sections" />
        </div>
        {searching && <div className="ov-matchcount">{matchCount} match{matchCount === 1 ? '' : 'es'} <button type="button" className="ov-clear" onClick={() => setQ('')}>clear</button></div>}
      </div>

      <div className={`ov-grid ${searching ? 'is-expanded' : 'is-accordion'}`}>
        {visible.length === 0 ? <div className="ov-noresults">No sections match “{q}”.</div> : visible.map((g) => {
          const open = isOpen(g.label);
          return (
            <div className={`ov-group ${open ? 'open' : ''}`} key={g.label}>
              <button type="button" className="ov-group-head" onClick={() => !searching && toggle(g.label)} aria-expanded={open}>
                <span className="ov-gicon" aria-hidden="true">{g.icon}</span>
                <h2>{g.label}</h2>
                <span className="ov-gcount">{g.ids.length}</span>
                {!searching && <span className="ov-gexpand" aria-hidden="true">{open ? '⌄' : '›'}</span>}
              </button>
              {open && (
                <div className="ov-cards">
                  {g.ids.map((id) => {
                    const m = metaById[id];
                    if (!m) return null;
                    return (
                      <button key={id} type="button" className={`ov-card ${current === id ? 'on' : ''}`} onClick={() => onPick(id)}>
                        <span className="ov-cicon" aria-hidden="true">{m.icon}</span>
                        <span className="ov-clabel">{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
      </div>

      <footer className="ov-foot">
        <span>Living proofs of one idea — a simulation you can poke at beats a diagram you can only read.</span>
        <span className="ov-foot-mono">Apex · {total} live sections · in-browser, offline, no backend</span>
      </footer>

      {preview && (
        <div className="jpv-backdrop" role="dialog" aria-modal="true" aria-label={`${preview.title} — journey preview`} onClick={() => setPreview(null)}>
          <div className="jpv" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="jpv-close" aria-label="Close preview" onClick={() => setPreview(null)}>✕</button>
            <div className="jpv-head">
              <span className="jpv-icon" aria-hidden="true">{preview.icon}</span>
              <div>
                <h2 className="jpv-title">{preview.title}</h2>
                <span className="jpv-count">{preview.steps.length} steps · guided journey</span>
              </div>
            </div>
            <p className="jpv-blurb">{preview.blurb}</p>
            <ol className="jpv-steps">
              {preview.steps.map((s, i) => (
                <li key={s.id} className="jpv-step">
                  <span className="jpv-num" aria-hidden="true">{i + 1}</span>
                  <div className="jpv-step-body">
                    <span className="jpv-step-lbl">{metaById[s.id]?.label ?? s.id}</span>
                    <p className="jpv-step-note">{s.note}</p>
                  </div>
                </li>
              ))}
            </ol>
            <button type="button" className="jpv-start" onClick={() => onStartPath(preview.id)}>Start journey →</button>
          </div>
        </div>
      )}
    </div>
  );
}
