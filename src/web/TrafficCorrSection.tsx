// End-to-end traffic correlation — made a game you play as the ATTACKER. You saw one flow enter Tor from your target;
// three flows leave Tor toward different servers. No decryption: just match the SHAPE over time. Click the exit you
// think is your target's and get scored by real Pearson correlation. Then switch on constant-rate cover traffic and
// try again — every flow goes flat, correlation collapses, and the attack fails. Model + tests in trafficcorr.ts.
import { useMemo, useState } from 'react';
import { pearson, constantRatePad, links } from './trafficcorr';
import { mulberry32 } from './reservoir';

const SLOTS = 12;

// Build one round: a target shape seen at entry (with jitter) and at its exit (different jitter), plus two decoys.
function buildRound(seed: number) {
  const rng = mulberry32(seed);
  const jitter = (v: number) => Math.max(0, Math.round(v + (rng() - 0.5) * 3));
  const shape = Array.from({ length: SLOTS }, (_, i) => {
    // a couple of bursts at pseudo-random slots → a distinctive fingerprint
    const burst = Math.sin((i + seed) * 1.7) > 0.4 ? 8 : 0;
    return Math.max(0, Math.round(burst + rng() * 2));
  });
  const entry = shape.map(jitter);
  const targetExit = shape.map(jitter);
  const decoy = () => Array.from({ length: SLOTS }, () => Math.round(rng() * 9));
  const exits = [targetExit, decoy(), decoy()];
  // shuffle which slot the target sits in
  const order = [0, 1, 2].sort(() => rng() - 0.5);
  const shuffled = order.map((i) => exits[i]);
  const targetIndex = order.indexOf(0);
  return { entry, exits: shuffled, targetIndex };
}

function Spark({ flow, accent }: { flow: number[]; accent?: boolean }) {
  const max = Math.max(1, ...flow);
  return (
    <div className="tc-spark">
      {flow.map((v, i) => (
        <span key={i} className={`tc-bar ${accent ? 'acc' : ''}`} style={{ height: `${(v / max) * 100}%` }} />
      ))}
    </div>
  );
}

export function TrafficCorrSection() {
  const [seed, setSeed] = useState(3);
  const [padded, setPadded] = useState(false);
  const [guess, setGuess] = useState<number | null>(null);

  const round = useMemo(() => buildRound(seed * 131 + 7), [seed]);
  const entry = padded ? constantRatePad(round.entry) : round.entry;
  const exits = padded ? round.exits.map((e) => constantRatePad(e)) : round.exits;
  const scores = exits.map((e) => pearson(entry, e));
  const linked = guess !== null && links(entry, exits[guess]);

  const pick = (i: number) => setGuess(i);
  const reset = (nextPadded = padded) => { setGuess(null); setPadded(nextPadded); setSeed((s) => s + 1); };

  return (
    <div className="tc">
      <div className="tc-target">
        <div className="tc-lbl">your target's flow, entering Tor {padded && <em>· padded to cover traffic</em>}</div>
        <Spark flow={entry} accent />
      </div>

      <div className="tc-exits">
        {exits.map((e, i) => {
          const state = guess === null ? '' : i === round.targetIndex ? 'right' : i === guess ? 'wrong' : 'dim';
          return (
            <button type="button" key={i} className={`tc-exit ${state}`} onClick={() => pick(i)} disabled={guess !== null}>
              <div className="tc-lbl">exit → server {String.fromCharCode(65 + i)}</div>
              <Spark flow={e} />
              {guess !== null && <div className="tc-score">r = {scores[i].toFixed(2)}</div>}
            </button>
          );
        })}
      </div>

      <div className={`tc-verdict ${guess === null ? 'idle' : linked ? 'linked' : 'miss'}`}>
        {guess === null ? (
          <>Click the exit whose <strong>shape</strong> matches your target's. No math needed — your eye can do it… unless the defense is on.</>
        ) : padded ? (
          <><strong>Attack failed.</strong> With constant-rate cover traffic every flow is a flat line — correlation is ~0 for all of them,
          so you're guessing blind. That flat line costs bandwidth, which is why Tor doesn't pad by default and a global observer stays a real threat.</>
        ) : linked ? (
          <><strong>Deanonymized.</strong> Exit {String.fromCharCode(65 + guess)} correlates at <strong>r = {scores[guess].toFixed(2)}</strong> —
          the same fingerprint you saw at entry. You linked sender to destination through encryption you never touched.</>
        ) : (
          <><strong>Wrong flow.</strong> That one scores r = {scores[guess].toFixed(2)}; the real target was exit {String.fromCharCode(65 + round.targetIndex)} at
          r = {scores[round.targetIndex].toFixed(2)}. Even a wrong guess shows how sharply the true flow stands out.</>
        )}
      </div>

      <div className="tc-controls">
        <button type="button" className="tc-btn" onClick={() => reset()}>↻ new capture</button>
        <button type="button" className={`tc-btn tog ${padded ? 'on' : ''}`} onClick={() => reset(!padded)}>
          {padded ? '✓ cover traffic ON' : 'turn on cover traffic'}
        </button>
      </div>

      <p className="tc-foot">
        This is the ceiling on <strong>low-latency</strong> anonymity: Tor forwards immediately, so the timing shape survives
        end to end and a <strong>global passive adversary</strong> who sees both ends wins. The only real defense is to destroy
        the shape — send at a <strong>constant rate</strong> with cover traffic, and add <strong>delay + reordering</strong> so
        even the timing leaks nothing. That's precisely the trade a <strong>mix network</strong> makes, buying unlinkability
        with latency. (Tor's threat model explicitly excludes the global observer; Murdoch &amp; Danezis, 2005.)
      </p>
    </div>
  );
}
