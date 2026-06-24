// Inside SHA-256 — the Merkle–Damgård construction made visible. A message is
// padded and split into 64-byte blocks; each block runs a compression function
// that stirs the running 256-bit state, and that final state IS the digest. Seeing
// that last fact explains the length-extension attack (shown in Attacks) and why
// the sponge construction of SHA-3 is immune. Real bytes from the from-scratch
// sha256.ts; verified to the NIST vectors.
import { useMemo, useState } from 'react';
import { sha256Trace, SHA256_IV, hex } from './sha256';

const hw = (w: number) => (w >>> 0).toString(16).padStart(8, '0');
const hb = (b: number) => b.toString(16).padStart(2, '0');
const VAR = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

function StateRow({ words, label, hot }: { words: Uint32Array | number[]; label: string; hot?: boolean }) {
  return (
    <div className={`hi-state ${hot ? 'hot' : ''}`}>
      <span className="hi-state-l">{label}</span>
      <span className="hi-words">{[...words].map((w, i) => <code key={i}>{hw(w)}</code>)}</span>
    </div>
  );
}

export function HashInternalsSection({ onOpen }: { onOpen?: (id: string) => void }) {
  const [msg, setMsg] = useState('abc');
  const [blockIdx, setBlockIdx] = useState(0);
  const [round, setRound] = useState(63);

  const tr = useMemo(() => sha256Trace(new TextEncoder().encode(msg)), [msg]);
  const bi = Math.min(blockIdx, tr.blocks.length - 1);
  const block = tr.blocks[bi];
  const ri = Math.min(round, 63);
  const rnd = block.rounds[ri];
  const prevVars = ri > 0 ? block.rounds[ri - 1].vars : [...block.before];

  const regionOf = (globalOff: number) =>
    globalOff < tr.msgLen ? 'msg' : globalOff === tr.msgLen ? 'p80' : globalOff >= tr.padded.length - 8 ? 'len' : 'zero';

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>① Pad, then split into 64-byte blocks</h2></div>
        <p className="jsec-sub">
          SHA-256 first appends a single <span className="hi-key p80">0x80</span> byte, then{' '}
          <span className="hi-key zero">zeros</span>, then the original message’s 64-bit <span className="hi-key len">bit-length</span>,
          so the total is a whole number of 512-bit blocks.
        </p>
        <label className="hi-field"><span>message</span><input value={msg} onChange={(e) => { setMsg(e.target.value); setBlockIdx(0); }} /></label>
        <div className="hi-blocks">
          {tr.blocks.map((b) => (
            <div key={b.index} className={`hi-block ${bi === b.index ? 'sel' : ''}`} onClick={() => setBlockIdx(b.index)}>
              <div className="hi-block-h">block {b.index}</div>
              <div className="hi-bytes">
                {[...b.bytes].map((byte, j) => {
                  const g = b.index * 64 + j;
                  return <code key={j} className={`hi-byte ${regionOf(g)}`}>{hb(byte)}</code>;
                })}
              </div>
            </div>
          ))}
        </div>
        <p className="hi-note">{tr.msgLen} message bytes → {tr.padded.length} padded bytes → {tr.blocks.length} block{tr.blocks.length > 1 ? 's' : ''}.</p>
      </section>

      <section className="jsec">
        <div className="jsec-head"><h2>② The Merkle–Damgård chain</h2></div>
        <p className="jsec-sub">
          The 256-bit state starts at a fixed <strong>IV</strong> (eight constants from the fractional roots of the first primes).
          Each block’s compression function mixes that block into the state and passes it on. <strong>The final state is the
          digest</strong> — there is no separate finalisation, and that is precisely what the length-extension attack exploits.
        </p>
        <div className="hi-chain">
          <StateRow words={SHA256_IV} label="IV" />
          {tr.blocks.map((b) => (
            <StateRow key={b.index} words={b.after} label={b.index === tr.blocks.length - 1 ? `after blk ${b.index} = digest` : `after blk ${b.index}`} hot={b.index === tr.blocks.length - 1} />
          ))}
        </div>
        <div className="hi-digest">digest = <code>{hex(tr.digest)}</code></div>
      </section>

      <section className="jsec">
        <div className="jsec-head"><h2>③ One block, 64 compression rounds</h2></div>
        <p className="jsec-sub">
          Each round folds in a round constant <code>K[i]</code> and a message word <code>W[i]</code>, then shifts the eight
          working words (a…h) — only <strong>a</strong> and <strong>e</strong> are freshly computed, the rest slide down. After 64
          rounds the result is added back to the block’s input state. Showing block {bi}.
        </p>
        <div className="hi-stepper">
          <button onClick={() => setRound(Math.max(0, ri - 1))} disabled={ri === 0}>◀</button>
          <input type="range" min={0} max={63} value={ri} onChange={(e) => setRound(Number(e.target.value))} />
          <button onClick={() => setRound(Math.min(63, ri + 1))} disabled={ri === 63}>▶</button>
          <span className="hi-stepno">round {ri} / 63 · K=<code>{hw(rnd.k)}</code> · W=<code>{hw(rnd.w)}</code></span>
        </div>
        <div className="hi-vars">
          {rnd.vars.map((v, i) => (
            <div key={i} className={`hi-var ${prevVars[i] !== v ? 'changed' : ''}`}>
              <span className="hi-var-n">{VAR[i]}</span><code>{hw(v)}</code>
            </div>
          ))}
        </div>
      </section>

      <section className="jsec">
        <div className="jsec-head"><h2>④ Why the sponge (SHA-3) is immune</h2></div>
        <p className="jsec-sub">
          Because a Merkle–Damgård digest <em>is</em> the internal state, anyone who has it can keep hashing from there — so{' '}
          <code>H(secret ‖ msg)</code> lets an attacker forge <code>H(secret ‖ msg ‖ padding ‖ extra)</code> with no secret. That’s
          the <button className="hi-link" onClick={() => onOpen?.('attacks')}>length-extension attack</button> (and why MACs use
          HMAC, not raw H).
        </p>
        <div className="hi-sponge">
          <div className="hi-sp-col">
            <div className="hi-sp-rate">rate r — message XORed in here, output read from here</div>
            <div className="hi-sp-cap">capacity c — never input, never output</div>
          </div>
          <div className="hi-sp-text">
            SHA-3’s <strong>sponge</strong> keeps a hidden <strong>capacity</strong> that never appears in the output. The digest
            exposes only the rate, so you <em>cannot</em> reconstruct the full state to resume it — length extension simply doesn’t
            apply. Absorb (XOR blocks in, permute), then squeeze (read out, permute).
          </div>
        </div>
      </section>
    </div>
  );
}
