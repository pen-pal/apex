// Out-of-order execution, made visible. Edit a short program and see two schedules side by side: in-order (each
// instruction waits for the one before it) and out-of-order (each runs the moment its inputs are ready). Loads
// take 4 cycles; watch independent work slide under a load stall in the OoO timeline. Real logic from oooexec.ts.
import { useMemo, useState } from 'react';
import { schedule, rawDeps, parse } from './oooexec';

const PRESETS: Record<string, string> = {
  'load stall': 'r1 = load r0\nr2 = r1 + r1\nr3 = r8 + r8\nr4 = r3 + r3',
  'dependency chain': 'r1 = r0 + r0\nr2 = r1 + r1\nr3 = r2 + r2\nr4 = r3 + r3',
  'independent': 'r1 = r0 + r0\nr2 = r3 + r4\nr5 = load r6\nr7 = r8 + r9',
};

function Timeline({ insns, sched, maxCycle, title }: { insns: ReturnType<typeof parse>[]; sched: ReturnType<typeof schedule>; maxCycle: number; title: string }) {
  return (
    <div className="ooo-tl">
      <div className="ooo-tlh">{title} — <b>{sched.cycles}</b> cycles</div>
      <div className="ooo-grid" style={{ gridTemplateColumns: `120px repeat(${maxCycle}, 1fr)` }}>
        <div className="ooo-corner" />
        {Array.from({ length: maxCycle }, (_, c) => <div key={c} className="ooo-cyc">{c}</div>)}
        {insns.map((ins, i) => (
          <div key={i} className="ooo-insrow" style={{ gridColumn: '1 / -1', gridTemplateColumns: `120px repeat(${maxCycle}, 1fr)` }}>
            <span className="ooo-ins">{ins.text}</span>
            {Array.from({ length: maxCycle }, (_, c) => {
              const active = c >= sched.issue[i] && c < sched.issue[i] + ins.latency;
              return <span key={c} className={`ooo-slot ${active ? (ins.latency > 1 ? 'load' : 'alu') : ''}`} />;
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export function OooExecSection() {
  const [text, setText] = useState(PRESETS['load stall']);
  const insns = useMemo(() => text.split('\n').map((l) => l.trim()).filter(Boolean).map(parse), [text]);
  const io = useMemo(() => schedule(insns, true), [insns]);
  const oo = useMemo(() => schedule(insns, false), [insns]);
  const deps = useMemo(() => rawDeps(insns), [insns]);
  const maxCycle = Math.max(io.cycles, oo.cycles, 1);

  return (
    <div className="ooo">
      <p className="ooo-intro">
        An in-order CPU issues instructions in program order — when one stalls (a load missing cache takes 100+
        cycles), everything behind it waits, even independent work. An <strong>out-of-order</strong> core issues
        each instruction the moment its inputs are ready. <strong>Register renaming</strong> gives every write a
        fresh register, so the only order it must respect is <strong>true data dependencies</strong>; results still
        retire in program order. Edit the program:
      </p>

      <div className="ooo-presets">{Object.keys(PRESETS).map((k) => <button key={k} type="button" className={`ooo-preset ${text === PRESETS[k] ? 'on' : ''}`} onClick={() => setText(PRESETS[k])}>{k}</button>)}</div>
      <textarea className="ooo-editor" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} rows={insns.length + 1} />

      <div className="ooo-deps">true dependencies (RAW): {deps.map((d, i) => d.length ? `${insns[i].text.split('=')[0].trim()}←[${d.map((j) => insns[j].text.split('=')[0].trim()).join(',')}]` : null).filter(Boolean).join('  ·  ') || 'none — all independent'}</div>

      <Timeline insns={insns} sched={io} maxCycle={maxCycle} title="in-order" />
      <Timeline insns={insns} sched={oo} maxCycle={maxCycle} title="out-of-order" />

      <div className={`ooo-verdict ${oo.cycles < io.cycles ? 'win' : ''}`}>
        {oo.cycles < io.cycles
          ? <>OoO finishes in <b>{oo.cycles}</b> cycles vs in-order's <b>{io.cycles}</b> — a <b>{(io.cycles / oo.cycles).toFixed(2)}×</b> speedup by running independent work during stalls.</>
          : <>Both take <b>{io.cycles}</b> cycles — this program is a pure dependency chain, so there's no independent work to reorder. OoO can't beat the critical path.</>}
      </div>

      <p className="ooo-foot">
        The win is entirely about filling stalls, so it depends on the program: a dependency chain gives OoO
        nothing to do (it can't compute r4 before r3 exists), while a mispredicted branch or a cache-missing load
        with independent work around it is where OoO shines — the core keeps ~100+ instructions "in flight,"
        executing whatever is ready. That's why the extra transistors go to the reorder buffer, the physical
        register file (far more registers than the ISA names), the reservation stations that hold waiting
        instructions, and the wakeup/select logic that fires them — all invisible to the programmer, who still
        sees a machine that ran the code in order. Two costs pay for it: power (all that bookkeeping) and, subtly,
        security — because the CPU executes speculatively down predicted paths before knowing they're correct, and
        the mis-speculated work leaves traces in the cache, you get Spectre and Meltdown. So the same trick that
        makes CPUs fast also opened a decade of side-channel attacks. (Tomasulo, 1967; Hennessy &amp; Patterson,
        ch. 3.)
      </p>
    </div>
  );
}
