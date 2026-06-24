// SCTP multi-homing, made visible. An association binds two paths between client and server; fire
// timeouts on a path and watch SCTP fail over to the alternate instead of dying the way a TCP
// connection would. Then see the 4-way cookie handshake that lets the server stay stateless until
// the client proves itself. All logic in sctp.ts (tested against RFC 9260 §8 / §5.1).
import { useMemo, useState } from 'react';
import { runAssoc, handshake, type SctpConfig, type SctpEvent, type SctpStep } from './sctp';

const PMR = 3, AMR = 6;
const CFG: SctpConfig = {
  paths: [{ id: 'A', addr: '203.0.113.1' }, { id: 'B', addr: '198.51.100.1' }],
  pathMaxRetrans: PMR,
  assocMaxRetrans: AMR,
};
const INIT: SctpStep = {
  n: 0, event: 'init', desc: 'Association ESTABLISHED across two paths. A is primary; B is the hot standby.',
  current: 'A', states: CFG.paths.map((p) => ({ id: p.id, addr: p.addr, errors: 0, active: true })),
  assocErrors: 0, assoc: 'ESTABLISHED', failedOver: false,
};
const HS = handshake();

const PRESETS: { label: string; evs: SctpEvent[] }[] = [
  { label: 'Primary path fails → failover', evs: Array(4).fill(0).map(() => ({ type: 'timeout', path: 'A' })) },
  { label: 'Fail over, then primary recovers', evs: [...Array(4).fill({ type: 'timeout', path: 'A' }), { type: 'ack', path: 'A' }] as SctpEvent[] },
  { label: 'Total outage → association down', evs: [...Array(4).fill({ type: 'timeout', path: 'A' }), ...Array(3).fill({ type: 'timeout', path: 'B' })] as SctpEvent[] },
];

export function SctpSection() {
  const [evs, setEvs] = useState<SctpEvent[]>([]);
  const run = useMemo(() => runAssoc(CFG, evs), [evs]);
  const step = run.steps.length ? run.steps[run.steps.length - 1] : INIT;
  const add = (e: SctpEvent) => setEvs((x) => [...x, e]);

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>SCTP multi-homing — the transport that survives a dead path</h2></div>
        <p className="jsec-sub">
          A TCP connection is welded to one (source IP, destination IP) pair: if that path goes down, the connection dies and the app must
          reconnect. An <strong>SCTP association</strong> binds <strong>several</strong> addresses on each end. It sends on a primary path,
          probes the others with HEARTBEATs, and on repeated failures marks a path <strong>inactive</strong> and <strong>fails over</strong>
          to an alternate — the association lives on. Fire timeouts below and watch it happen (Path.Max.Retrans = {PMR}, Association.Max.Retrans = {AMR};
          RFC defaults are 5 and 10).
        </p>

        <div className={`sctp-diagram ${step.assoc === 'DOWN' ? 'down' : ''}`}>
          <div className="sctp-end">client</div>
          <div className="sctp-paths">
            {step.states.map((p) => {
              const isCur = step.current === p.id;
              return (
                <div key={p.id} className={`sctp-path ${p.active ? 'active' : 'inactive'} ${isCur ? 'current' : ''}`}>
                  <span className="sctp-pid">path {p.id} <span className="sctp-addr">{p.addr}</span></span>
                  <span className="sctp-line"><span className="sctp-dot" /></span>
                  <span className="sctp-pstate">
                    {isCur && <span className="sctp-badge cur">in use</span>}
                    {!p.active && <span className="sctp-badge dead">inactive</span>}
                    <span className="sctp-err" title="path error counter">err {p.errors}/{PMR}</span>
                  </span>
                </div>
              );
            })}
          </div>
          <div className="sctp-end">server</div>
        </div>

        <div className="sctp-assoc">
          <span className={`sctp-astate ${step.assoc === 'DOWN' ? 'down' : 'up'}`}>association {step.assoc}</span>
          <span className="sctp-acount">assoc errors {step.assocErrors}/{AMR}</span>
          <span className="sctp-fo">{run.failovers} failover{run.failovers === 1 ? '' : 's'}</span>
        </div>

        <div className="sctp-controls">
          <button className="sctp-btn t" onClick={() => add({ type: 'timeout', path: 'A' })}>⌁ Timeout A</button>
          <button className="sctp-btn t" onClick={() => add({ type: 'timeout', path: 'B' })}>⌁ Timeout B</button>
          <button className="sctp-btn k" onClick={() => add({ type: 'ack', path: 'A' })}>✓ ACK A</button>
          <button className="sctp-btn k" onClick={() => add({ type: 'ack', path: 'B' })}>✓ ACK B</button>
          <button className="sctp-btn r" onClick={() => setEvs([])}>↺ Reset</button>
          <span className="sctp-presetlbl">scenarios:</span>
          {PRESETS.map((p) => <button key={p.label} className="sctp-chip" onClick={() => setEvs(p.evs)}>{p.label}</button>)}
        </div>

        {step.desc && <div className={`sctp-now ${step.failedOver ? 'fo' : ''} ${step.assoc === 'DOWN' ? 'down' : ''}`}>{step.desc}</div>}

        {run.steps.length > 0 && (
          <ol className="sctp-log">
            {run.steps.map((s) => (
              <li key={s.n} className={`${s.failedOver ? 'fo' : ''} ${s.assoc === 'DOWN' ? 'down' : ''}`}>{s.desc}</li>
            ))}
          </ol>
        )}

        <div className="sctp-hs">
          <h3>How it opens: the 4-way cookie handshake</h3>
          <p className="sctp-hsub">
            TCP allocates connection state the moment a SYN arrives — which is what makes SYN floods work. SCTP refuses to: the server packs all
            its setup state into a signed <strong>cookie</strong> and holds nothing until the client echoes it back, proving it can receive at its
            address. A flood of INITs costs the server nothing.
          </p>
          <div className="sctp-seq">
            {HS.map((c) => (
              <div key={c.n} className={`sctp-msg ${c.from}`}>
                <div className="sctp-msghead"><span className="sctp-chunk">{c.chunk}</span><span className="sctp-dir">{c.from === 'client' ? 'client → server' : 'server → client'}</span></div>
                <div className="sctp-carries">{c.carries}</div>
                <div className="sctp-mnote">{c.note}</div>
              </div>
            ))}
          </div>
        </div>

        <p className="sctp-foot">
          Multi-homing is SCTP’s headline feature and the one TCP simply cannot match: failover happens inside the transport, invisibly to the
          application, with no reconnect and no lost association. It’s why SCTP carries telephony signalling (SIGTRAN / SS7-over-IP) where a dropped
          path is unacceptable. The same instinct — survive a path change without tearing down — reappears in QUIC’s connection migration, which
          keeps a connection alive across IP changes using connection IDs instead of the 4-tuple.
        </p>
      </section>
    </div>
  );
}
