// The Packet Story — the first truly synchronized view. One stepper (driven by
// the shared SimClock) advances a packet through its whole life; the byte strip,
// the layer stack, and the "why" narration all move together. This is the
// synchronization Apex exists to provide.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { DissectionNode } from '../core/types';
import type { ByteModel } from './byteModel';
import type { JourneyModel } from './journeyModel';
import { deriveStory } from './storyModel';
import { layerHue, PAYLOAD_COLOR, TRAILER_COLOR } from './colors';
import { SimClock } from '../sim/clock';

const hex2 = (v: number) => v.toString(16).toUpperCase().padStart(2, '0');

const PHASES: { id: string; label: string }[] = [
  { id: 'down', label: 'Encapsulate' },
  { id: 'wire', label: 'On the wire' },
  { id: 'router', label: 'Router' },
  { id: 'up', label: 'Decapsulate' },
];

export function StoryView({
  tree, model, journey, built = true, caption,
}: {
  tree: DissectionNode; model: ByteModel; journey: JourneyModel; built?: boolean; caption?: string;
}) {
  const steps = useMemo(() => deriveStory(tree, model, journey, built), [tree, model, journey, built]);
  const clock = useRef(new SimClock());
  const [step, setStep] = useState(0);
  const timer = useRef<number | null>(null);

  // Clamp + reset when the underlying packet changes.
  useEffect(() => { setStep(0); clock.current.reset(); }, [steps]);

  const stop = () => { if (timer.current != null) { clearInterval(timer.current); timer.current = null; } };
  useEffect(() => stop, []);

  const go = (i: number) => {
    const n = Math.max(0, Math.min(steps.length - 1, i));
    setStep(n);
    clock.current.emit({ kind: 'story', actor: 'client', label: steps[n]?.title ?? '', payload: n });
  };
  const play = () => {
    stop();
    go(0);
    timer.current = window.setInterval(() => {
      setStep((s) => {
        if (s >= steps.length - 1) { stop(); return s; }
        const n = s + 1;
        clock.current.emit({ kind: 'story', actor: 'client', label: steps[n].title, payload: n });
        return n;
      });
    }, 1400);
  };

  const cur = steps[step];
  const lit = useMemo(() => new Set(cur?.highlight ?? []), [cur]);

  // Colour per byte by its owning layer (one hue per layer depth).
  const colorOf = (depth: number, region: string) =>
    region === 'payload' ? PAYLOAD_COLOR : region === 'trailer' ? TRAILER_COLOR : `hsl(${layerHue(depth)} 58% 48%)`;

  const phases = PHASES.filter((p) => p.id !== 'router' || journey.routerChanges.length);

  return (
    <div className="journey story">
      <section className="jsec">
        <div className="jsec-head">
          <h2>Packet story</h2>
          <div className="play-group">
            <button className="ghost" onClick={() => go(step - 1)} disabled={step === 0}>◀</button>
            <button className="play" onClick={play}>▶ Play</button>
            <button className="ghost" onClick={() => go(step + 1)} disabled={step === steps.length - 1}>▶</button>
            <button className="ghost" onClick={() => { stop(); go(0); }}>↺</button>
          </div>
        </div>
        <p className="jsec-sub">
          One timeline, every view in lockstep — watch a packet get built, cross the wire, pass a router,
          and get taken apart again. The bytes below and the stack on the right move with the story.
        </p>
        {caption && <div className="example-banner"><span>{caption}</span></div>}

        {/* phase rail */}
        <div className="story-phases">
          {phases.map((p) => (
            <span key={p.id} className={`story-phase ${cur?.phase === p.id ? 'on' : ''}`}>{p.label}</span>
          ))}
        </div>

        <div className="story-main">
          {/* byte strip */}
          <div className="story-bytes">
            {model.cells.map((c) => (
              <span
                key={c.index}
                className={`sb ${lit.has(c.index) ? 'lit' : 'dim'}`}
                style={lit.has(c.index) ? { background: colorOf(c.depth, c.region) } : undefined}
                title={`byte ${c.index} · ${c.layerName} · ${c.region}`}
              >
                {hex2(c.value)}
              </span>
            ))}
          </div>

          {/* layer stack */}
          <div className="story-stack">
            {journey.layers.map((l) => (
              <div key={l.id} className={`story-layer ${cur?.layerId === l.id ? 'on' : ''}`}
                style={{ borderColor: `hsl(${layerHue(l.depth)} 45% 70%)` }}>
                <span className="sl-name" style={{ color: `hsl(${layerHue(l.depth)} 52% 34%)` }}>{l.name}</span>
                <span className="sl-bytes">{l.headerBytes}B</span>
              </div>
            ))}
            <div className={`story-layer payload ${cur?.layerId && journey.layers.every((l) => l.id !== cur.layerId) ? '' : ''}`}>
              <span className="sl-name" style={{ color: 'hsl(280 45% 38%)' }}>Payload</span>
              <span className="sl-bytes">{journey.payloadLength}B</span>
            </div>
          </div>
        </div>

        {/* narration */}
        <div className="story-narration">
          <div className="story-step-no">{step + 1} / {steps.length}</div>
          <h3>{cur?.title}</h3>
          <p>{cur?.narration}</p>
        </div>

        {/* step rail */}
        <div className="story-rail">
          {steps.map((s, i) => (
            <button key={s.id} className={`rail-dot ${i === step ? 'on' : ''} ${i < step ? 'done' : ''}`}
              onClick={() => { stop(); go(i); }} title={s.title} />
          ))}
        </div>
      </section>
    </div>
  );
}
