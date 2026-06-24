// ChaCha20 made visible — a 4×4 matrix of 32-bit words (constants ‖ key ‖ counter
// ‖ nonce) stirred by 20 ARX rounds. No S-boxes or lookup tables: just add, rotate,
// xor, which is why it's fast and constant-time in pure software. Step through the
// 10 double-rounds, add the original state back, and XOR the keystream over a
// message. Real RFC 8439 arithmetic (chacha.ts); the default key is the RFC vector.
import { useMemo, useState } from 'react';
import { chacha20Block, chacha20, hexWord } from './chacha';

const KEY = Uint8Array.from('000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f'.match(/../g)!.map((b) => parseInt(b, 16)));
const NONCE = Uint8Array.from('000000090000004a00000000'.match(/../g)!.map((b) => parseInt(b, 16)));
const COUNTER = 1;

const region = (i: number) => (i < 4 ? 'const' : i < 12 ? 'key' : i === 12 ? 'ctr' : 'nonce');
const hx = (b: number) => b.toString(16).padStart(2, '0');

function WordGrid({ words, prev }: { words: Uint32Array; prev?: Uint32Array }) {
  return (
    <div className="cc-grid">
      {[...words].map((w, i) => (
        <div key={i} className={`cc-word ${region(i)} ${prev && prev[i] !== w ? 'changed' : ''}`}>{hexWord(w)}</div>
      ))}
    </div>
  );
}

export function ChachaSection() {
  const [msg, setMsg] = useState('ChaCha20: add, rotate, xor — no S-boxes.');
  const [r, setR] = useState(0); // 0 = initial state, 1..10 = after each double-round

  const blk = useMemo(() => chacha20Block(KEY, COUNTER, NONCE), []);
  const shown = r === 0 ? blk.state : blk.rounds[r - 1];
  const prev = r === 0 ? undefined : r === 1 ? blk.state : blk.rounds[r - 2];

  const data = new TextEncoder().encode(msg);
  const ct = chacha20(data, KEY, COUNTER, NONCE);

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>① The state matrix</h2></div>
        <p className="jsec-sub">
          Every ChaCha20 block starts from sixteen 32-bit words: four fixed{' '}
          <span className="cc-key const">constants</span> (“expand 32-byte k”), the eight-word{' '}
          <span className="cc-key key">key</span>, a one-word block <span className="cc-key ctr">counter</span>, and a three-word{' '}
          <span className="cc-key nonce">nonce</span>. Same (key, counter, nonce) ⇒ same keystream — so, exactly like CTR, the
          nonce must never repeat.
        </p>
        <WordGrid words={blk.state} />
      </section>

      <section className="jsec">
        <div className="jsec-head"><h2>② 20 rounds of add–rotate–xor</h2></div>
        <p className="jsec-sub">
          Each <strong>double-round</strong> applies the quarter-round (a += b; d ^= a, &lt;&lt;&lt;16; c += d; b ^= c, &lt;&lt;&lt;12;
          …) to the four <strong>columns</strong>, then the four <strong>diagonals</strong> — so every word soon depends on every
          other. Drag through the ten double-rounds and watch the matrix scramble.
        </p>
        <div className="cc-stepper">
          <button onClick={() => setR(Math.max(0, r - 1))} disabled={r === 0}>◀</button>
          <input type="range" min={0} max={10} value={r} onChange={(e) => setR(Number(e.target.value))} />
          <button onClick={() => setR(Math.min(10, r + 1))} disabled={r === 10}>▶</button>
          <span className="cc-stepno">{r === 0 ? 'initial state' : `after double-round ${r} / 10`}</span>
        </div>
        <WordGrid words={shown} prev={prev} />
        {r === 10 && (
          <p className="cc-add">Then each scrambled word is <strong>added back</strong> to the original state word (mod 2³²) and
            serialised little-endian — that 64-byte result is the keystream. (Adding the input back is what makes the round function
            non-invertible without the key.)</p>
        )}
      </section>

      <section className="jsec">
        <div className="jsec-head"><h2>③ Keystream ⊕ message</h2></div>
        <p className="jsec-sub">
          Encryption is just XOR with the keystream — no padding, and decryption is the identical operation. (For authenticity,
          TLS pairs this with the <strong>Poly1305</strong> MAC, the ChaCha20-Poly1305 AEAD — the same “encrypt then tag” idea as
          AES-GCM.)
        </p>
        <label className="cc-field"><span>message</span><input value={msg} onChange={(e) => setMsg(e.target.value)} /></label>
        <div className="cc-xor">
          <div><span className="cc-lab">keystream</span><span className="cc-bytes">{[...blk.keystream.subarray(0, Math.min(32, data.length))].map((b, i) => <code key={i}>{hx(b)}</code>)}</span></div>
          <div><span className="cc-lab">message</span><span className="cc-bytes">{[...data.subarray(0, 32)].map((b, i) => <code key={i}>{hx(b)}</code>)}</span></div>
          <div><span className="cc-lab ct">ciphertext</span><span className="cc-bytes">{[...ct.subarray(0, 32)].map((b, i) => <code key={i} className="ct">{hx(b)}</code>)}</span></div>
        </div>
        <p className="cc-note">{data.length} bytes → {ct.length} bytes ({Math.ceil(data.length / 64) || 1} keystream block{data.length > 64 ? 's' : ''}). Showing the first 32.</p>
      </section>
    </div>
  );
}
