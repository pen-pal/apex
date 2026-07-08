// Speculative decoding, made visible. The cheap draft model proposes k tokens; the big target model verifies them in
// one pass. Toggle which proposals the target agrees with and watch the accepted prefix (kept) vs the discarded tail,
// and the tokens-per-target-pass speedup. Model + tests in specdecode.ts.
import { useMemo, useState } from 'react';
import { verify, speedup } from './specdecode';

const DRAFT = ['The', 'cat', 'sat', 'on', 'the'];   // the draft model's guesses
const TARGET = ['The', 'cat', 'sat', 'by', 'a'];    // the target's own choice at each position (shown at the mismatch)
const PRESETS: Record<string, boolean[]> = {
  'good draft': [true, true, true, true, true],
  'typical': [true, true, true, false, true],
  'bad draft': [false, true, true, true, true],
};

export function SpecDecodeSection() {
  const [matches, setMatches] = useState<boolean[]>(PRESETS['typical']);
  const v = useMemo(() => verify(matches), [matches]);
  const sp = speedup(v);
  const flip = (i: number) => setMatches((m) => m.map((x, j) => (j === i ? !x : x)));

  return (
    <div className="spd">
      <div className="spd-presets">
        <span className="spd-lbl">draft quality:</span>
        {Object.keys(PRESETS).map((p) => (
          <button key={p} type="button" className={JSON.stringify(matches) === JSON.stringify(PRESETS[p]) ? 'on' : ''} onClick={() => setMatches(PRESETS[p])}>{p}</button>
        ))}
      </div>

      <div className="spd-panel">
        <div className="spd-lbl">the draft proposes {DRAFT.length} tokens — click one to flip whether the target agrees</div>
        <div className="spd-tokens">
          {DRAFT.map((w, i) => {
            const state = i < v.firstMismatch ? 'accept' : i === v.firstMismatch ? 'fix' : 'drop';
            return (
              <button key={i} type="button" className={`spd-tok spd-${state}`} onClick={() => flip(i)}>
                <span className="spd-tok-w">{w}</span>
                {state === 'accept' && <span className="spd-tok-tag">✓ kept</span>}
                {state === 'fix' && <span className="spd-tok-tag">✗ → {TARGET[i]}</span>}
                {state === 'drop' && <span className="spd-tok-tag">discarded</span>}
              </button>
            );
          })}
          {v.firstMismatch === DRAFT.length && <div className="spd-tok spd-bonus"><span className="spd-tok-w">＋1</span><span className="spd-tok-tag">free token</span></div>}
        </div>
      </div>

      <div className={`spd-verdict ${sp >= 3 ? 'spd-fast' : sp === 1 ? 'spd-slow' : 'spd-ok'}`}>
        <b>{sp}× this step</b> — one expensive target pass produced <b>{v.accepted}</b> token{v.accepted === 1 ? '' : 's'}
        {v.rejected > 0 ? <> ({v.accepted - 1} the draft got right + 1 correction; {v.rejected} discarded)</> : <> (all {DRAFT.length} draft tokens accepted, plus a free one)</>}.
        {sp === 1 && <> The draft was wrong immediately, so you got one token <em>and</em> paid for a wasted draft — slower than plain decoding. A speculative draft only helps if it’s cheap and usually right.</>}
      </div>

      <p className="spd-foot">
        A transformer generates one token per forward pass, and each pass over billions of parameters is the whole cost —
        so latency is <em>tokens × pass-time</em>. The trick: a <strong>forward pass can score many positions at once</strong>,
        it’s just that autoregression normally only has one new token to score. <strong>Speculative decoding</strong> feeds
        that spare capacity — a small <strong>draft</strong> model proposes several tokens, the big <strong>target</strong>
        verifies them all in <em>one</em> pass, and you keep the longest prefix it agrees with (plus the target’s own token
        at the first miss, so progress is guaranteed). The output is <strong>identical</strong> to greedy target decoding —
        this is exact, not approximate — typically 2–3× faster. Variants: <em>self-speculation</em> (early layers draft for
        later ones), <em>Medusa</em> (extra heads), and n-gram/prompt lookup drafts. (Leviathan et al., 2023.)
      </p>
    </div>
  );
}
