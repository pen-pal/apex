// From transistors to gates, made visible. Toggle two inputs and watch a CMOS NAND's four transistors conduct or
// block — the parallel PMOS pull-up and series NMOS pull-down deciding the output. Then pick any gate and see it
// built from NAND alone (NAND is universal), with its gate count and truth table. Real logic from transistor.ts.
import { useState } from 'react';
import { nmos, pmos, nand, notN, andN, orN, xorN, NAND_COST, truthTable, type Bit } from './transistor';

type Target = 'NOT' | 'AND' | 'OR' | 'XOR';
const FN: Record<Target, (a: Bit, b: Bit) => Bit> = { NOT: (a) => notN(a), AND: andN, OR: orN, XOR: xorN };

export function TransistorSection() {
  const [a, setA] = useState<Bit>(1);
  const [b, setB] = useState<Bit>(0);
  const [target, setTarget] = useState<Target>('XOR');

  const out = nand(a, b);
  const fn = FN[target];
  const tt = target === 'NOT'
    ? [{ a: 0 as Bit, b: 0 as Bit, out: notN(0) }, { a: 1 as Bit, b: 0 as Bit, out: notN(1) }]
    : truthTable(fn);

  const Tr = ({ kind, g, label }: { kind: 'pmos' | 'nmos'; g: Bit; label: string }) => {
    const on = kind === 'pmos' ? pmos(g) : nmos(g);
    return <span className={`trn-t ${kind} ${on ? 'on' : 'off'}`}>{label}<span className="trn-state">{on ? 'conducts' : 'blocks'}</span></span>;
  };

  return (
    <div className="trn">
      <p className="trn-intro">
        A transistor is a switch: an <strong>NMOS</strong> conducts when its gate is <strong>high</strong>, a
        <strong> PMOS</strong> when its gate is <strong>low</strong>. A CMOS gate wires a PMOS <em>pull-up</em> to
        power and an NMOS <em>pull-down</em> to ground so exactly one conducts for any input. Toggle the inputs of
        a NAND (2 PMOS in parallel up top, 2 NMOS in series below):
      </p>

      <div className="trn-inputs">
        <button type="button" className={`trn-in ${a ? 'hi' : ''}`} onClick={() => setA((x) => (x ? 0 : 1) as Bit)}>a = <b>{a}</b></button>
        <button type="button" className={`trn-in ${b ? 'hi' : ''}`} onClick={() => setB((x) => (x ? 0 : 1) as Bit)}>b = <b>{b}</b></button>
      </div>

      <div className="trn-cmos">
        <div className="trn-rail">＋V (1)</div>
        <div className="trn-net pullup"><span className="trn-nl">pull-up (PMOS ‖)</span><Tr kind="pmos" g={a} label="P:a" /><Tr kind="pmos" g={b} label="P:b" /></div>
        <div className={`trn-out ${out ? 'hi' : 'lo'}`}>output = <b>{out}</b> <span className="trn-eq">= NAND(a,b) = !(a·b)</span></div>
        <div className="trn-net pulldown"><span className="trn-nl">pull-down (NMOS series)</span><Tr kind="nmos" g={a} label="N:a" /><Tr kind="nmos" g={b} label="N:b" /></div>
        <div className="trn-rail">GND (0)</div>
      </div>

      <div className="trn-uni">
        <div className="trn-uh">NAND is <strong>universal</strong> — build any gate from it:</div>
        <div className="trn-tabs">{(['NOT', 'AND', 'OR', 'XOR'] as Target[]).map((t) => <button key={t} type="button" className={`trn-tab ${target === t ? 'on' : ''}`} onClick={() => setTarget(t)}>{t}</button>)}</div>
        <div className="trn-built">
          <span className="trn-cost">{target} = <b>{NAND_COST[target]}</b> NAND gate{NAND_COST[target] > 1 ? 's' : ''}</span>
          <table className="trn-tt">
            <thead><tr><th>a</th>{target !== 'NOT' && <th>b</th>}<th>{target}</th></tr></thead>
            <tbody>{tt.map((r, i) => <tr key={i}><td>{r.a}</td>{target !== 'NOT' && <td>{r.b}</td>}<td className={r.out ? 'hi' : ''}>{r.out}</td></tr>)}</tbody>
          </table>
        </div>
      </div>

      <p className="trn-foot">
        NOT is a NAND with its inputs tied together; AND is a NAND followed by that inverter; OR is a NAND fed two
        inverted inputs (De Morgan); XOR takes four. Because one gate type suffices, a fab can pour its effort into
        making a single transistor pair as small, fast, and reliable as possible and get every logic function for
        free — which is why chips are specified in transistor counts (billions) and gate delays. The complementary
        design is also why CMOS won: in steady state one network is always open and the other closed, so almost no
        current flows from power to ground; energy is spent mainly when the output actually switches, charging and
        discharging tiny capacitances. That is the direct link between clock speed and heat, and the wall that
        ended the megahertz race. From here it is just scale: wire these gates into the adder and the ALU for
        arithmetic, cross-couple them into the flip-flop for memory, and a few billion of them become a processor.
        (Harris &amp; Harris; Weste &amp; Harris, CMOS VLSI Design.)
      </p>
    </div>
  );
}
