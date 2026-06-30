// Aho-Corasick, made visible. Enter a dictionary of patterns and a text; the automaton is the trie of
// the patterns plus the dashed FAILURE LINKS that let one left-to-right pass match them all at once.
// Step through the text and watch the current state move — following a child edge when it can, jumping a
// failure link when it can't — lighting up matches as whole patterns complete. Real automaton from ahocorasick.ts.
import { useMemo, useState } from 'react';
import { AhoCorasick } from './ahocorasick';

export function AhoCorasickSection() {
  const [patternsStr, setPatternsStr] = useState('he, she, his, hers');
  const [text, setText] = useState('ushers');
  const [step, setStep] = useState(0);

  const patterns = useMemo(() => patternsStr.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean).slice(0, 6), [patternsStr]);
  const ac = useMemo(() => new AhoCorasick(patterns), [patterns]);
  const clean = text.toLowerCase().replace(/[^a-z]/g, '').slice(0, 18);
  const states = useMemo(() => ac.trace(clean), [ac, clean]);
  const allMatches = useMemo(() => ac.search(clean), [ac, clean]);

  const curState = step === 0 ? 0 : states[step - 1];
  const shown = allMatches.filter((m) => m.end < step);

  // tidy-tree layout: leaves get sequential x, parents centre over children
  const layout = useMemo(() => {
    const pos: Record<number, { x: number; d: number }> = {};
    let leaf = 0, maxD = 0;
    const walk = (id: number) => {
      const kids = Object.values(ac.nodes[id].children);
      maxD = Math.max(maxD, ac.nodes[id].depth);
      if (kids.length === 0) { pos[id] = { x: leaf++, d: ac.nodes[id].depth }; return; }
      kids.forEach(walk);
      pos[id] = { x: kids.reduce((a, k) => a + pos[k].x, 0) / kids.length, d: ac.nodes[id].depth };
    };
    walk(0);
    return { pos, maxX: Math.max(1, leaf - 1), maxD };
  }, [ac]);

  const W = 620, H = 60 + layout.maxD * 78;
  const X = (x: number) => 40 + (x / layout.maxX) * (W - 80);
  const Y = (d: number) => 40 + d * 78;

  return (
    <div className="ac">
      <div className="ac-inputs">
        <label>patterns <input value={patternsStr} spellCheck={false} onChange={(e) => { setPatternsStr(e.target.value); setStep(0); }} /></label>
        <label>text <input value={text} spellCheck={false} onChange={(e) => { setText(e.target.value); setStep(0); }} /></label>
      </div>

      <div className="ac-text">
        {[...clean].map((c, i) => (
          <span key={i} className={`ac-ch ${step > 0 && i === step - 1 ? 'cur' : ''} ${i < step ? 'done' : ''}`}>{c}</span>
        ))}
        <div className="ac-steps">
          <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>◀</button>
          <button type="button" className="primary" onClick={() => setStep((s) => Math.min(clean.length, s + 1))} disabled={step >= clean.length}>step ▶</button>
          <button type="button" onClick={() => setStep(clean.length)} disabled={step >= clean.length}>all</button>
          <button type="button" onClick={() => setStep(0)} disabled={step === 0}>reset</button>
        </div>
      </div>

      <div className="ac-diagram">
        <svg viewBox={`0 0 ${W} ${H}`} className="ac-svg" style={{ maxHeight: H }}>
          <defs><marker id="ac-fa" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" className="ac-fap" /></marker></defs>
          {/* failure links (dashed) */}
          {ac.nodes.map((n) => n.id !== 0 && n.fail !== 0 && (
            <line key={`f${n.id}`} x1={X(layout.pos[n.id].x)} y1={Y(layout.pos[n.id].d)} x2={X(layout.pos[n.fail].x)} y2={Y(layout.pos[n.fail].d)} className="ac-fail" markerEnd="url(#ac-fa)" />
          ))}
          {/* trie edges */}
          {ac.nodes.map((n) => n.parent >= 0 && (
            <g key={`e${n.id}`}>
              <line x1={X(layout.pos[n.parent].x)} y1={Y(layout.pos[n.parent].d)} x2={X(layout.pos[n.id].x)} y2={Y(layout.pos[n.id].d)} className="ac-edge" />
              <text x={(X(layout.pos[n.parent].x) + X(layout.pos[n.id].x)) / 2 - 6} y={(Y(layout.pos[n.parent].d) + Y(layout.pos[n.id].d)) / 2} className="ac-elbl">{n.char}</text>
            </g>
          ))}
          {/* nodes */}
          {ac.nodes.map((n) => (
            <g key={n.id}>
              <circle cx={X(layout.pos[n.id].x)} cy={Y(layout.pos[n.id].d)} r={15} className={`ac-node ${n.id === curState ? 'cur' : ''} ${n.out.length ? 'accept' : ''}`} />
              {n.id === 0 && <text x={X(layout.pos[n.id].x)} y={Y(layout.pos[n.id].d) + 4} className="ac-root">∅</text>}
            </g>
          ))}
        </svg>
        <div className="ac-legend"><span className="ac-lg node" /> state <span className="ac-lg accept" /> pattern ends here <span className="ac-lg fail" /> failure link</div>
      </div>

      <div className="ac-matches">
        <div className="ac-matches-h">matches {step < clean.length ? `(through step ${step})` : '(complete)'} — {shown.length}</div>
        <div className="ac-mlist">
          {shown.length === 0 ? <span className="ac-none">none yet — keep stepping</span>
            : shown.map((m, i) => <span key={i} className="ac-match">“{m.pattern}” @ {m.start}–{m.end}</span>)}
        </div>
      </div>

      <p className="ac-foot">
        The magic is the <strong>failure link</strong>: when the text breaks the current path, instead of restarting from the root the automaton
        jumps to the node spelling the longest proper suffix that’s still a live prefix — so no character is ever re-read. Building the links is one
        breadth-first pass; matching is then a single linear scan that finds <em>all</em> occurrences of <em>all</em> patterns at once, in
        O(text + matches) regardless of dictionary size. Output links chain accepting suffixes (matching “she” also reports “he”). It’s exactly
        KMP generalized from one string to a whole trie, and it’s what makes <code>fgrep</code>, Snort-style IDS rule engines, and DNA scanners fast. (Aho &amp; Corasick, 1975.)
      </p>
    </div>
  );
}
