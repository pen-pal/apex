// The guided-journey footer. When a journey is active it pins to the bottom and shows where the
// learner is in the path, what to watch for on this step, and Prev / Next controls. Position is
// DERIVED from the active section (stepIndexOf) — there is no separate index state to drift, so
// jumping to a path section via the nav or search just lights up the right dot automatically.
import { stepIndexOf, type LearningPath } from './paths';
import { metaById } from './sections';

export function JourneyBar({ path, section, onGoto, onExit }: {
  path: LearningPath;
  section: string;
  onGoto: (id: string) => void;
  onExit: () => void;
}) {
  const idx = stepIndexOf(path, section);
  const n = path.steps.length;
  const onPath = idx >= 0;
  const atEnd = idx === n - 1;
  const note = onPath ? path.steps[idx].note : 'You’ve stepped off this journey — resume where you left off, or pick the next stop.';

  const go = (i: number) => onGoto(path.steps[Math.max(0, Math.min(n - 1, i))].id);

  return (
    <div className="jbar" role="region" aria-label={`Guided journey: ${path.title}`}>
      <div className="jbar-inner">
        <div className="jbar-id">
          <span className="jbar-icon" aria-hidden="true">{path.icon}</span>
          <div className="jbar-titles">
            <span className="jbar-title">{path.title}</span>
            <span className="jbar-pos">{onPath ? `Step ${idx + 1} of ${n} · ${metaById[section]?.label ?? section}` : `Journey of ${n} steps`}</span>
          </div>
        </div>

        <div className="jbar-dots" role="tablist" aria-label="Journey steps">
          {path.steps.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={i === idx}
              className={`jbar-dot ${i === idx ? 'on' : ''} ${onPath && i < idx ? 'done' : ''}`}
              title={`${i + 1}. ${metaById[s.id]?.label ?? s.id}`}
              onClick={() => onGoto(s.id)}
            />
          ))}
        </div>

        <p className="jbar-note">{note}</p>

        <div className="jbar-ctrls">
          <button type="button" className="jbar-btn" disabled={!onPath || idx <= 0} onClick={() => go(idx - 1)}>‹ Prev</button>
          {!onPath ? (
            <button type="button" className="jbar-btn primary" onClick={() => go(0)}>Resume →</button>
          ) : atEnd ? (
            <button type="button" className="jbar-btn primary" onClick={onExit}>Finish ✓</button>
          ) : (
            <button type="button" className="jbar-btn primary" onClick={() => go(idx + 1)}>Next ›</button>
          )}
          <button type="button" className="jbar-exit" title="Exit journey" aria-label="Exit journey" onClick={onExit}>✕</button>
        </div>
      </div>
    </div>
  );
}
