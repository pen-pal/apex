// The overview / home catalog — a browsable map of every section, grouped, so the breadth
// is discoverable at a glance (reached by clicking the Apex logo). Pure presentation over
// the section registry; clicking any card jumps to that section.
import { GROUPS, metaById } from './sections';

export function OverviewSection({ onPick, current }: { onPick: (id: string) => void; current: string }) {
  const total = GROUPS.reduce((n, g) => n + g.ids.length, 0);
  return (
    <div className="ov">
      <div className="ov-hero">
        <h1>Apex — see how networks actually work</h1>
        <p>
          {total} interactive, byte-accurate visualizations across {GROUPS.length} areas. Type real data and watch it become bytes, get
          wrapped layer by layer, travel the wire, and get unwrapped again — with real checksums, real crypto, and honest encryption.
          Pick anything to dive in, or use the search box up top.
        </p>
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
