// Reed-Solomon, made visible. A short message is encoded into a systematic codeword
// (data symbols + parity symbols); click any symbols to "scratch" them off the disc, and
// as long as no more than n-k are lost the original data is reconstructed exactly from the
// survivors via GF(256) interpolation. Lose one too many and recovery fails. Real RS math
// in reedsolomon.ts (tested against FIPS-197 GF products and full recovery).
import { useMemo, useState } from 'react';
import { encode, decode } from './reedsolomon';

const MESSAGE = 'APEX';
const DATA = Array.from(MESSAGE, (c) => c.charCodeAt(0));
const K = DATA.length;

export function ReedSolomonSection() {
  const [n, setN] = useState(7); // K data + (n-K) parity
  const codeword = useMemo(() => encode(DATA, n), [n]);
  const [erased, setErased] = useState<Set<number>>(new Set([1, 4, 5]));

  const received = codeword.map((v, i) => (erased.has(i) ? null : v));
  const recovered = useMemo(() => decode(received, K), [received]);
  const parity = n - K;
  const lost = erased.size;

  const toggle = (i: number) => setErased((s) => { const x = new Set(s); x.has(i) ? x.delete(i) : x.add(i); return x; });
  const hx = (v: number) => v.toString(16).padStart(2, '0');

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Reed-Solomon — data that heals itself</h2></div>
        <p className="jsec-sub">
          The message <strong>“{MESSAGE}”</strong> ({K} bytes) is encoded into <strong>{n}</strong> symbols by treating the data as a
          polynomial and sampling it at extra points — giving <strong>{parity}</strong> redundant symbols. Any {K} of the {n} symbols
          pin down the same polynomial, so you can lose any <strong>{parity}</strong> of them and still recover everything. Click
          symbols to scratch them off:
        </p>

        <div className="rs-control">
          <label>codeword size n <input type="range" min={K + 1} max={12} value={n} onChange={(e) => { setN(+e.target.value); setErased(new Set()); }} /><b>{n}</b> ({parity} parity)</label>
        </div>

        <div className="rs-codeword">
          {codeword.map((v, i) => (
            <button key={i} className={`rs-sym ${i < K ? 'data' : 'parity'} ${erased.has(i) ? 'erased' : ''}`} onClick={() => toggle(i)}>
              <span className="rs-hex">{erased.has(i) ? '??' : hx(v)}</span>
              <span className="rs-tag">{i < K ? `d${i}` : `p${i - K}`}</span>
            </button>
          ))}
        </div>
        <div className="rs-legend"><span><i className="rs-sym data" /> data</span><span><i className="rs-sym parity" /> parity</span><span><i className="rs-sym erased" /> scratched ({lost})</span></div>

        <div className={`rs-recover ${recovered ? 'ok' : 'bad'}`}>
          {recovered ? (
            <>
              ✓ Recovered from {n - lost} survivors: <code>{recovered.map(hx).join(' ')}</code> = “{String.fromCharCode(...recovered)}”
              {lost > 0 && <span className="rs-note"> — {lost} symbol{lost === 1 ? '' : 's'} lost, all data restored exactly.</span>}
            </>
          ) : (
            <>✗ Unrecoverable: {lost} symbols lost but only {parity} parity available. With fewer than {K} survivors the polynomial isn’t pinned down — this is the hard limit.</>
          )}
        </div>

        <p className="rs-foot">
          The arithmetic is genuine GF(256) — the same finite field AES uses (0x57·0x83 = 0xc1, checked in the tests). An RS(n,k) code
          tolerates up to <strong>n−k erasures</strong> (lost symbols at known positions) or <strong>⌊(n−k)/2⌋ errors</strong> (corrupted
          symbols at unknown positions, which also need locating). That’s why a scratched CD still plays, a torn QR code still scans
          (RS(255,223) and friends), and RAID-6 survives two dead disks. The cost is the parity overhead you choose with n.
        </p>
      </section>
    </div>
  );
}
