// Error detection & correction — made interactive. Parity, the Internet
// checksum, a CRC shift-register you can watch clock, Hamming(7,4) single-bit
// CORRECTION (flip a bit, watch it get located and repaired), and Luhn.
// Every number here is computed by errordetect.ts — nothing illustrative.
import { useMemo, useState } from 'react';
import { parityBit, internetChecksum, crc8Trace, hammingEncode, hammingDecode, luhn } from './errordetect';

const hex2 = (v: number) => v.toString(16).toUpperCase().padStart(2, '0');
const bin8 = (v: number) => v.toString(2).padStart(8, '0');

type Tool = 'parity' | 'checksum' | 'crc' | 'hamming' | 'luhn';
const TOOLS: { id: Tool; label: string }[] = [
  { id: 'parity', label: 'Parity bit' },
  { id: 'checksum', label: 'Internet checksum' },
  { id: 'crc', label: 'CRC (shift register)' },
  { id: 'hamming', label: 'Hamming — correct a bit' },
  { id: 'luhn', label: 'Luhn (cards)' },
];

export function ErrorDetectSection() {
  const [tool, setTool] = useState<Tool>('hamming');
  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Error detection &amp; correction</h2></div>
        <p className="jsec-sub">
          Wires flip bits — cosmic rays, noise, bad cables. These are the real algorithms that catch (and
          sometimes repair) the damage, from a single parity bit to the CRC on every Ethernet frame.
        </p>
        <nav className="subtabs">
          {TOOLS.map((t) => (
            <button key={t.id} className={tool === t.id ? 'on' : ''} onClick={() => setTool(t.id)}>{t.label}</button>
          ))}
        </nav>
        {tool === 'parity' && <ParityTool />}
        {tool === 'checksum' && <ChecksumTool />}
        {tool === 'crc' && <CrcTool />}
        {tool === 'hamming' && <HammingTool />}
        {tool === 'luhn' && <LuhnTool />}
      </section>
    </div>
  );
}

function ParityTool() {
  const [byte, setByte] = useState(0b10110100);
  const bits = useMemo(() => Array.from({ length: 8 }, (_, i) => (byte >> (7 - i)) & 1), [byte]);
  const ones = bits.reduce((s, b) => s + b, 0);
  const even = parityBit(byte, false);
  return (
    <>
      <p className="jsec-sub">The cheapest check: one extra bit that makes the number of 1s even. Flip any bit — if an
        odd number of bits change, the parity no longer matches and the error is caught. (It can't catch two flips.)</p>
      <div className="bitflip">
        {bits.map((b, i) => (
          <button key={i} className={`bf ${b ? 'on' : ''}`} onClick={() => setByte(byte ^ (1 << (7 - i)))}>{b}</button>
        ))}
        <span className="ed-sep">parity</span>
        <span className={`bf parity ${even ? 'on' : ''}`} title="even-parity bit">{even}</span>
      </div>
      <div className="enc-grid">
        <Row k="data" val={`0b${bin8(byte)} (0x${hex2(byte)})`} />
        <Row k="ones" val={`${ones} → ${ones % 2 === 0 ? 'even' : 'odd'}`} />
        <Row k="even-parity bit" val={`${even} (makes the total even)`} />
        <Row k="transmitted" val={`${bin8(byte)} ${even}  ← 9 bits`} />
      </div>
    </>
  );
}

function ChecksumTool() {
  const [text, setText] = useState('45 00 00 3c 1c 46 40 00 40 06 ac 10 0a 63 ac 10 0a 0c');
  const bytes = useMemo(() => text.trim().split(/\s+/).map((h) => parseInt(h, 16)).filter((n) => !Number.isNaN(n)), [text]);
  const r = useMemo(() => internetChecksum(bytes), [bytes]);
  return (
    <>
      <p className="jsec-sub">IP, TCP and UDP all carry this: add up the data in 16-bit words, fold the carries back in,
        then flip every bit. The receiver re-adds <em>everything including the checksum</em> and must get all-ones.
        Type hex bytes (a real IPv4 header is shown).</p>
      <input className="enc-input" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
      <div className="ck-steps">
        {r.steps.map((s, i) => (
          <div className="ck-step" key={i}>
            <span className="ck-word">+ {s.word.toString(16).toUpperCase().padStart(4, '0')}</span>
            <span className="ck-sum">= {s.runningSum.toString(16).toUpperCase()}</span>
          </div>
        ))}
      </div>
      <div className="enc-grid">
        <Row k="folded sum" val={`0x${r.folded.toString(16).toUpperCase().padStart(4, '0')}`} />
        <Row k="checksum (~sum)" val={`0x${r.checksum.toString(16).toUpperCase().padStart(4, '0')}`} />
      </div>
      <p className="enc-note">{r.checksum === 0
        ? 'Checksum is 0x0000 — these bytes already include a valid checksum, so they verify.'
        : 'Place this value in the checksum field; the receiver will then sum to 0x0000.'}</p>
    </>
  );
}

function CrcTool() {
  const [text, setText] = useState('ACK');
  const bytes = useMemo(() => [...new TextEncoder().encode(text)].slice(0, 8), [text]);
  const r = useMemo(() => crc8Trace(bytes), [bytes]);
  return (
    <>
      <p className="jsec-sub">Every Ethernet frame ends in a 32-bit CRC. It's polynomial division done by a shift register:
        XOR a byte in, then clock 8 times — when a 1 falls off the top, XOR the polynomial back in. Here's a watchable
        8-bit version (poly 0x07). The remainder is the CRC.</p>
      <input className="enc-input narrow" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} maxLength={8} />
      <div className="lfsr">
        {r.steps.map((s, i) => (
          <div className={`lfsr-step ${s.xored ? 'xor' : ''} ${s.absorbed !== null ? 'absorb' : ''}`} key={i} title={s.absorbed !== null ? `absorb 0x${hex2(s.absorbed)}` : ''}>
            <span className="lf-reg">{bin8(s.after)}</span>
            {s.xored && <span className="lf-tag">⊕poly</span>}
            {s.absorbed !== null && <span className="lf-byte">{String.fromCharCode(bytes[s.inByte])}</span>}
          </div>
        ))}
      </div>
      <div className="enc-grid">
        <Row k="clocks" val={`${r.steps.length} (${bytes.length} bytes × 8)`} />
        <Row k="CRC-8 remainder" val={`0x${hex2(r.remainder)} = 0b${bin8(r.remainder)}`} />
      </div>
    </>
  );
}

function HammingTool() {
  const [data, setData] = useState([1, 0, 1, 1]);
  const enc = useMemo(() => hammingEncode(data), [data]);
  // `received` is the codeword as it arrives — start equal to the clean code.
  const [received, setReceived] = useState<number[] | null>(null);
  const code = received ?? enc.code;
  const dec = useMemo(() => hammingDecode(code), [code]);

  const setDataBit = (i: number) => { const d = data.slice(); d[i] ^= 1; setData(d); setReceived(null); };
  const flipWire = (pos: number) => { const c = (received ?? enc.code).slice(); c[pos] ^= 1; setReceived(c); };
  const reset = () => setReceived(null);

  const labels = ['p1', 'p2', 'd1', 'p3', 'd2', 'd3', 'd4'];
  return (
    <>
      <p className="jsec-sub">Hamming(7,4) doesn't just <em>detect</em> a flipped bit — it <strong>locates and repairs</strong> it.
        Three parity bits, cleverly overlapped, form a 3-bit "syndrome" that is exactly the position of the broken bit.
        Set your 4 data bits, then <strong>click a wire bit to corrupt it</strong> and watch the receiver fix it.</p>

      <div className="ham-row">
        <span className="ham-label">data (4 bits)</span>
        <div className="bitflip small">
          {data.map((b, i) => <button key={i} className={`bf ${b ? 'on' : ''}`} onClick={() => setDataBit(i)}>{b}</button>)}
        </div>
      </div>

      <div className="ham-row">
        <span className="ham-label">on the wire (7 bits)</span>
        <div className="bitflip small">
          {code.map((b, i) => {
            const flipped = (received ?? enc.code)[i] !== enc.code[i];
            const isErr = dec.errorPos === i + 1;
            return (
              <button key={i} className={`bf ham ${b ? 'on' : ''} ${flipped ? 'flipped' : ''} ${isErr ? 'culprit' : ''}`}
                onClick={() => flipWire(i)} title={`position ${i + 1} (${labels[i]})`}>
                {b}<em>{labels[i]}</em>
              </button>
            );
          })}
        </div>
      </div>

      <div className="ham-verdict">
        {dec.syndrome === 0 ? (
          <span className="ok">✓ syndrome 000 — no error detected.</span>
        ) : (
          <span className="fix">⚠ syndrome {dec.syndrome.toString(2).padStart(3, '0')} = {dec.syndrome} → bit&nbsp;
            <strong>position {dec.errorPos}</strong> ({labels[dec.errorPos! - 1]}) was flipped → <strong>corrected.</strong></span>
        )}
        {received && <button className="ghost small" onClick={reset}>reset wire</button>}
      </div>

      <div className="enc-grid">
        <Row k="encoded codeword" val={enc.code.join(' ')} />
        <Row k="received" val={code.join(' ')} />
        <Row k="recovered data" val={dec.data.join(' ')} />
        <Row k="data intact?" val={dec.data.join('') === data.join('') ? 'yes ✓ (repaired)' : 'NO — two bits flipped (beyond repair)'} />
      </div>
    </>
  );
}

function LuhnTool() {
  const [text, setText] = useState('4539 1488 0343 6467');
  const r = useMemo(() => luhn(text), [text]);
  return (
    <>
      <p className="jsec-sub">You've used this thousands of times without knowing: the last digit of every credit-card
        number is a Luhn check digit. Double every second digit from the right, subtract 9 if over 9, sum it all —
        a valid number is divisible by 10. It catches any single mistyped digit and most digit swaps.</p>
      <input className="enc-input" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
      {r ? (
        <>
          <div className="luhn-digits">
            {r.digits.map((d, i) => {
              const fromRight = r.digits.length - 1 - i;
              const doubled = fromRight % 2 === 1;
              return (
                <div key={i} className={`luhn-d ${doubled ? 'dbl' : ''}`}>
                  <span className="ld-in">{d}</span>
                  <span className="ld-out">{r.doubled[i]}</span>
                </div>
              );
            })}
          </div>
          <div className="enc-grid">
            <Row k="sum" val={`${r.sum}`} />
            <Row k="sum mod 10" val={`${r.sum % 10}`} />
          </div>
          <p className={r.valid ? 'ed-ok' : 'ed-bad'}>{r.valid ? '✓ valid — passes the Luhn check' : '✗ invalid — fails the Luhn check (a typo would do this)'}</p>
        </>
      ) : <p className="enc-err">Enter digits (spaces and dashes are fine).</p>}
    </>
  );
}

function Row({ k, val }: { k: string; val: string }) {
  return <div className="enc-line"><span className="k">{k}</span><code>{val}</code></div>;
}
