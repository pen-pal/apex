// Hamming(7,4), made visible. Toggle the 4 data bits, watch the 3 parity bits fill in, then click any of the 7
// bits to corrupt it in transit. The three parity checks light up pass/fail; read the failures as a binary number
// and it's the exact position of the flipped bit — flip it back and the data is recovered. Real logic from hamming.ts.
import { useMemo, useState } from 'react';
import { encode, decode, checkCover } from './hamming';

export function HammingSection() {
  const [data, setData] = useState([1, 0, 1, 1]);
  const [flip, setFlip] = useState(0); // 0 = no error, else position 1..7 corrupted in transit

  const sent = useMemo(() => encode(data), [data]);
  const received = useMemo(() => { const r = sent.slice(); if (flip) r[flip - 1] ^= 1; return r; }, [sent, flip]);
  const dec = useMemo(() => decode(received), [received]);

  const isParity = (p: number) => p === 1 || p === 2 || p === 4;
  const checks = checkCover.map((ch) => ({ ...ch, fail: ch.covers.reduce((x, p) => x ^ received[p - 1], 0) === 1 }));

  return (
    <div className="hmg">
      <p className="hmg-intro">
        Hamming(7,4) turns <strong>4 data bits</strong> into a <strong>7-bit codeword</strong> by adding 3 parity
        bits at positions <strong>1, 2, 4</strong> (the powers of two). Each parity bit checks the positions whose
        index has that bit set — so the three checks together read out the <strong>binary index</strong> of any
        single flipped bit. Toggle the data, then click a bit to corrupt it in transit.
      </p>

      <div className="hmg-data">
        <span className="hmg-dl">data:</span>
        {data.map((b, i) => (
          <button key={i} type="button" className={`hmg-databit ${b ? 'on' : ''}`} onClick={() => setData(data.map((x, j) => (j === i ? x ^ 1 : x)))}>{b}</button>
        ))}
      </div>

      <div className="hmg-wire">
        <span className="hmg-dl">codeword (click to corrupt):</span>
        <div className="hmg-cells">
          {received.map((b, i) => {
            const p = i + 1;
            const corrupted = flip === p;
            const flagged = dec.errorPos === p;
            return (
              <button key={i} type="button" className={`hmg-cell ${isParity(p) ? 'parity' : 'data'} ${corrupted ? 'bad' : ''} ${flagged ? 'flagged' : ''}`} onClick={() => setFlip(flip === p ? 0 : p)}>
                <span className="hmg-bit">{b}</span>
                <span className="hmg-pos">{p}{isParity(p) ? ' p' : ''}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="hmg-checks">
        {checks.map((ch) => (
          <div key={ch.parity} className={`hmg-check ${ch.fail ? 'fail' : 'pass'}`}>
            <span className="hmg-cn">check {ch.parity}</span>
            <span className="hmg-cc">positions {ch.covers.join(', ')}</span>
            <span className="hmg-cr">{ch.fail ? '✗ fail → 1' : '✓ pass → 0'}</span>
          </div>
        ))}
      </div>

      <div className={`hmg-verdict ${dec.errorPos ? (dec.data.join('') === data.join('') ? 'fixed' : 'bad') : 'clean'}`}>
        {dec.errorPos === 0
          ? <>syndrome = <b>000 = 0</b> → no error. data = <b>{dec.data.join('')}</b> ✓</>
          : <>syndrome = <b>{[4, 2, 1].map((v) => (checks.find((c) => c.parity === v)!.fail ? 1 : 0)).join('')} = {dec.errorPos}</b> → bit {dec.errorPos} is wrong; flip it back → data = <b>{dec.data.join('')}</b> {dec.data.join('') === data.join('') ? '✓ recovered' : '✗'}</>}
      </div>

      <p className="hmg-foot">
        The elegance is that the syndrome isn't a yes/no — it's an address. Three parity bits give 2³ = 8 syndromes:
        one says "clean," and the other seven name exactly which of the 7 positions to flip, so a single check
        corrects any single-bit error with the theoretical minimum of redundancy. Push it and you find the honest
        limit: with a minimum distance of 3 between valid codewords, Hamming(7,4) can correct one error <em>or</em>
        detect two, but not both, and two flips get silently "corrected" to the wrong word (try flipping two bits
        above — the syndrome points at an innocent third position). Adding one overall-parity bit gives the (8,4)
        SECDED code — Single Error Correct, Double Error Detect — and that is exactly what runs on the ECC memory in
        every server: each 64-bit word carries 8 check bits, silently fixing the single-bit flips that cosmic rays
        and leaky capacitors cause and flagging the rarer double flips. The same family scales — (72,64) in DRAM,
        bigger BCH and Reed-Solomon codes on disks, QR codes, and deep-space links — but they all descend from this
        1950 insight: lay out the parity so the failing checks spell the error's address. (Hamming, BSTJ 1950.)
      </p>
    </div>
  );
}
