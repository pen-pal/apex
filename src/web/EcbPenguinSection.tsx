// The ECB penguin, made visible with real AES. We draw a high-contrast padlock bitmap,
// then encrypt its pixel bytes three ways using the project's verified AES (NIST SP
// 800-38A): ECB (each block independent), CBC (chained), CTR (keystream). ECB maps
// every identical plaintext block to the identical ciphertext block, so the padlock's
// flat regions survive encryption and the shape stays visible — the classic lesson that
// "encrypted" is not the same as "secure". CBC and CTR dissolve it into noise.
import { useEffect, useMemo, useRef } from 'react';
import { aesEcbEncrypt, aesCbcEncrypt } from './aes';
import { aesCtr } from './aesgcm';

const W = 64, H = 64; // 64 px rows → 4 AES blocks per row, so flat bands align with blocks
const FG = 0xe6, BG = 0x1c;
const KEY = new Uint8Array([0x2b, 0x7e, 0x15, 0x16, 0x28, 0xae, 0xd2, 0xa6, 0xab, 0xf7, 0x15, 0x88, 0x09, 0xcf, 0x4f, 0x3c]);
const IV = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);

/** A padlock: a filled body, a ring shackle, and a small keyhole — lots of flat
 *  horizontal bands so the ECB leak is unmistakable. */
function buildPadlock(): Uint8Array {
  const px = new Uint8Array(W * H).fill(BG);
  const on = (x: number, y: number) => { if (x >= 0 && x < W && y >= 0 && y < H) px[y * W + x] = FG; };
  // body: rows 30..58, cols 14..50
  for (let y = 30; y <= 58; y++) for (let x = 14; x <= 50; x++) on(x, y);
  // shackle: a ring (outer radius 16, inner 10) centred at (32,30), only the upper arc
  const cx = 32, cy = 30;
  for (let y = 8; y <= 32; y++) for (let x = 14; x <= 50; x++) {
    const d = Math.hypot(x - cx, y - cy);
    if (d <= 16 && d >= 10 && y <= 30) on(x, y);
  }
  // keyhole: a small dark disc + slot in the body centre
  for (let y = 38; y <= 50; y++) for (let x = 28; x <= 36; x++) {
    if (Math.hypot(x - 32, y - 42) <= 4 || (x >= 30 && x <= 34 && y >= 42 && y <= 50)) px[y * W + x] = BG;
  }
  return px;
}

function Canvas({ bytes, label }: { bytes: Uint8Array; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    const img = ctx.createImageData(W, H);
    for (let i = 0; i < W * H; i++) {
      const v = bytes[i] ?? 0;
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }, [bytes]);
  return (
    <figure className="ecb-fig">
      <canvas ref={ref} width={W} height={H} className="ecb-canvas" />
      <figcaption>{label}</figcaption>
    </figure>
  );
}

export function EcbPenguinSection() {
  const plain = useMemo(buildPadlock, []);

  const ecb = useMemo(() => {
    const blocks = aesEcbEncrypt(plain, KEY);
    const out = new Uint8Array(W * H);
    blocks.forEach((b, i) => out.set(b.subarray(0, 16), i * 16));
    return out;
  }, [plain]);

  const cbc = useMemo(() => {
    const blocks = aesCbcEncrypt(plain, KEY, IV);
    const out = new Uint8Array(W * H);
    blocks.forEach((b, i) => out.set(b.subarray(0, 16), i * 16));
    return out;
  }, [plain]);

  const ctr = useMemo(() => aesCtr(plain, KEY, IV).out.subarray(0, W * H), [plain]);

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>“Encrypted” is not the same as “hidden”</h2></div>
        <p className="jsec-sub">
          Below is a padlock image. Every pixel byte is encrypted with the <em>same</em> real AES-128 key (the NIST SP 800-38A
          example key) — but in three different <strong>modes</strong>. Electronic Code Book encrypts each 16-byte block on its own,
          so two identical input blocks always produce the identical output block. The padlock is full of flat regions, so its shape
          walks straight through the cipher. CBC and CTR chain or stream, and the shape vanishes.
        </p>

        <div className="ecb-row">
          <Canvas bytes={plain} label="plaintext" />
          <span className="ecb-arrow">→</span>
          <Canvas bytes={ecb} label="AES-ECB (leaks!)" />
          <Canvas bytes={cbc} label="AES-CBC" />
          <Canvas bytes={ctr} label="AES-CTR" />
        </div>

        <div className="ecb-cards">
          <div className="ecb-card bad">
            <h3>ECB — Electronic Code Book</h3>
            <p>C<sub>i</sub> = E(K, P<sub>i</sub>). Each block is independent, so <code>P<sub>i</sub> = P<sub>j</sub> ⟹ C<sub>i</sub> = C<sub>j</sub></code>.
            Patterns, repeated headers, and structure all survive. Never use it for anything bigger than one block.</p>
          </div>
          <div className="ecb-card ok">
            <h3>CBC — Cipher Block Chaining</h3>
            <p>C<sub>i</sub> = E(K, P<sub>i</sub> ⊕ C<sub>i−1</sub>), seeded by a random IV. Each block depends on every block before it,
            so identical plaintext blocks diverge. Needs a fresh, unpredictable IV every message.</p>
          </div>
          <div className="ecb-card ok">
            <h3>CTR — Counter</h3>
            <p>C<sub>i</sub> = P<sub>i</sub> ⊕ E(K, nonce‖counter). The cipher makes a keystream; the data is just XORed in. Parallelisable
            and random-access — but reusing a (key, nonce) pair is catastrophic (two-time pad).</p>
          </div>
        </div>

        <p className="ecb-foot">
          The famous version of this picture uses Tux the penguin; the lesson is identical. The blocks here are byte-exact AES — the
          first ECB block of the SP 800-38A test vector is <code>3ad77bb4…</code>, checked in the test suite. ECB’s leak is also why
          deterministic encryption needs care: equal ciphertexts reveal equal plaintexts.
        </p>
      </section>
    </div>
  );
}
