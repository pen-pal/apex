// The overview / home catalog — a browsable, filterable map of every section, grouped, so the breadth
// is discoverable at a glance (reached by clicking the Apex logo). Guided JOURNEYS sit on top (curated
// ordered walks); below, a live filter + group chips make the 200-section catalog navigable. Pure
// presentation over the section + path registries, plus local filter state.
import { useMemo, useState } from 'react';
import { GROUPS, metaById } from './sections';
import { PATHS } from './paths';

const SHORT: Record<string, string> = {
  'Network basics': 'Network', 'Routing & naming': 'Routing', 'Transport & web': 'Transport',
  'Cryptography': 'Crypto', 'Security & web': 'Security', 'Data & encoding': 'Data',
  'Distributed systems': 'Distributed', 'Storage & databases': 'Storage', 'Systems & OS': 'Systems & OS', 'Operations & SRE': 'Ops',
};

export function OverviewSection({ onPick, onStartPath, current }: { onPick: (id: string) => void; onStartPath: (pathId: string) => void; current: string }) {
  const total = GROUPS.reduce((n, g) => n + g.ids.length, 0);
  const [q, setQ] = useState('');
  const [group, setGroup] = useState<string | null>(null);

  const ql = q.trim().toLowerCase();
  const filtering = ql !== '' || group !== null;
  const visible = useMemo(() => GROUPS.map((g) => ({
    ...g,
    ids: g.ids.filter((id) => {
      if (group && g.label !== group) return false;
      if (!ql) return true;
      const m = metaById[id];
      return m && (m.label.toLowerCase().includes(ql) || g.label.toLowerCase().includes(ql));
    }),
  })).filter((g) => g.ids.length > 0), [ql, group]);
  const matchCount = visible.reduce((n, g) => n + g.ids.length, 0);

  return (
    <div className="ov">
      <div className="ov-hero">
        <h1>Apex — see how computers actually work</h1>
        <p>
          {total} live, correctness-first visualizations across {GROUPS.length} areas — networking, cryptography, transport &amp; the web,
          distributed systems, storage &amp; databases, algorithms, CPU &amp; operating systems, and operating in production. Real bytes, real
          checksums, real crypto, honest encryption. New here? Take a <strong>guided journey</strong>; looking for something? Filter the map below.
        </p>
      </div>

      {!filtering && (
        <div className="jp">
          <div className="jp-head"><span className="jp-eyebrow">Guided journeys</span><h2>Walk one idea end to end</h2></div>
          <div className="jp-grid">
            {PATHS.map((p) => (
              <button key={p.id} type="button" className="jp-card" onClick={() => onStartPath(p.id)}>
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
                <span className="jp-start">Start journey →</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="ov-controls">
        <input className="ov-filter" type="search" value={q} placeholder={`🔎 Filter ${total} sections…`} onChange={(e) => setQ(e.target.value)} aria-label="Filter sections" />
        <div className="ov-chips">
          <button type="button" className={`ov-chip ${group === null ? 'on' : ''}`} onClick={() => setGroup(null)}>All</button>
          {GROUPS.map((g) => (
            <button key={g.label} type="button" className={`ov-chip ${group === g.label ? 'on' : ''}`} onClick={() => setGroup((cur) => (cur === g.label ? null : g.label))}>
              <span aria-hidden="true">{g.icon}</span> {SHORT[g.label] ?? g.label} <span className="ov-chip-n">{g.ids.length}</span>
            </button>
          ))}
        </div>
        {filtering && <div className="ov-matchcount">{matchCount} match{matchCount === 1 ? '' : 'es'}{ql && <button type="button" className="ov-clear" onClick={() => { setQ(''); setGroup(null); }}>clear</button>}</div>}
      </div>

      {/* Collapsed by default: groups show as compact cards. Click one (or filter/search) to expand its
          sections — so the landing isn't a wall of all 220+ links at once and doesn't just mirror the nav. */}
      <div className={`ov-grid ${filtering ? 'is-expanded' : 'is-collapsed'}`}>
        {visible.length === 0 ? <div className="ov-noresults">No sections match “{q}”.</div> : visible.map((g) => (
          <div className="ov-group" key={g.label}>
            <button type="button" className="ov-group-head" onClick={() => setGroup((cur) => (cur === g.label ? null : g.label))} aria-expanded={filtering}>
              <span className="ov-gicon" aria-hidden="true">{g.icon}</span>
              <h2>{g.label}</h2>
              <span className="ov-gcount">{g.ids.length}</span>
              {!filtering && <span className="ov-gexpand" aria-hidden="true">›</span>}
            </button>
            {filtering && (
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
        ))}
      </div>
    </div>
  );
}
