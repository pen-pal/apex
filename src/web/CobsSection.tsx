// COBS, made visible. Pick a payload (with zero bytes in it), and watch COBS remove every 0x00: each run of
// non-zero bytes is prefixed by a code byte holding the distance to the next zero, so no zero ever appears in
// the output — leaving 0x00 free to mark the end of the frame. Decode reverses it exactly. Real model from
// cobs.ts.
import { useMemo, useState } from 'react';
import { encode, decode, overhead } from './cobs';

const PRESETS: Record<string, number[]> = {
  'sensor packet': [0x2a, 0x00, 0x00, 0xff, 0x03, 0x00, 0x11],
  'text + nulls': [...'Hi'].map((c) => c.charCodeAt(0)).concat([0], [...'there'].map((c) => c.charCodeAt(0)), [0], [0x21]),
  'no zeros': [0x11, 0x22, 0x33, 0x44],
  'all zeros': [0, 0, 0, 0],
};
const hx = (b: number) => b.toString(16).padStart(2, '0').toUpperCase();

export function CobsSection() {
  const [data, setData] = useState<number[]>(PRESETS['sensor packet']);
  const [presetName, setPresetName] = useState('sensor packet');

  const enc = useMemo(() => encode(data), [data]);
  const dec = useMemo(() => decode(enc), [enc]);
  const roundtrips = JSON.stringify(dec) === JSON.stringify(data);

  // split the encoded stream into [code, ...run] blocks for display
  const blocks = useMemo(() => {
    const out: { code: number; run: number[] }[] = [];
    let i = 0;
    while (i < enc.length) { const code = enc[i++]; const run: number[] = []; for (let j = 1; j < code && i < enc.length; j++) run.push(enc[i++]); out.push({ code, run }); }
    return out;
  }, [enc]);

  const setPreset = (name: string) => { setPresetName(name); setData(PRESETS[name]); };
  const zeros = data.filter((b) => b === 0).length;

  return (
    <div className="cob">
      <p className="cob-intro">
        You want <code>0x00</code> to mean "end of frame" so a receiver can split a byte stream into frames — but
        payloads contain zeros too. COBS removes every zero: it chops the data into runs between zeros and
        prefixes each run with a <strong>code byte</strong> = the distance to the next zero. No zero survives in
        the output, so the only <code>0x00</code> on the wire is the delimiter you append. Pick a payload:
      </p>

      <div className="cob-presets">
        {Object.keys(PRESETS).map((name) => <button key={name} type="button" className={`cob-preset ${presetName === name ? 'on' : ''}`} onClick={() => setPreset(name)}>{name}</button>)}
      </div>

      <div className="cob-row">
        <span className="cob-label">payload<i>{data.length} bytes · {zeros} zero{zeros === 1 ? '' : 's'}</i></span>
        <div className="cob-bytes">
          {data.map((b, i) => <span key={i} className={`cob-byte ${b === 0 ? 'zero' : ''}`}>{hx(b)}</span>)}
          {data.length === 0 && <span className="cob-empty">(empty)</span>}
        </div>
      </div>

      <div className="cob-arrow">↓ COBS encode — each code byte points to the next zero</div>

      <div className="cob-row">
        <span className="cob-label">encoded<i>{enc.length} bytes · 0 zeros</i></span>
        <div className="cob-bytes">
          {blocks.map((blk, bi) => (
            <span key={bi} className="cob-block">
              <span className="cob-byte code" title={`code ${blk.code}: ${blk.code === 0xff ? '254 data bytes, no implied zero' : `${blk.code - 1} data bytes, then an implied zero`}`}>{hx(blk.code)}</span>
              {blk.run.map((b, i) => <span key={i} className="cob-byte">{hx(b)}</span>)}
            </span>
          ))}
          <span className="cob-byte delim" title="frame delimiter you append (the only zero on the wire)">00</span>
        </div>
      </div>

      <div className="cob-stats">
        <div className="cob-stat"><span>overhead</span><b>+{enc.length - data.length} byte{enc.length - data.length === 1 ? '' : 's'}</b></div>
        <div className="cob-stat"><span>worst case (⌊n/254⌋+1)</span><b>+{overhead(data.length)}</b></div>
        <div className="cob-stat ok"><span>zeros in output</span><b>0</b></div>
        <div className={`cob-stat ${roundtrips ? 'ok' : 'bad'}`}><span>decode round-trips</span><b>{roundtrips ? '✓' : '✗'}</b></div>
      </div>

      <p className="cob-foot">
        COBS’s overhead is <strong>bounded and predictable</strong>: exactly ⌊n/254⌋+1 bytes, no matter the
        data — so a 254-byte payload costs at most 2 bytes and you can size buffers exactly. Contrast escaping
        (SLIP/PPP), where every delimiter byte in the payload becomes two bytes, so a pathological packet full of
        delimiters <em>doubles</em> in size — unbounded overhead you must provision for. Why 254 and not 255? A
        code byte can express distances 1…254 to the next zero; 0x00 itself is reserved as the delimiter, and
        0xFF is the special "254 non-zero bytes, no implied zero" case that lets long zero-free runs continue
        without a phantom zero. COBS is used wherever you frame a raw byte stream: packet radio, hobby and
        industrial UART/serial links between microcontrollers, and USB CDC framing. A variant, COBS/R, folds the
        final code byte into the data to often save the extra byte entirely. It pairs with a checksum (the frame
        is COBS-encode(payload ‖ CRC), then a 0x00) so the receiver can both find frame boundaries and detect
        corruption. (Cheshire &amp; Baker, 1999.)
      </p>
    </div>
  );
}
