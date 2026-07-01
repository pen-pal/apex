// How RAM works, made visible. Decode a physical address into (bank, row, column) and issue access patterns to
// watch the row buffer turn locality into speed: sequential access keeps hitting the open row; random access
// keeps conflicting and paying the precharge. Real DDR4 timings from dram.ts.
import { useMemo, useState } from 'react';
import { decode, Dram, DDR4, T, type RowState } from './dram';

const PATTERNS: { name: string; gen: (n: number) => number[] }[] = [
  { name: 'sequential', gen: (n) => Array.from({ length: n }, (_, i) => i * 8) },
  { name: 'strided (row jumps)', gen: (n) => Array.from({ length: n }, (_, i) => i * (1 << 17)) },
  { name: 'random', gen: (n) => { let s = 99; return Array.from({ length: n }, () => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return (s % 4096) * 8 + (s % 8) * (1 << 17); }); } },
];
const BITS = 25; // show the low 25 bits of the address
const fieldOf = (bit: number) => bit < DDR4.burstBits ? 'burst' : bit < DDR4.burstBits + DDR4.colBits ? 'col' : bit < DDR4.burstBits + DDR4.colBits + DDR4.bankBits ? 'bank' : 'row';
const stateColor: Record<RowState, string> = { hit: '#1a7f37', miss: '#a85a00', conflict: '#cf222e' };

export function DramSection() {
  const [addr, setAddr] = useState(0x2a018);
  const [pat, setPat] = useState(PATTERNS[0]);

  const d = decode(addr);
  const bin = (addr >>> 0).toString(2).padStart(BITS, '0').slice(-BITS);

  const run = useMemo(() => {
    const mem = new Dram();
    const addrs = pat.gen(32);
    const results = addrs.map((a) => mem.access(a));
    const hits = results.filter((r) => r.state === 'hit').length;
    const avg = results.reduce((s, r) => s + r.latencyNs, 0) / results.length;
    return { results, hits, avg };
  }, [pat]);

  return (
    <div className="dram">
      <p className="dram-intro">
        A DRAM bit is one capacitor: charged = 1. It leaks, so every row is <strong>refreshed</strong> every 64 ms.
        Cells sit in a grid of rows × columns inside banks. Reading an address means: <strong>activate</strong> its
        row into the bank's one-row-wide <strong>row buffer</strong> (tRCD), then read a <strong>column</strong> out
        (tCL). The buffer is a cache — so the same row twice is fast, a different row in the same bank pays a
        <strong> precharge</strong> first.
      </p>

      <label className="dram-addr">physical address 0x<input value={addr.toString(16)} onChange={(e) => { const v = parseInt(e.target.value, 16); if (!isNaN(v)) setAddr(v >>> 0); }} spellCheck={false} /></label>

      <div className="dram-bits">
        {[...bin].map((b, i) => {
          const bit = BITS - 1 - i;
          return <span key={i} className={`dram-bit ${fieldOf(bit)}`}>{b}</span>;
        })}
      </div>
      <div className="dram-decode">
        <span className="dram-fld row">row <b>{d.row}</b></span>
        <span className="dram-fld bank">bank <b>{d.bank}</b></span>
        <span className="dram-fld col">column <b>{d.column}</b></span>
        <span className="dram-fld burst">byte <b>{d.burst}</b></span>
      </div>

      <div className="dram-patline">
        <span className="dram-pl">access pattern:</span>
        {PATTERNS.map((p) => <button key={p.name} type="button" className={`dram-pbtn ${pat.name === p.name ? 'on' : ''}`} onClick={() => setPat(p)}>{p.name}</button>)}
      </div>

      <div className="dram-track">
        {run.results.map((r, i) => (
          <span key={i} className="dram-acc" style={{ background: stateColor[r.state] }} title={`bank ${r.addr.bank} row ${r.addr.row} — ${r.state} (${r.latencyNs}ns)`} />
        ))}
      </div>
      <div className="dram-legend"><span className="dram-lg" style={{ color: stateColor.hit }}>■ hit {T.CL}ns</span><span className="dram-lg" style={{ color: stateColor.miss }}>■ miss {T.RCD + T.CL}ns</span><span className="dram-lg" style={{ color: stateColor.conflict }}>■ conflict {T.RP + T.RCD + T.CL}ns</span></div>

      <div className="dram-stats">
        <div className="dram-stat"><span>row-buffer hits</span><b>{run.hits}/32</b></div>
        <div className="dram-stat"><span>avg latency</span><b>{run.avg.toFixed(1)} ns</b></div>
        <div className="dram-stat"><span>vs all-conflict</span><b>{((run.avg / (T.RP + T.RCD + T.CL)) * 100).toFixed(0)}%</b></div>
      </div>

      <p className="dram-foot">
        Sequential access rides one open row and hits; strided and random access keep landing on new rows in the
        same bank and pay precharge+activate every time — a 3× latency swing from the access pattern alone, no code
        change. This is the hardware reason arrays beat linked lists, why the memory controller reorders requests to
        group same-row accesses, and why spreading traffic across many banks lets their protocols overlap. SRAM
        (CPU cache) skips all of this — it latches instead of leaking, so no refresh and near-uniform latency — but
        costs ~6 transistors per bit versus DRAM's one, which is the entire reason your cache is megabytes and your
        RAM is gigabytes. (JEDEC DDR4; timings ≈ DDR4-3200 CL22.)
      </p>
    </div>
  );
}
