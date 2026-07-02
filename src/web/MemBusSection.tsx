// Address decoding, made visible. Type a 16-bit address and watch the top two bits drive a 2-to-4 decoder that
// lights exactly one chip-select line, waking one device (ROM/RAM/I/O) while the rest stay off the bus. The low
// bits are the offset the chosen chip decodes internally. Real logic from membus.ts.
import { useState } from 'react';
import { decode, MAP, pageRange, PAGE_BITS } from './membus';

const hex4 = (n: number) => n.toString(16).padStart(4, '0').toUpperCase();

export function MemBusSection() {
  const [addr, setAddr] = useState(0xc020);
  const d = decode(addr);
  const bits = (addr & 0xffff).toString(2).padStart(16, '0');

  return (
    <div className="mbus">
      <p className="mbus-intro">
        ROM, RAM, and every I/O device share one <strong>address bus</strong> and one <strong>data bus</strong>.
        When the CPU puts out an address, exactly one chip must answer — or several drive the data bus at once and
        it's garbage. <strong>Address decoding</strong> makes that happen: a decoder reads the high address bits
        and asserts one <strong>chip-select</strong> line, waking one device and tri-stating the rest.
      </p>

      <label className="mbus-addr">address 0x<input value={hex4(addr)} onChange={(e) => { const v = parseInt(e.target.value, 16); if (!isNaN(v)) setAddr(v & 0xffff); }} spellCheck={false} maxLength={4} /></label>

      <div className="mbus-bits">
        {[...bits].map((b, i) => {
          const bitNo = 15 - i;
          const isPage = bitNo >= PAGE_BITS;
          return <span key={i} className={`mbus-bit ${isPage ? 'page' : 'off'}`} title={isPage ? `A${bitNo} — page select` : `A${bitNo} — offset`}>{b}</span>;
        })}
        <span className="mbus-bitlbl"><b className="mbus-pg">A15–A14</b> select · <b className="mbus-of">A13–A0</b> offset</span>
      </div>

      <div className="mbus-decoder">2-to-4 decoder → chip-select</div>

      <div className="mbus-map">
        {MAP.map((r, i) => {
          const [s, e] = pageRange(i);
          const on = d.page === i;
          return (
            <div key={i} className={`mbus-dev ${on ? 'on' : ''} k-${r.kind.replace('/', '')}`}>
              <span className={`mbus-cs ${on ? 'hi' : ''}`}>CS{i} {on ? '1' : '0'}</span>
              <span className="mbus-dname">{r.name}</span>
              <span className="mbus-drange">0x{hex4(s)}–0x{hex4(e)}</span>
              {on && <span className="mbus-doff">offset 0x{d.offset.toString(16).toUpperCase()}</span>}
            </div>
          );
        })}
      </div>

      <div className="mbus-verdict">
        0x{hex4(addr)} → the decoder wakes <b>{d.region.name}</b>; the chip reads its own byte at offset
        <b> 0x{d.offset.toString(16).toUpperCase()}</b>. The other three stay off the bus.
      </div>

      <p className="mbus-foot">
        Two things follow. Memory-mapped I/O: since a device is chosen by an address range just like RAM, the CPU
        drives a screen or disk with the same load/store instructions it uses for memory. Write a byte to
        <code>0xC020</code> to set a pixel, read <code>0xC000</code> for the last key, no special I/O opcodes. And
        the decoder can be coarse or fine: fewer high bits and a device answers a huge range (its registers
        aliasing at many addresses, the "mirrored" memory of old machines); more bits and you carve a precise
        window. The selected chip then runs its own internal decode, and for DRAM the offset splits again into
        bank, row, and column. So one load threads two decoders: one across chips on the bus, one inside the chip
        that answers. (Classic 6502/Z80 memory maps; the 74x138 decoder.)
      </p>
    </div>
  );
}
