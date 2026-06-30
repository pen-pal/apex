// Pipeline hazards, made visible. Edit a short instruction stream and toggle forwarding: the space-time
// grid shows each instruction marching through IF/ID/EX/MEM/WB, and an instruction that depends on a
// not-yet-ready result shifts right — that gap is the stall (bubble). Forwarding bypasses EX results so
// the ALU chain runs back-to-back; only the load-use hazard still costs a cycle. Real timing from pipeline.ts.
import { useMemo, useState } from 'react';
import { simulate, parseProgram } from './pipeline';

const STAGES = ['IF', 'ID', 'EX', 'MEM', 'WB'] as const;
const STAGE_HUE: Record<string, number> = { IF: 212, ID: 190, EX: 150, MEM: 35, WB: 280 };
const PRESETS: Record<string, string> = {
  'load-use + ALU chain': 'lw r1, 0(r2)\nadd r2, r1, r3\nsub r4, r2, r5\nadd r6, r1, r4',
  'all independent': 'add r1, r2, r3\nadd r4, r5, r6\nsub r7, r8, r9\nor r10, r11, r12',
  'two loads': 'lw r1, 0(r5)\nadd r2, r1, r6\nlw r3, 0(r7)\nsub r4, r3, r2',
};

export function PipelineSection() {
  const [src, setSrc] = useState(PRESETS['load-use + ALU chain']);
  const [fwd, setFwd] = useState(true);

  const instrs = useMemo(() => parseProgram(src).slice(0, 8), [src]);
  const r = useMemo(() => simulate(instrs, fwd), [instrs, fwd]);
  const other = useMemo(() => simulate(instrs, !fwd), [instrs, fwd]);
  const maxCycle = r.cycles;
  const stageAt = (row: typeof r.rows[number], cyc: number): string | null => {
    for (const s of STAGES) if (row[s.toLowerCase() as 'if' | 'id' | 'ex' | 'mem' | 'wb'] === cyc) return s;
    return null;
  };

  return (
    <div className="pipe">
      <div className="pipe-top">
        <div className="pipe-presets">
          {Object.keys(PRESETS).map((k) => <button key={k} type="button" onClick={() => setSrc(PRESETS[k])}>{k}</button>)}
        </div>
        <label className="pipe-fwd"><input type="checkbox" checked={fwd} onChange={(e) => setFwd(e.target.checked)} /> forwarding (bypass)</label>
      </div>

      <div className="pipe-main">
        <textarea className="pipe-src" value={src} spellCheck={false} onChange={(e) => setSrc(e.target.value)} rows={Math.max(4, instrs.length)} />

        <div className="pipe-grid-wrap">
          <table className="pipe-grid">
            <thead>
              <tr><th className="pipe-instr-h">instruction</th>{Array.from({ length: maxCycle }, (_, c) => <th key={c}>{c + 1}</th>)}</tr>
            </thead>
            <tbody>
              {r.rows.map((row, i) => (
                <tr key={i}>
                  <td className={`pipe-instr ${row.stalledBy !== null ? 'stalled' : ''}`}>{row.instr.text}</td>
                  {Array.from({ length: maxCycle }, (_, c) => {
                    const st = stageAt(row, c + 1);
                    return <td key={c} className="pipe-cell">{st && <span className="pipe-stage" style={{ background: `hsl(${STAGE_HUE[st]} 60% 88%)`, color: `hsl(${STAGE_HUE[st]} 60% 30%)` }}>{st}</span>}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="pipe-stats">
        <div className="pipe-stat"><span>cycles</span><b>{r.cycles}</b></div>
        <div className="pipe-stat"><span>ideal (no stalls)</span><b>{r.idealCycles}</b></div>
        <div className={`pipe-stat ${r.stalls > 0 ? 'hot' : ''}`}><span>stall bubbles</span><b>{r.stalls}</b></div>
        <div className="pipe-stat"><span>CPI</span><b>{r.cpi.toFixed(2)}</b></div>
        <div className="pipe-stat alt"><span>{fwd ? 'without' : 'with'} forwarding</span><b>{other.cycles} cyc</b></div>
      </div>

      <p className="pipe-foot">
        Without forwarding, a dependent instruction waits until the producer’s <strong>WB</strong> writes the register (≈3 bubbles each). Forwarding
        wires the <strong>EX</strong> result straight into the next instruction’s EX, so an ALU→ALU dependency costs nothing — the chain runs
        back-to-back. The one case forwarding can’t fix is the <strong>load-use hazard</strong>: a load’s value only exists after <strong>MEM</strong>,
        so an instruction that uses it on the very next cycle still eats exactly one bubble (a compiler hides it by reordering an independent
        instruction into the slot). Branches add a separate control hazard, handled by prediction. (Patterson &amp; Hennessy, ch.4.)
      </p>
    </div>
  );
}
