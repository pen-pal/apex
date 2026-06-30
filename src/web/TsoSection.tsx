// Memory consistency, made visible. Two cores run the store-buffer litmus test; toggle the memory
// model (Sequential Consistency vs x86-TSO) and the fence, and watch the reachable outcomes change.
// The whole point lands in one cell: r0=r1=0 is impossible under SC, appears the moment you switch to
// TSO (store buffers let each core read past its own pending write), and vanishes again with a fence.
// Outcomes come from an EXHAUSTIVE enumeration of the state space in tso.ts — not a sample.
import { useMemo, useState } from 'react';
import { outcomes, sbTest, type Model } from './tso';

const prog = (fenced: boolean) => [
  ['x = 1', ...(fenced ? ['MFENCE'] : []), 'r0 = y'],
  ['y = 1', ...(fenced ? ['MFENCE'] : []), 'r1 = x'],
];

export function TsoSection() {
  const [model, setModel] = useState<Model>('TSO');
  const [fenced, setFenced] = useState(false);

  const rows = useMemo(() => new Set(outcomes(sbTest(fenced), model, ['r0', 'r1'])), [model, fenced]);
  const reachable = (r0: number, r1: number) => rows.has(`r0=${r0}, r1=${r1}`);
  const weakAllowed = reachable(0, 0);
  const cols = prog(fenced);

  return (
    <div className="tso">
      <div className="tso-ctrls">
        <div className="tso-seg">
          {(['SC', 'TSO'] as Model[]).map((m) => (
            <button key={m} type="button" className={model === m ? 'on' : ''} onClick={() => setModel(m)}>
              {m === 'SC' ? 'Sequential Consistency' : 'x86-TSO (store buffers)'}
            </button>
          ))}
        </div>
        <label className="tso-fence"><input type="checkbox" checked={fenced} onChange={(e) => setFenced(e.target.checked)} /> MFENCE before each load</label>
      </div>

      <div className="tso-machine">
        {[0, 1].map((c) => (
          <div key={c} className="tso-core">
            <div className="tso-core-h">Core {c}</div>
            <ol className="tso-prog">
              {cols[c].map((line, i) => <li key={i} className={line === 'MFENCE' ? 'fence' : ''}>{line}</li>)}
            </ol>
            <div className={`tso-buf ${model === 'TSO' ? '' : 'off'}`}>{model === 'TSO' ? 'store buffer (FIFO)' : 'no buffer — stores go straight to memory'}</div>
          </div>
        ))}
        <div className="tso-mem">shared memory<br /><span>x, y</span></div>
      </div>

      <div className="tso-out">
        <div className="tso-out-h">Reachable outcomes (all interleavings{model === 'TSO' ? ' + buffer drains' : ''})</div>
        <table className="tso-matrix">
          <thead><tr><th></th><th>r1 = 0</th><th>r1 = 1</th></tr></thead>
          <tbody>
            {[0, 1].map((r0) => (
              <tr key={r0}>
                <th>r0 = {r0}</th>
                {[0, 1].map((r1) => {
                  const ok = reachable(r0, r1);
                  const weak = r0 === 0 && r1 === 0;
                  return (
                    <td key={r1} className={`${ok ? 'reach' : 'no'} ${weak && ok ? 'weak' : ''}`}>
                      {ok ? '✓ reachable' : '✗ impossible'}
                      {weak && <span className="tso-weak-lbl">both read stale</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={`tso-verdict ${weakAllowed ? 'bad' : 'good'}`}>
        {model === 'SC'
          ? 'Under Sequential Consistency every operation is globally ordered, so at least one store precedes the other core’s load — r0=r1=0 can never happen.'
          : fenced
            ? 'The MFENCE drains each core’s store buffer before its load, so the load can’t overtake the store — r0=r1=0 is forbidden again, at the cost of a pipeline stall.'
            : 'On x86-TSO each core’s store sits in a private buffer while its load reads the other variable straight from memory (still 0). Both buffers drain afterwards — so r0=r1=0 really is observable on real hardware.'}
      </div>

      <p className="tso-foot">
        x86-TSO is <strong>not</strong> sequentially consistent: the only reordering it permits is a later load passing an earlier store to a
        <em> different</em> address (the store sits in the buffer). It still keeps each core’s stores in order and forwards a core’s own buffered
        writes to its later loads — which is why message-passing (write data, then a flag) is safe without a fence, but the store-buffer pattern
        is not. The fix is a <strong>store-load barrier</strong> (MFENCE, or a LOCKed instruction); higher-level locks and C++/Java atomics insert
        it for you. This is exactly the class of bug that lock-free code lives and dies by. Enumerated exhaustively — every reachable state, no sampling.
      </p>
    </div>
  );
}
