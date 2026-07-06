// The overview / home catalog — a browsable, filterable map of every section, grouped, so the breadth
// is discoverable at a glance (reached by clicking the Apex logo). Guided JOURNEYS sit on top (curated
// ordered walks); below, a single search box + an accordion of groups (collapsed by default, click to
// expand) make the 200-section catalog navigable WITHOUT duplicating the top nav. Pure presentation over
// the section + path registries, plus local search/expand state.
import { useEffect, useMemo, useState } from 'react';
import { GROUPS, metaById } from './sections';
import { PATHS, type LearningPath } from './paths';

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
        <h1>Apex — see how computers actually work</h1>
        <p>
          {total} live, correctness-first visualizations across {GROUPS.length} areas — networking, cryptography, transport &amp; the web,
          distributed systems, storage &amp; databases, algorithms, CPU &amp; operating systems, and operating in production. Real bytes, real
          checksums, real crypto, honest encryption. New here? Take a <strong>guided journey</strong> below; looking for something specific?
          Pick an area from the menu at the top, or search it.
        </p>
      </div>

      {!searching && (
        <div className="jp">
          <div className="jp-head"><span className="jp-eyebrow">Guided journeys</span><h2>Walk one idea end to end</h2></div>
          <div className="jp-grid">
            {PATHS.map((p) => (
              <button key={p.id} type="button" className="jp-card" onClick={() => setPreview(p)}>
                <div className="jp-card-top">
                  <span className="jp-icon" aria-hidden="true">{p.icon}</span>
                  <span className="jp-title">{p.title}</span>
                  <span className="jp-count">{p.steps.length} steps</span>
                </div>
                <p className="jp-blurb">{p.blurb}</p>
                <div className="jp-trail">
                  {p.steps.map((s, i) => (
                    <span key={s.id} className="jp-stop">
                      {i > 0 && <span className="jp-arrow" aria-hidden="true">→</span>}
                      <span className="jp-stop-lbl">{metaById[s.id]?.label ?? s.id}</span>
                    </span>
                  ))}
                </div>
                <span className="jp-start">Preview journey →</span>
              </button>
            ))}
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
