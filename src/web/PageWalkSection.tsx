// The x86-64 page-table walk, made visible. Type a virtual address; watch it split into four 9-bit
// table indices + a 12-bit offset, then chase CR3 → PML4 → PDPT → PD → PT to a physical frame — or
// hit a not-present entry and fault. On a fault, "demand-page it in" allocates a frame and the retry
// succeeds, exactly as the OS handles it. Real model + exact bit split from pagewalk.ts.
import { useMemo, useState } from 'react';
import { decompose, vaBinary, PageTable, hex, type Mapping } from './pagewalk';

const FIELD_HUES = [212, 150, 280, 28, 0]; // PML4, PDPT, PD, PT, offset
const FIELD_NAMES = ['PML4', 'PDPT', 'PD', 'PT', 'offset'];

// A small pre-populated address space. Typing anything else faults (then you can demand-page it).
const PRESETS: { label: string; va: number; frame: number }[] = [
  { label: 'code', va: 0x000000400abc, frame: 0x12 },
  { label: 'heap', va: 0x00007f3cd2e45abc, frame: 0x1d },
  { label: 'stack', va: 0x00007ffffffde123, frame: 0x2a },
];
const pageBase = (va: number) => Math.floor(va / 4096) * 4096;

export function PageWalkSection() {
  const [vaHex, setVaHex] = useState(hex(PRESETS[1].va));
  const [mappings, setMappings] = useState<Mapping[]>(PRESETS.map((p) => ({ va: pageBase(p.va), frame: p.frame })));

  const va = useMemo(() => {
    const n = Number(vaHex);
    return Number.isFinite(n) && n >= 0 && n < 2 ** 48 ? Math.floor(n) : NaN;
  }, [vaHex]);
  const valid = !Number.isNaN(va);
  const pt = useMemo(() => new PageTable(mappings), [mappings]);
  const result = useMemo(() => (valid ? pt.translate(va) : null), [pt, va, valid]);
  const fields = valid ? decompose(va) : null;
  const groups = valid ? vaBinary(va) : [];
  const fieldVals = fields ? [fields.pml4, fields.pdpt, fields.pd, fields.pt, fields.offset] : [];

  const demandPage = () => {
    if (!result || result.hit) return;
    const nextFrame = 0x40 + mappings.length;
    setMappings((m) => [...m, { va: pageBase(va), frame: nextFrame }]);
  };

  return (
    <div className="pgw">
      <p className="pgw-intro">
        Every running program is handed its own private, <em>pretend</em> view of memory: it believes it starts at address 0
        and owns the whole space — even though dozens of programs share the real RAM at once. Those <strong>virtual</strong>
        addresses aren’t real locations. On <em>every</em> memory access, the CPU translates the virtual address into a real
        <strong> physical</strong> one in the RAM chips, by walking a set of lookup tables the operating system fills in. That
        one layer of indirection buys three enormous things: <strong>isolation</strong> (a program literally can’t name another’s
        memory), the <strong>illusion of more memory than exists</strong> (idle pages get parked on disk), and the freedom to
        load a program anywhere. It is also the map an attacker studies — and the thing <em>ASLR</em> later randomizes. Type a
        virtual address below and watch the CPU translate it, table by table.
      </p>
      <div className="pgw-bar">
        <label className="pgw-input">virtual address
          <input value={vaHex} spellCheck={false} onChange={(e) => setVaHex(e.target.value.trim())} />
        </label>
        <div className="pgw-presets">
          {PRESETS.map((p) => (
            <button key={p.label} type="button" className="pgw-preset" onClick={() => setVaHex(hex(p.va))}>{p.label}</button>
          ))}
          <button type="button" className="pgw-preset" onClick={() => setVaHex('0x0000DEAD0000BEEF')}>unmapped</button>
        </div>
      </div>

      {!valid && <div className="pgw-err">Enter a hex virtual address in [0, 2⁴⁸). e.g. 0x00007F3CD2E45ABC</div>}

      {valid && fields && (
        <>
          <p className="pgw-splitlbl">The address is really five numbers stacked together — an index into each of four nested lookup tables, then the offset into the final 4 KB page:</p>
          <div className="pgw-split">
            {groups.map((bits, i) => (
              <div key={i} className="pgw-field" style={{ borderColor: `hsl(${FIELD_HUES[i]} 60% 60%)`, flexGrow: bits.length }}>
                <span className="pgw-fname" style={{ color: `hsl(${FIELD_HUES[i]} 60% 38%)` }}>{FIELD_NAMES[i]}</span>
                <span className="pgw-fbits">{bits}</span>
                <span className="pgw-fval">{i === 4 ? hex(fieldVals[i]) : fieldVals[i]}<span className="pgw-fw">{bits.length}b</span></span>
              </div>
            ))}
          </div>

          <div className="pgw-walk">
            <div className="pgw-reg">CR3</div>
            {result!.steps.map((s, i) => (
              <div key={s.level} className="pgw-stage-wrap">
                <span className="pgw-arrow" style={{ color: s.present ? 'hsl(150 45% 45%)' : 'hsl(0 60% 55%)' }}>→</span>
                <div className={`pgw-stage ${s.present ? 'hit' : 'fault'}`} style={{ borderColor: `hsl(${FIELD_HUES[i]} 60% 60%)` }}>
                  <div className="pgw-stage-lvl">{s.level}</div>
                  <div className="pgw-stage-idx">[{s.index}]</div>
                  <div className="pgw-stage-state">{s.present ? '✓ present' : '✗ not present'}</div>
                </div>
              </div>
            ))}
            {result!.hit && (
              <div className="pgw-stage-wrap">
                <span className="pgw-arrow" style={{ color: 'hsl(150 45% 45%)' }}>→</span>
                <div className="pgw-frame">frame<br /><b>{hex(result!.frame!)}</b></div>
              </div>
            )}
          </div>

          {result!.hit ? (
            <div className="pgw-result ok">
              <div className="pgw-pa">physical address = (frame {hex(result!.frame!)} « 12) | offset {hex(fields.offset)} = <b>{hex(result!.phys!)}</b></div>
              <div className="pgw-pa-sub">All four levels were present — a TLB miss would cost these four memory accesses; a TLB hit skips the whole walk.</div>
            </div>
          ) : (
            <div className="pgw-result fault">
              <div className="pgw-fa">🛑 PAGE FAULT at the <b>{result!.faultLevel}</b> level — the [{result!.steps[result!.steps.length - 1].index}] entry is not present.</div>
              <div className="pgw-fa-sub">The CPU traps to the OS. With demand paging, the OS allocates a frame, fills the missing entries, and restarts the instruction.</div>
              <button type="button" className="pgw-demand" onClick={demandPage}>Handle fault — demand-page it in ↻</button>
            </div>
          )}

          <div className="pgw-tables">
            <div className="pgw-tables-h">Currently mapped pages ({mappings.length})</div>
            <div className="pgw-maplist">
              {mappings.map((m, i) => (
                <button key={i} type="button" className={`pgw-maprow ${valid && pageBase(va) === m.va ? 'on' : ''}`} onClick={() => setVaHex(hex(m.va + (fields?.offset ?? 0)))}>
                  <span className="pgw-mva">{hex(m.va, 12)}</span><span className="pgw-marrow">→</span><span className="pgw-mfr">frame {hex(m.frame)}</span>
                </button>
              ))}
            </div>
          </div>

          <p className="pgw-foot">
            A 48-bit virtual address is four 9-bit indices (512 entries per table) plus a 12-bit offset (4 KiB pages) — the split is
            exact per the <strong>Intel SDM Vol.3 §4.5</strong>. The walk is a pointer chase of up to four memory reads, which is why CPUs
            cache completed translations in the <strong>TLB</strong>. A “not present” entry at any level raises a page fault; the OS decides
            whether it’s a valid demand-page (allocate &amp; retry) or an illegal access (segfault).
          </p>
        </>
      )}
    </div>
  );
}
