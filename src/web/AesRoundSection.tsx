// Inside AES-128 — the round function made visible. We already ship a real,
// FIPS-197 AES (aes.ts); here we step through its trace one transform at a time
// over the 4×4 state, colouring every byte by value so you can literally watch
// SubBytes (confusion) recolour the grid, ShiftRows (diffusion) slide bytes
// across columns, and MixColumns blend them — then see one flipped input bit
// reach all 16 bytes after just two rounds. Real bytes; the default loads the
// canonical FIPS-197 cipher example.
import { useEffect, useMemo, useState } from 'react';
import { aesTrace, aesDiffusion, AES_SBOX, type AesOp } from './aes';

const FIPS_PT = Uint8Array.from('3243f6a8885a308d313198a2e0370734'.match(/../g)!.map((b) => parseInt(b, 16)));
const FIPS_KEY = Uint8Array.from('2b7e151628aed2a6abf7158809cf4f3c'.match(/../g)!.map((b) => parseInt(b, 16)));

const hx = (b: number) => b.toString(16).padStart(2, '0');
const toHex = (b: Uint8Array) => [...b].map(hx).join('');
/** 16 bytes from UTF-8 text: pad with zeros, truncate past 16. */
function toBlock(text: string, fallback: Uint8Array): Uint8Array {
  if (!text) return fallback.slice();
  const enc = new TextEncoder().encode(text);
  const out = new Uint8Array(16);
  out.set(enc.subarray(0, 16));
  return out;
}
/** Stable colour per byte value, so equal bytes share a colour and moves are visible. */
const byteHue = (b: number) => `hsl(${Math.round((b / 256) * 360)} 62% 86%)`;

const OP_INFO: Record<AesOp, { tag: string; blurb: string }> = {
  input: { tag: 'input', blurb: 'The 16-byte plaintext block, laid out as a 4×4 state — filled column by column (index = col·4 + row).' },
  AddRoundKey: { tag: 'AddRoundKey', blurb: 'XOR every byte with this round’s key. This is the only step that uses the secret key — round 0 mixes in the key before the rounds even begin (whitening).' },
  SubBytes: { tag: 'SubBytes', blurb: 'Replace each byte with S-box[byte]: a fixed, nonlinear 256-entry table. This is the cipher’s confusion — it breaks any simple algebraic relationship between key and ciphertext.' },
  ShiftRows: { tag: 'ShiftRows', blurb: 'Cyclically shift row r left by r bytes (row 0 still, row 1 by 1, …). Bytes leave their column — this is diffusion across columns, so MixColumns can mix bytes that started far apart.' },
  MixColumns: { tag: 'MixColumns', blurb: 'Treat each column as a 4-term polynomial and multiply by a fixed matrix in GF(2⁸). Every output byte of a column depends on all four inputs — diffusion within a column. (Skipped in the final round.)' },
};

export function AesRoundSection({ onOpen }: { onOpen?: (id: string) => void }) {
  const [msg, setMsg] = useState('');
  const [keyText, setKeyText] = useState('');
  const [usingFips, setUsingFips] = useState(true);
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);

  const block = usingFips ? FIPS_PT : toBlock(msg, FIPS_PT);
  const key = usingFips ? FIPS_KEY : toBlock(keyText, FIPS_KEY);
  const blockKey = toHex(block) + '/' + toHex(key);

  const steps = useMemo(() => aesTrace(block, key), [blockKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const diffusion = useMemo(() => {
    const flipped = block.slice();
    flipped[0] ^= 0x01;
    return aesDiffusion(steps, aesTrace(flipped, key));
  }, [blockKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const last = steps.length - 1;
  const idx = Math.min(i, last);
  const cur = steps[idx];
  const prev = idx > 0 ? steps[idx - 1] : null;

  useEffect(() => {
    if (!playing) return;
    if (idx >= last) { setPlaying(false); return; }
    const t = setInterval(() => setI((n) => Math.min(n + 1, last)), 650);
    return () => clearInterval(t);
  }, [playing, idx, last]);

  const reset = (fips: boolean) => { setUsingFips(fips); setI(0); setPlaying(false); };

  // start-of-round indices: input, then each round's first op (round r at 2 + (r-1)*4)
  const roundStart = (r: number) => (r === 0 ? 0 : 2 + (r - 1) * 4);

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Inside AES-128 — one round at a time</h2></div>
        <p className="jsec-sub">
          AES doesn’t scramble bytes in one shot — it runs <strong>10 rounds</strong> of four simple, reversible steps over a
          4×4 grid of bytes (the <em>state</em>). Each byte is coloured by its value, so you can watch{' '}
          <strong>SubBytes</strong> recolour everything (confusion) and <strong>ShiftRows</strong> + <strong>MixColumns</strong>{' '}
          spread each byte’s influence (diffusion). Step through and see why two rounds are enough to touch the whole block.
        </p>

        <div className="aes-io">
          <label className="aes-field">
            <span>message → block (16 bytes)</span>
            <input value={msg} disabled={usingFips} placeholder="type 16 chars…"
              onChange={(e) => { setMsg(e.target.value); setI(0); }} />
          </label>
          <label className="aes-field">
            <span>key (16 bytes)</span>
            <input value={keyText} disabled={usingFips} placeholder="type a key…"
              onChange={(e) => { setKeyText(e.target.value); setI(0); }} />
          </label>
          <div className="aes-presets">
            <button className={usingFips ? 'on' : ''} onClick={() => reset(true)}>NIST FIPS-197 vector</button>
            <button className={!usingFips ? 'on' : ''} onClick={() => reset(false)}>your own bytes</button>
          </div>
        </div>
        <div className="aes-bytes">
          <code>block = {toHex(block)}</code>
          <code>key = {toHex(key)}</code>
        </div>

        {/* round timeline */}
        <div className="aes-rounds">
          <span className="aes-rounds-l">jump to round</span>
          {Array.from({ length: 11 }, (_, r) => (
            <button key={r} className={cur.round === r ? 'on' : ''} onClick={() => { setI(roundStart(r)); setPlaying(false); }}>
              {r === 0 ? 'pre' : r}
            </button>
          ))}
        </div>

        {/* transport */}
        <div className="aes-transport">
          <button onClick={() => { setI(Math.max(0, idx - 1)); setPlaying(false); }} disabled={idx === 0}>◀ prev</button>
          <button className="aes-play" onClick={() => setPlaying((p) => !p)} disabled={idx >= last}>{playing ? '❚❚ pause' : '▶ play'}</button>
          <button onClick={() => { setI(Math.min(last, idx + 1)); setPlaying(false); }} disabled={idx >= last}>next ▶</button>
          <input className="aes-scrub" type="range" min={0} max={last} value={idx}
            onChange={(e) => { setI(Number(e.target.value)); setPlaying(false); }} />
          <span className="aes-stepno">step {idx} / {last}</span>
        </div>

        {/* the state, plus round key on AddRoundKey */}
        <div className="aes-stage">
          <div className="aes-statewrap">
            <div className="aes-grid-l">
              <span className={`aes-op ${cur.op}`}>{OP_INFO[cur.op].tag}</span>
              {cur.round > 0 && <span className="aes-round">round {cur.round} / 10</span>}
            </div>
            <StateGrid state={cur.state} prev={prev?.state} />
          </div>

          {cur.op === 'AddRoundKey' && cur.roundKey && (
            <>
              <div className="aes-xor">⊕</div>
              <div className="aes-statewrap">
                <div className="aes-grid-l"><span className="aes-op AddRoundKey">round key {cur.round}</span></div>
                <StateGrid state={cur.roundKey} keyGrid />
              </div>
            </>
          )}
        </div>

        <div className={`aes-explain ${cur.op}`}>
          <strong>{OP_INFO[cur.op].tag}.</strong> {OP_INFO[cur.op].blurb}
          {cur.op === 'SubBytes' && prev && <SboxHint before={prev.state} />}
        </div>

        {idx === last && (
          <div className="aes-cipher">🔒 ciphertext = <code>{toHex(cur.state)}</code> — 10 rounds done.</div>
        )}

        {/* diffusion strip */}
        <div className="aes-diff">
          <div className="aes-diff-h">
            <strong>Diffusion.</strong> Flip a single bit of the input and count how many of the 16 state bytes differ at each
            step. It’s <em>one</em> byte until MixColumns spreads it to a whole column (4), then ShiftRows scatters those across
            four columns so the next MixColumns hits all <strong>16</strong> — full diffusion after just two rounds.
          </div>
          <div className="aes-diff-bars">
            {diffusion.map((d, k) => (
              <div key={k} className={`aes-diff-bar ${k === idx ? 'on' : ''}`} title={`step ${k}: ${d}/16 bytes differ`}
                onClick={() => { setI(k); setPlaying(false); }}>
                <div className="aes-diff-fill" style={{ height: `${(d / 16) * 100}%` }} />
              </div>
            ))}
          </div>
          <div className="aes-diff-now">at this step: <strong>{diffusion[idx]}/16</strong> bytes affected by one flipped input bit</div>
        </div>

        <p className="aes-foot">
          The same engine drives the <button className="aes-link" onClick={() => onOpen?.('crypto')}>Cryptography → Modes</button>{' '}
          demo, where this block cipher is wrapped in ECB/CBC. One block alone is a pseudo-random permutation; a <em>mode</em>
          {' '}turns it into a cipher for real messages.
        </p>
      </section>
    </div>
  );
}

function StateGrid({ state, prev, keyGrid }: { state: Uint8Array; prev?: Uint8Array; keyGrid?: boolean }) {
  return (
    <div className={`aes-grid ${keyGrid ? 'key' : ''}`}>
      {[0, 1, 2, 3].map((row) =>
        [0, 1, 2, 3].map((col) => {
          const v = state[col * 4 + row];
          const changed = prev ? prev[col * 4 + row] !== v : false;
          return (
            <div key={`${row}-${col}`} className={`aes-cell ${changed ? 'changed' : ''}`}
              style={{ background: keyGrid ? undefined : byteHue(v) }}>
              {hx(v)}
            </div>
          );
        }),
      )}
    </div>
  );
}

/** Show the S-box lookup for the first byte the user can point at (cell 0). */
function SboxHint({ before }: { before: Uint8Array }) {
  const b = before[0];
  return (
    <span className="aes-sbox"> e.g. byte <code>{hx(b)}</code> → S-box → <code>{hx(AES_SBOX[b])}</code>.</span>
  );
}
