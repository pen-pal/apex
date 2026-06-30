// Varint & zigzag, made visible. Type a number and watch it pack into LEB128 bytes: each byte spends its
// top bit as a "more follows" flag and the low 7 bits on data, little-endian. Small numbers cost one byte.
// Flip to a negative with plain int encoding and it explodes to 10 bytes (sign-extended); switch on zigzag
// and it snaps back to one. That's the whole reason proto3 has sint32/sint64. Real model from varint.ts.
import { useMemo, useState } from 'react';
import { encodeVarint, encodeVarintSigned64, zigzagEncode } from './varint';

const bits7 = (b: number) => (b & 0x7f).toString(2).padStart(7, '0');

export function VarintSection() {
  const [n, setN] = useState(300);
  const [zigzag, setZigzag] = useState(false);

  const { bytes, encoded } = useMemo(() => {
    if (zigzag) return { bytes: encodeVarint(zigzagEncode(n)), encoded: `zigzag(${n}) = ${zigzagEncode(n)}` };
    if (n < 0) return { bytes: encodeVarintSigned64(n), encoded: `${n} as 64-bit two's complement` };
    return { bytes: encodeVarint(n), encoded: `${n}` };
  }, [n, zigzag]);

  const fixed = Math.abs(n) < 2 ** 31 ? 4 : 8; // a fixed int32 or int64 it would replace
  const hex = bytes.map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');

  return (
    <div className="vrnt">
      <p className="vrnt-intro">
        A fixed <code>int64</code> spends <strong>8 bytes</strong> to store the number 3. A <strong>varint</strong>
        spends 7 bits of each byte on data and the top bit as a <strong>continuation flag</strong> (1 = more
        bytes follow), little-endian — so 0–127 fit in one byte and you only pay for the magnitude you use.
        It's how every Protocol Buffers / gRPC field number and integer is encoded.
      </p>

      <div className="vrnt-controls">
        <label className="vrnt-num">value
          <input type="number" value={n} onChange={(e) => setN(Math.trunc(+e.target.value) || 0)} />
        </label>
        <label className={`vrnt-zig ${zigzag ? 'on' : ''}`}>
          <input type="checkbox" checked={zigzag} onChange={(e) => setZigzag(e.target.checked)} />
          zigzag (sint32/64)
        </label>
        <div className="vrnt-quick">{[0, 1, 127, 128, 300, -1, -300].map((v) => (
          <button key={v} type="button" className={n === v ? 'on' : ''} onClick={() => setN(v)}>{v}</button>
        ))}</div>
      </div>

      <div className="vrnt-encwhat">encoding <code>{encoded}</code> → {bytes.length} byte{bytes.length === 1 ? '' : 's'}: <code>{hex}</code></div>

      <div className="vrnt-bytes">
        {bytes.map((b, i) => {
          const cont = b >> 7;
          const last = i === bytes.length - 1;
          return (
            <div key={i} className={`vrnt-byte ${last ? 'last' : ''}`}>
              <div className="vrnt-hex">0x{b.toString(16).toUpperCase().padStart(2, '0')}</div>
              <div className="vrnt-bits">
                <span className={`vrnt-cbit ${cont ? 'set' : 'clear'}`} title={cont ? 'continuation: more bytes follow' : 'last byte'}>{cont}</span>
                <span className="vrnt-pbits">{bits7(b)}</span>
              </div>
              <div className="vrnt-blbl">{last ? 'last' : 'continue'} · group {i}</div>
            </div>
          );
        })}
      </div>

      <div className="vrnt-tally">
        <div className={`vrnt-stat ${bytes.length <= fixed ? 'ok' : 'bad'}`}><span>varint</span><b>{bytes.length} B</b></div>
        <div className="vrnt-stat"><span>fixed int{fixed * 8}</span><b>{fixed} B</b></div>
        <div className="vrnt-stat"><span>{bytes.length <= fixed ? 'saved' : 'overhead'}</span><b>{fixed - bytes.length > 0 ? '−' : '+'}{Math.abs(fixed - bytes.length)} B</b></div>
      </div>

      {n < 0 && !zigzag && (
        <div className="vrnt-warn">⚠ A negative number in a plain <code>int32/int64</code> field is two's-complement-extended to 64 bits — all high bits set — so it always takes the full <strong>10 bytes</strong>. Turn on zigzag to see it collapse.</div>
      )}

      <p className="vrnt-foot">
        Decoding just walks bytes while the continuation bit is set, shifting each 7-bit group up by 7 more
        bits. The sign gotcha is why proto3 splits integer types: <code>int32</code>/<code>int64</code> store
        the raw two's complement (cheap for positives, 10 bytes for any negative), <code>sint32</code>/
        <code>sint64</code> apply zigzag first (cheap for small magnitudes either way), and
        <code> fixed32</code>/<code>fixed64</code> skip varint entirely for values that are usually large. The
        same continuation-bit trick encodes the field tag (field number ≪ 3 | wire type) that precedes every
        value. (Protocol Buffers encoding; LEB128, also used in DWARF and WebAssembly.)
      </p>
    </div>
  );
}
