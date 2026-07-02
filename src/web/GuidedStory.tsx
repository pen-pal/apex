// The guided-story engine: a section's narrated, zoom-through-the-scales tour is DATA (a list of scenes), driven by
// this one tested component — auto-play pacing, play/pause/prev/next, scene dots, cross-fade+scale transitions,
// reduced-motion, and an optional interactive control slot per scene. Each section supplies its own scene visuals;
// nothing here is topic-specific. Same data-not-code principle the protocol engine uses.
import { useEffect, useRef, useState, type ReactNode } from 'react';

export interface StoryScene {
  key: string;
  title: string;
  caption: ReactNode;
  /** the scene's visual, usually an <svg>. `active` is true only while this scene is on screen. */
  render: (active: boolean) => ReactNode;
}

export function GuidedStory({ scenes, controls, aspect = '900 / 480', autoMs = 5200 }: {
  scenes: StoryScene[];
  /** interactive controls for the current scene index (return null to show none) — the section owns their state */
  controls?: (scene: number) => ReactNode;
  aspect?: string;
  autoMs?: number;
}) {
  const [scene, setScene] = useState(0);
  const [playing, setPlaying] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const last = scenes.length - 1;

  // auto-advance while playing; stop at the last scene so its interactive controls can be used
  useEffect(() => {
    if (!playing || scene >= last) return;
    timer.current = setTimeout(() => setScene((s) => Math.min(last, s + 1)), autoMs);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [playing, scene, last, autoMs]);

  const go = (s: number) => { setPlaying(false); setScene(Math.max(0, Math.min(last, s))); };
  const cur = scenes[scene];
  const live = controls?.(scene);

  return (
    <div className="story">
      <div className="story-stage" style={{ aspectRatio: aspect }} role="img" aria-label={`${cur.title}. ${typeof cur.caption === 'string' ? cur.caption : ''}`}>
        {scenes.map((sc, i) => (
          <div key={sc.key} className={`story-scene ${i === scene ? 'active' : i < scene ? 'past' : 'future'}`} aria-hidden={i !== scene}>
            {sc.render(i === scene)}
          </div>
        ))}
      </div>

      <div className="story-caption">
        <span className="story-cap-title">{cur.title}</span>
        <span className="story-cap-body">{cur.caption}</span>
      </div>

      {live && <div className="story-live">{live}</div>}

      <div className="story-transport">
        <button type="button" className="story-nav" onClick={() => go(scene - 1)} disabled={scene === 0} aria-label="previous scene">‹</button>
        <button type="button" className="story-play" onClick={() => { if (scene >= last) { setScene(0); setPlaying(true); } else setPlaying((p) => !p); }}>
          {scene >= last ? '↻ replay' : playing ? '❚❚ pause' : '▶ play'}
        </button>
        <button type="button" className="story-nav" onClick={() => go(scene + 1)} disabled={scene === last} aria-label="next scene">›</button>
        <div className="story-dots">
          {scenes.map((sc, i) => <button key={sc.key} type="button" className={`story-dot ${i === scene ? 'on' : ''}`} onClick={() => go(i)} aria-label={sc.title} title={sc.title} />)}
        </div>
      </div>
    </div>
  );
}
