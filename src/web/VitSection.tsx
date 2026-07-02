// Convolutional coding + Viterbi decoding, made visible. Pick a message, watch the rate-1/2 K=3
// encoder double it into a codeword, then CLICK any received bit to flip it (a channel error) and
// watch the Viterbi decoder walk the trellis, keep the lowest-distance survivor into each state,
// and trace back the single most-likely path — recovering your message and pinpointing the error.
// All logic in viterbi.ts (tested: encoder anchored to the (7,5) generators, decoder corrects flips).
import { useMemo, useState } from 'react';
import { encode, decode, STATES } from './viterbi';

const PRESETS: number[][] = [[1, 0, 1, 1], [1, 1, 0, 1, 0], [0, 1, 1], [1, 0, 0, 1, 1]];

export function VitSection() {
  const [msg, setMsg] = useState<number[]>([1, 0, 1, 1]);
  const [flips, setFlips] = useState<Set<number>>(new Set());

  const enc = useMemo(() => encode(msg), [msg]);
  const received = useMemo(() => enc.codeword.map((b, i) => (flips.has(i) ? b ^ 1 : b)), [enc, flips]);
  const dec = useMemo(() => decode(received), [received]);
  const ok = dec.decoded.length === msg.length && dec.decoded.every((b, i) => b === msg[i]);

  const setBit = (i: number) => setMsg((m) => m.map((b, k) => (k === i ? b ^ 1 : b)));
  const toggleFlip = (i: number) => setFlips((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; });
  const reset = () => setFlips(new Set());

  // trellis geometry
  const T = dec.stages.length;
  const W = 70 + T * 86;
  const H = 232;
  const xcol = (t: number) => 46 + (t / T) * (W - 86);
  const yst = (s: number) => 40 + s * 50;
  const col0 = [0, null, null, null]; // metrics before stage 0 (start in state 0)

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Viterbi decoding — fixing bit errors without asking again</h2></div>
        <p className="jsec-sub">
          Forward error correction trades bandwidth for resilience: a rate-1/2 convolutional encoder turns each input bit into <strong>two</strong>
          output bits, spreading every bit’s influence across time. The <strong>Viterbi</strong> decoder then finds the single most-likely
          transmitted sequence by walking a trellis of the encoder’s 4 states, keeping at each step only the lowest-Hamming-distance
          <em> survivor</em> into each state. Flip a received bit below and watch it get corrected — no retransmission needed.
        </p>

        <div className="vit-msg">
          <span className="vit-lbl">Message</span>
          {msg.map((b, i) => (
            <button key={i} className={`vit-bit ${b ? 'one' : 'zero'}`} onClick={() => setBit(i)} title="click to flip this input bit">{b}</button>
          ))}
          <div className="vit-presets">
            {PRESETS.map((p, k) => <button key={k} className="vit-chip" onClick={() => { setMsg(p); reset(); }}>{p.join('')}</button>)}
          </div>
        </div>

        <div className="vit-code">
          <span className="vit-lbl">Received <span className="vit-sub2">(click a bit to inject a channel error)</span></span>
          <div className="vit-bits">
            {received.map((b, i) => {
              const corrected = dec.corrections.includes(i);
              return (
                <button key={i} className={`vit-rbit ${flips.has(i) ? 'flipped' : ''} ${corrected ? 'corrected' : ''}`} onClick={() => toggleFlip(i)}
                  title={flips.has(i) ? 'flipped by you' : 'click to flip'}>
                  {b}
                  {i % 2 === 1 && i < received.length - 1 && <span className="vit-gap" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="vit-stage">
          <svg viewBox={`0 0 ${W} ${H}`} className="vit-svg" role="img" aria-label="Viterbi trellis">
            {/* state row labels */}
            {STATES.map((s) => (
              <g key={s}>
                <text x={10} y={yst(s) + 4} className="vit-srow">{s.toString(2).padStart(2, '0')}</text>
                <line x1={44} y1={yst(s)} x2={W - 30} y2={yst(s)} className="vit-rail" />
              </g>
            ))}
            {/* edges */}
            {dec.stages.map((st) =>
              st.edges.map((e, k) => (
                <line key={`${st.t}-${k}`} x1={xcol(st.t)} y1={yst(e.from)} x2={xcol(st.t + 1)} y2={yst(e.to)}
                  className={`vit-edge ${e.ml ? 'ml' : e.survivor ? 'surv' : 'cand'} ${e.u ? 'u1' : 'u0'}`} />
              ))
            )}
            {/* nodes with cumulative metrics */}
            {Array.from({ length: T + 1 }).map((_, t) => {
              const metrics = t === 0 ? col0 : dec.stages[t - 1].metricAfter;
              return STATES.map((s) => {
                const m = metrics[s];
                const onPath = (t < T && dec.stages[t].edges.some((e) => e.ml && e.from === s)) || (t > 0 && dec.stages[t - 1].edges.some((e) => e.ml && e.to === s));
                return (
                  <g key={`${t}-${s}`}>
                    <circle cx={xcol(t)} cy={yst(s)} r={m == null ? 4 : 11} className={`vit-node ${onPath ? 'path' : ''} ${m == null ? 'dead' : ''}`} />
                    {m != null && <text x={xcol(t)} y={yst(s) + 3.5} className="vit-metric">{m}</text>}
                  </g>
                );
              });
            })}
            {/* received symbol headers */}
            {dec.stages.map((st) => (
              <text key={`r${st.t}`} x={(xcol(st.t) + xcol(st.t + 1)) / 2} y={20} className="vit-rsym">{st.r[0]}{st.r[1]}</text>
            ))}
          </svg>
          <div className="vit-legend">
            <span><i className="vit-k ml" /> most-likely path</span>
            <span><i className="vit-k surv" /> survivor</span>
            <span><i className="vit-k cand" /> candidate</span>
            <span><i className="vit-k u1" /> input 1</span>
            <span>numbers = path distance</span>
          </div>
        </div>

        <div className={`vit-verdict ${ok ? 'ok' : 'no'}`}>
          <div className="vit-vrow">
            <span className="vit-vlbl">Decoded</span>
            <span className="vit-vbits">{dec.decoded.join(' ') || '—'}</span>
            <span className="vit-vtag">{ok ? '✓ matches the original message' : '✗ exceeded the code’s correcting power'}</span>
          </div>
          <p className="vit-vexpl">
            {dec.corrections.length === 0
              ? 'No channel errors — the received word already sat on a valid trellis path.'
              : `${dec.corrections.length} bit error${dec.corrections.length > 1 ? 's' : ''} at position ${dec.corrections.join(', ')} — the decoder chose the nearest valid path and ${ok ? 'recovered the message exactly' : 'could not fully recover (too many errors for d_free=5, which corrects 2)'}.`}
          </p>
        </div>

        <p className="vit-foot">
          The trellis is the key: instead of comparing the received word against all 2ᴺ possible messages, Viterbi keeps just one survivor
          per state at each step, so the cost is linear in message length. This exact decoder flew on Voyager, rides in every GSM call and
          Wi-Fi frame, and pairs with an outer Reed-Solomon code in the classic concatenated scheme. Modern LTE/5G and Wi-Fi have largely moved
          to turbo and LDPC codes, but they’re refinements of the same idea: add structured redundancy, then decode by finding the most likely
          path through it.
        </p>
      </section>
    </div>
  );
}
