// The overview / home catalog — a browsable map of every section, grouped, so the breadth
// is discoverable at a glance (reached by clicking the Apex logo). Above the catalog sit the
// GUIDED JOURNEYS: curated, ordered walks that answer "where do I start?" — click one to begin
// stepping through it. Pure presentation over the section + path registries.
import { GROUPS, metaById } from './sections';
import { PATHS } from './paths';

export function OverviewSection({ onPick, onStartPath, current }: { onPick: (id: string) => void; onStartPath: (pathId: string) => void; current: string }) {
  const total = GROUPS.reduce((n, g) => n + g.ids.length, 0);
  return (
    <div className="ov">
      <div className="ov-hero">
        <h1>Apex — see how networks actually work</h1>
        <p>
          {total} interactive, byte-accurate visualizations across {GROUPS.length} areas. Type real data and watch it become bytes, get
          wrapped layer by layer, travel the wire, and get unwrapped again — with real checksums, real crypto, and honest encryption.
          New here? Take a <strong>guided journey</strong> below. Looking for something specific? Browse the map or search up top.
        </p>
      </div>

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

      <div className="ov-grid">
        {GROUPS.map((g) => (
          <div className="ov-group" key={g.label}>
            <div className="ov-group-head"><span className="ov-gicon" aria-hidden="true">{g.icon}</span><h2>{g.label}</h2><span className="ov-gcount">{g.ids.length}</span></div>
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
          </div>
        ))}
      </div>
    </div>
  );
}
