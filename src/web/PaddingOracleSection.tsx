// The padding-oracle attack, made visible. The server holds a secret plaintext block you can't see; all it
// ever tells you is "valid padding" or "invalid padding." Type a secret, launch the attack, and step through
// it: each byte falls from right to left as the attacker forges the previous block until the padding checks
// out — recovering the whole plaintext without the key, in a few hundred oracle queries. Real model from
// paddingoracle.ts.
import { useMemo, useState } from 'react';
import { attackTraced, padBlock, B } from './paddingoracle';

const chr = (b: number) => (b >= 32 && b < 127 ? String.fromCharCode(b) : '·');
const hex = (b: number) => b.toString(16).padStart(2, '0');
const IV = [0x9f, 0x1a, 0x2b, 0x3c, 0x4d, 0x5e, 0x6f, 0x70];

export function PaddingOracleSection() {
  const [secret, setSecret] = useState('cash=10');
  const [revealed, setRevealed] = useState(0); // how many bytes recovered so far (0..B)

  const { plaintext, run } = useMemo(() => {
    const plaintext = padBlock(secret);
    return { plaintext, run: attackTraced(plaintext, IV) };
  }, [secret]);

  // recovered position set for the first `revealed` steps (steps go pos B-1 → 0)
  const done = new Map<number, number>();
  let queriesSoFar = 0;
  for (let i = 0; i < revealed; i++) { const s = run.steps[i]; done.set(s.pos, s.plaintextByte); queriesSoFar += s.queries; }

  return (
    <div className="pdo">
      <p className="pdo-intro">
        The server decrypts your ciphertext and, before anything else, checks the <strong>PKCS#7 padding</strong>
        — then tells you only <em>valid</em> or <em>invalid</em>. That single bit is enough. Because CBC gives
        <code> P = Decrypt(C) XOR prev</code>, an attacker who forges <code>prev</code> byte by byte and watches
        the padding result learns the plaintext — <strong>without the key</strong>.
      </p>

      <label className="pdo-field">server's secret block (attacker can't see it)
        <input value={secret} onChange={(e) => { setSecret(e.target.value); setRevealed(0); }} maxLength={B} spellCheck={false} />
      </label>

      <div className="pdo-block">
        {plaintext.map((_, i) => {
          const got = done.has(i);
          const isPad = i >= B - plaintext[B - 1];
          return (
            <div key={i} className={`pdo-cell ${got ? 'got' : 'hidden'} ${got && isPad ? 'pad' : ''}`}>
              <span className="pdo-char">{got ? chr(done.get(i)!) : '?'}</span>
              <span className="pdo-hex">{got ? hex(done.get(i)!) : '··'}</span>
            </div>
          );
        })}
      </div>

      <div className="pdo-controls">
        <button type="button" className="pdo-btn" disabled={revealed >= B} onClick={() => setRevealed((r) => Math.min(B, r + 1))}>recover next byte →</button>
        <button type="button" className="pdo-btn strong" disabled={revealed >= B} onClick={() => setRevealed(B)}>run full attack</button>
        <button type="button" className="pdo-btn ghost" onClick={() => setRevealed(0)}>reset</button>
        <span className="pdo-q">{queriesSoFar} oracle queries{revealed > 0 ? ` · ${revealed}/${B} bytes` : ''}</span>
      </div>

      {revealed >= B && (
        <div className={`pdo-verdict ${run.matches ? 'bad' : 'ok'}`}>
          {run.matches
            ? `☠ RECOVERED "${run.recovered.map(chr).join('')}" in ${run.totalQueries} queries — the full plaintext, and the key was never needed.`
            : 'recovery mismatch'}
        </div>
      )}

      <p className="pdo-foot">
        Note what leaked the secret: the server distinguished a <em>padding</em> error from other errors, giving
        the attacker an oracle. Worse, the classic real-world version was a <strong>timing</strong> oracle — the
        server took slightly longer when padding was valid (it went on to check the MAC), so even a "generic
        error" response leaked the bit. The fixes: use <strong>authenticated encryption</strong> (AES-GCM,
        ChaCha20-Poly1305) or <strong>encrypt-then-MAC</strong>, and verify the MAC in <strong>constant time
        BEFORE looking at the padding</strong> — a forged ciphertext then fails the MAC and the padding is never
        even examined, so there's no oracle. This is exactly why modern protocols dropped CBC-mode ciphersuites
        and why "don't roll your own crypto" specifically means "don't invent your own MAC-and-pad ordering."
        (Vaudenay 2002; the 2010 ASP.NET and 2013 Lucky Thirteen attacks.)
      </p>
    </div>
  );
}
