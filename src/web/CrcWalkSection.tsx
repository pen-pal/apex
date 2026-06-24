// CRC-32, made visible. Watch the 32-bit shift register fold in your input one byte at a
// time, expand any byte into its eight shift-and-XOR steps, and flip a single bit to see
// the checksum change completely — the property that lets a receiver catch corruption.
// Real reflected IEEE 802.3 CRC-32 in crc32walk.ts (tested against the 0xCBF43926 check
// value), the same polynomial behind the Ethernet FCS, gzip, and PNG.
import { useMemo, useState } from 'react';
import { crc32Trace, byteBitSteps, strBytes, toHex32, POLY } from './crc32walk';

const bin32 = (n: number) => (n >>> 0).toString(2).padStart(32, '0');

export function CrcWalkSection() {
  const [text, setText] = useState('123456789');
  const [sel, setSel] = useState(0);
  const [flip, setFlip] = useState(false);

  const bytes = useMemo(() => strBytes(text), [text]);
  const flipped = useMemo(() => { const b = bytes.slice(); if (flip && b.length) b[0] ^= 0x01; return b; }, [bytes, flip]);
  const trace = useMemo(() => crc32Trace(flipped), [flipped]);
  const clean = useMemo(() => crc32Trace(bytes), [bytes]);

  const selIdx = Math.min(sel, Math.max(0, bytes.length - 1));
  const crcInForSel = selIdx === 0 ? 0xffffffff : trace.bytes[selIdx - 1].reg;
  const bitSteps = bytes.length ? byteBitSteps(crcInForSel, flipped[selIdx]) : [];

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>CRC-32 — a shift register that catches corruption</h2></div>
        <p className="jsec-sub">
          A CRC isn’t addition — it’s the remainder of a polynomial division done with XOR, computed by a 32-bit shift register. For
          every input bit the register shifts right and, if the bit shifted out was set, XORs in the generator polynomial
          <code> 0x{toHex32(POLY)}</code>. The same maths runs in your NIC (Ethernet FCS), gzip, and PNG. Type some input:
        </p>

        <input className="crcw-input" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />

        <div className="crcw-final">
          CRC-32 = <code>0x{toHex32(trace.crc)}</code>
          {flip && <span className="crcw-diff"> · clean input was <code>0x{toHex32(clean.crc)}</code> — one flipped bit, totally different</span>}
        </div>

        <label className="crcw-flip"><input type="checkbox" checked={flip} onChange={(e) => setFlip(e.target.checked)} disabled={!bytes.length} /> flip one bit of the first byte (simulate a wire error)</label>

        <div className="crcw-bytes">
          {trace.bytes.map((b, i) => (
            <button key={i} className={`crcw-byte ${i === selIdx ? 'sel' : ''}`} onClick={() => setSel(i)}>
              <span className="crcw-bchar">{String.fromCharCode(flipped[i]).replace(/[^\x20-\x7e]/, '·')}</span>
              <span className="crcw-bhex">{flipped[i].toString(16).padStart(2, '0')}</span>
              <span className="crcw-breg">{toHex32(b.reg)}</span>
            </button>
          ))}
        </div>
        <div className="crcw-axis"><span>byte / char</span><span>register after</span></div>

        {bytes.length > 0 && (
          <div className="crcw-bits">
            <h3>Byte {selIdx} = 0x{flipped[selIdx].toString(16).padStart(2, '0')} — the 8 shift steps</h3>
            <div className="crcw-bitrows">
              <div className="crcw-bitrow head"><span>step</span><span>LSB out</span><span>register (binary)</span></div>
              {bitSteps.map((s) => (
                <div key={s.bit} className={`crcw-bitrow ${s.lsbWasSet ? 'xor' : ''}`}>
                  <span>{s.bit + 1}</span>
                  <span>{s.lsbWasSet ? '1 → XOR poly' : '0 → shift only'}</span>
                  <span className="crcw-reg">{bin32(s.reg)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="crcw-foot">
          CRC-32 catches all single-bit errors, all double-bit errors, any odd number of bit errors, and any burst error up to 32 bits —
          which is why it guards every Ethernet frame. What it does <em>not</em> provide is security: an attacker who can change the data
          can recompute the CRC, so integrity-against-tampering needs an HMAC or a signature, not a CRC.
        </p>
      </section>
    </div>
  );
}
