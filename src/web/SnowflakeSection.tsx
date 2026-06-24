// Snowflake IDs, made visible. A 64-bit ID broken into its four coloured fields (sign,
// 41-bit timestamp, 10-bit worker, 12-bit sequence), with sliders for the timestamp and
// worker. A "generate a burst" button mints several IDs in the same millisecond so you
// watch the sequence climb and the IDs stay strictly increasing — and the roll-over when
// 4096 IDs in one millisecond is exceeded. Real bit-packing in snowflake.ts (tested).
import { useMemo, useState } from 'react';
import { encode, decode, next, bitFields, TWITTER_EPOCH, MAX_SEQUENCE, type GenState } from './snowflake';

const E = TWITTER_EPOCH;

export function SnowflakeSection() {
  const [msOffset, setMsOffset] = useState(5_000_000);
  const [worker, setWorker] = useState(7);
  const [seq, setSeq] = useState(0);
  const [burst, setBurst] = useState<bigint[]>([]);

  const id = useMemo(() => encode(E + BigInt(msOffset), BigInt(worker), BigInt(seq)), [msOffset, worker, seq]);
  const f = bitFields(id);
  const parts = decode(id);

  const genBurst = () => {
    let s: GenState = { lastMs: E + BigInt(msOffset), sequence: -1n }; // first call → seq 0
    const out: bigint[] = [];
    for (let i = 0; i < 8; i++) { const r = next(s, E + BigInt(msOffset), BigInt(worker)); s = r.state; out.push(r.id); }
    setBurst(out);
  };

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>Snowflake IDs — unique, sortable, no coordination</h2></div>
        <p className="jsec-sub">
          How do a thousand servers each hand out unique IDs without ever talking to each other? Pack the time, the machine, and a
          per-millisecond counter into 64 bits. Because the timestamp sits in the high bits, a bigger ID always means a later time — so
          the IDs sort themselves, which is exactly what you want for a database key.
        </p>

        <div className="snow-id">{id.toString()}</div>

        <div className="snow-bits">
          <div className="snow-field sign"><span className="snow-bin">{f.sign}</span><span className="snow-tag">sign<br />1 bit</span></div>
          <div className="snow-field ts"><span className="snow-bin">{f.timestamp}</span><span className="snow-tag">timestamp · 41 bits<br />{(parts.tsMs - E).toString()} ms since epoch</span></div>
          <div className="snow-field wk"><span className="snow-bin">{f.worker}</span><span className="snow-tag">worker · 10 bits<br />#{parts.worker.toString()}</span></div>
          <div className="snow-field sq"><span className="snow-bin">{f.sequence}</span><span className="snow-tag">sequence · 12 bits<br />#{parts.sequence.toString()}</span></div>
        </div>

        <div className="snow-controls">
          <label>timestamp +<input type="range" min={0} max={20_000_000} step={1000} value={msOffset} onChange={(e) => setMsOffset(+e.target.value)} /><b>{msOffset.toLocaleString()} ms</b></label>
          <label>worker<input type="range" min={0} max={1023} value={worker} onChange={(e) => setWorker(+e.target.value)} /><b>{worker}</b></label>
          <label>sequence<input type="range" min={0} max={Number(MAX_SEQUENCE)} value={seq} onChange={(e) => setSeq(+e.target.value)} /><b>{seq}</b></label>
        </div>

        <div className="snow-burst">
          <button onClick={genBurst}>⚡ generate a burst (same millisecond)</button>
          {burst.length > 0 && (
            <div className="snow-list">
              {burst.map((b, i) => (
                <div key={i} className="snow-row">
                  <code>{b.toString()}</code>
                  <span>seq {decode(b).sequence.toString()}{i > 0 && b > burst[i - 1] ? ' · ↑ larger' : ''}</span>
                </div>
              ))}
              <div className="snow-note">All minted in one millisecond by worker {worker}: the sequence climbs 0,1,2,… and every ID is strictly larger than the last. Exhaust all 4096 and the generator spills into the next millisecond.</div>
            </div>
          )}
        </div>

        <p className="snow-foot">
          41 timestamp bits cover ~69 years from the custom epoch; 10 worker bits allow 1024 nodes; 12 sequence bits allow 4096 IDs per
          millisecond per node — about 4 million IDs/second/node. The trade-off: IDs leak their creation time and a rough machine count,
          and the scheme depends on clocks not running backwards (NTP step-backs need handling). UUIDv7 applies the same time-ordered idea
          in the 128-bit UUID format.
        </p>
      </section>
    </div>
  );
}
