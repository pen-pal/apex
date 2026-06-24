// Boyer-Moore majority vote, made visible. A stream of coloured tokens; step through it and
// watch the candidate + counter — matching tokens vote up, others vote down, and the counter
// hitting zero adopts the next token. The true majority survives the cancellation. A final
// verification pass confirms (or rejects) the survivor. Real logic in majority.ts (tested).
import { useMemo, useState } from 'react';
import { majorityVote } from './majority';

const PRESETS: { name: string; stream: number[] }[] = [
  { name: 'clear majority', stream: [3, 3, 4, 2, 3, 3, 3] },
  { name: 'majority survives chaos', stream: [2, 1, 2, 3, 2, 4, 2, 5, 2] },
  { name: 'no majority', stream: [1, 2, 3, 4, 5, 6] },
  { name: 'a tie (not a majority)', stream: [7, 7, 9, 9] },
];
const COLORS = ['hsl(212 65% 55%)', 'hsl(150 50% 45%)', 'hsl(28 80% 55%)', 'hsl(265 55% 58%)', 'hsl(0 65% 58%)', 'hsl(190 55% 45%)', 'hsl(45 75% 50%)', 'hsl(330 55% 55%)', 'hsl(95 45% 45%)'];
const col = (v: number) => COLORS[v % COLORS.length];

export function MajoritySection() {
  const [pi, setPi] = useState(0);
  const stream = PRESETS[pi].stream;
  const r = useMemo(() => majorityVote(stream), [stream]);
  const [step, setStep] = useState(stream.length);

  const s = Math.min(step, r.steps.length);
  const cur = s > 0 ? r.steps[s - 1] : null;

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Boyer-Moore majority vote — survive the cancellation</h2></div>
        <p className="jsec-sub">
          Is there an element making up <em>more than half</em> the stream? You can find it in one pass with a single counter. Keep a
          <strong> candidate</strong> and a <strong>count</strong>: a matching token votes the count up, a different one votes it down,
          and when the count hits zero the next token takes over. A true majority can’t be fully cancelled, so it’s left standing.
        </p>

        <div className="maj-pick">
          {PRESETS.map((p, k) => <button key={k} className={pi === k ? 'on' : ''} onClick={() => { setPi(k); setStep(p.stream.length); }}>{p.name}</button>)}
        </div>

        <div className="maj-stream">
          {stream.map((v, i) => (
            <div key={i} className={`maj-tok ${cur && i === s - 1 ? 'cur' : ''} ${i < s ? 'seen' : ''}`} style={{ background: i < s ? col(v) : '#eef1f6', color: i < s ? '#fff' : 'var(--muted)' }}>{v}</div>
          ))}
        </div>

        <div className="maj-controls">
          <button onClick={() => setStep(0)} disabled={s === 0}>⏮</button>
          <button onClick={() => setStep(Math.max(0, s - 1))} disabled={s === 0}>◀</button>
          <span className="maj-count">{s} / {r.steps.length}</span>
          <button onClick={() => setStep(s + 1)} disabled={s >= r.steps.length}>▶</button>
          <button onClick={() => setStep(r.steps.length)} disabled={s >= r.steps.length}>⏭</button>
        </div>

        <div className="maj-state">
          <div className="maj-cand">candidate <span style={{ background: cur ? col(cur.candidate) : '#ccc' }}>{cur ? cur.candidate : '–'}</span></div>
          <div className="maj-counter">count <b>{cur ? cur.count : 0}</b></div>
          {cur && <div className={`maj-action ${cur.action}`}>{cur.action === 'adopt' ? 'count was 0 → adopt this token' : cur.action === 'vote+' ? 'matches candidate → +1' : 'differs → −1'}</div>}
        </div>

        {s >= r.steps.length && (
          <div className={`maj-verdict ${r.isMajority ? 'ok' : 'bad'}`}>
            survivor is <b>{r.candidate}</b> → verification pass: it appears <b>{r.actualCount}</b> of {stream.length} times
            {r.isMajority ? ` (> ${r.threshold}) — ✓ it IS the majority.` : ` (not > ${r.threshold}) — ✗ no majority exists; the survivor was a false alarm.`}
          </div>
        )}

        <p className="maj-foot">
          The second pass matters: the algorithm always produces <em>a</em> survivor, but only counting confirms it truly exceeds n/2 —
          so on a stream with no majority it correctly reports none. The same cancellation idea generalises (Boyer-Moore-Misra-Gries) to
          find all elements appearing more than n/k times with k−1 counters, which streaming systems use to track “heavy hitters” in
          network traffic and trending queries — a deterministic cousin of the Count-Min sketch.
        </p>
      </section>
    </div>
  );
}
