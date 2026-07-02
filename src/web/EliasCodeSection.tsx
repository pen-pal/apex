// Elias γ/δ coding, made visible. Type a number and see its γ and δ codes broken into their parts — the unary
// "how many bits follow" prefix and the binary payload — so you can watch how each code carries its own length.
// Then feed a list (like the gaps in a posting list) and compare γ, δ, and fixed-32-bit sizes. Real model from
// eliascode.ts.
import { useMemo, useState } from 'react';
import { gammaEncode, deltaEncode, gammaDecodeOne, deltaDecodeOne, gammaEncodeList, deltaEncodeList, fixedBits } from './eliascode';

const Bits = ({ bits, cls }: { bits: string; cls: string[] }) => (
  <span className="elc-bits">{[...bits].map((b, i) => <span key={i} className={`elc-bit ${cls[i]}`}>{b}</span>)}</span>
);

export function EliasCodeSection() {
  const [n, setN] = useState(19);
  const [listStr, setListStr] = useState('5, 1, 1, 42, 3, 1000, 7');

  const safeN = Math.max(1, Math.min(1_000_000, Math.floor(n) || 1));
  const bin = safeN.toString(2);
  const g = gammaEncode(safeN);
  const d = deltaEncode(safeN);
  // γ colouring: (bin.length-1) zeros then the binary
  const gCls = [...g].map((_, i) => (i < bin.length - 1 ? 'zero' : i === bin.length - 1 ? 'lead' : 'bin'));
  // δ colouring: γ(bitlength) part then the remaining bits
  const gammaLenLen = gammaEncode(bin.length).length;
  const dCls = [...d].map((_, i) => (i < gammaLenLen ? 'len' : 'bin'));

  const list = useMemo(() => listStr.split(/[,\s]+/).map((x) => parseInt(x, 10)).filter((x) => Number.isFinite(x) && x >= 1), [listStr]);
  const gLen = list.length ? gammaEncodeList(list).length : 0;
  const dLen = list.length ? deltaEncodeList(list).length : 0;
  const fLen = fixedBits(list);
  const maxLen = Math.max(1, gLen, dLen, fLen);

  return (
    <div className="elc">
      <p className="elc-intro">
        How do you write a stream of integers in binary so a decoder knows where each one <em>ends</em>, without
        separators or a fixed width? Elias codes are <strong>self-delimiting</strong>: small numbers stay short,
        and each code encodes its own length. Type a number and watch it decompose:
      </p>

      <label className="elc-numf">n =<input type="number" min={1} value={n} onChange={(e) => setN(+e.target.value)} /><span className="elc-binhint">binary {bin}</span></label>

      <div className="elc-codes">
        <div className="elc-code">
          <div className="elc-ch"><b>γ</b> gamma <i>{g.length} bits</i></div>
          <Bits bits={g} cls={gCls} />
          <div className="elc-legend"><span className="elc-lg zero">{bin.length - 1} zeros = length</span><span className="elc-lg lead">1</span><span className="elc-lg bin">binary of n</span></div>
          <div className="elc-decode">decode: count {bin.length - 1} zeros → read {bin.length} bits → <b>{gammaDecodeOne(g).value}</b></div>
        </div>
        <div className="elc-code">
          <div className="elc-ch"><b>δ</b> delta <i>{d.length} bits</i></div>
          <Bits bits={d} cls={dCls} />
          <div className="elc-legend"><span className="elc-lg len">γ(bitlength {bin.length})</span><span className="elc-lg bin">n after the leading 1</span></div>
          <div className="elc-decode">decode: γ says length {bin.length} → read {bin.length - 1} more → prepend 1 → <b>{deltaDecodeOne(d).value}</b></div>
        </div>
      </div>

      <p className="elc-listintro">Now a whole list — say the gaps between sorted document IDs in a search index (small, so codes stay tiny):</p>
      <label className="elc-listf">list<input type="text" value={listStr} onChange={(e) => setListStr(e.target.value)} spellCheck={false} /></label>

      <div className="elc-compare">
        {[['γ gamma', gLen, 'g'], ['δ delta', dLen, 'd'], ['fixed 32-bit', fLen, 'f']].map(([label, len, cls]) => (
          <div key={label as string} className="elc-crow">
            <span className="elc-cname">{label}</span>
            <div className="elc-ctrack"><div className={`elc-cfill ${cls}`} style={{ width: `${((len as number) / maxLen) * 100}%` }} /></div>
            <span className="elc-cval">{len} bits</span>
          </div>
        ))}
      </div>
      {list.length > 0 && <div className="elc-savings">γ uses <b>{Math.round((1 - gLen / fLen) * 100)}%</b> fewer bits than fixed-width here; δ pulls ahead once the numbers grow past ~32.</div>}

      <p className="elc-foot">
        Both codes are <strong>prefix-free</strong>: no code is a prefix of another,
        so a decoder never has to guess or backtrack. γ spends its budget as a <em>unary</em> length prefix
        (⌊log2 n⌋ zeros) — cheap for small n, but the prefix itself grows linearly, so for big numbers you're
        paying ~2·log2 n bits. δ fixes that by encoding the length with γ instead of unary, giving ~log2 n +
        2·log2 log2 n — worse for tiny numbers, better once they're large. Neither needs a tuning parameter,
        which is what separates them from <strong>Golomb-Rice</strong>: if you know your data is geometrically
        distributed (a known mean gap), a tuned Rice code beats Elias; if you <em>don't</em> know the
        distribution, Elias codes are a safe universal default. This is the machinery under inverted-index and
        column-store compression — store sorted IDs as <em>gaps</em> (delta encoding) and the gaps are small
        positive integers, exactly what these codes are built for. Real systems often layer on byte-aligned or
        SIMD-friendly variants (VByte, Simple-8b, PForDelta) that trade a little size for much faster decoding.
        (Elias, 1975.)
      </p>
    </div>
  );
}
