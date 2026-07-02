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
        Everything a computer does bottoms out in one part: a <strong>switch</strong>. A transistor is a switch you
        flip with electricity — a little voltage on its gate lets current through. Pair two kinds (one opens on
        high voltage, one on low) and you get a circuit that always slams its output firmly to <strong>1</strong>
        or <strong>0</strong>, never in between. Below is a NAND gate made of four of them. Flip A and B and watch
        which transistors switch on.
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
        Here's the real magic: this one gate can build all the others. Tie a NAND's two inputs together and it
        becomes a NOT. Feed that back in and you have AND. A few more give you OR and XOR. So a chip factory never
        designs a thousand different parts — it obsesses over making <em>one</em> microscopic switch as small and
        fast as possible, then stamps out billions of them. That's the whole secret of a processor: not clever
        parts, but one dead-simple part repeated at a scale you can't quite picture. (It's also why your laptop
        gets warm: in this design one half of every gate is always off, so it sips power only in the instant it
        flips — which is exactly why a faster clock runs hotter.)
      </p>
    </div>
  );
}
