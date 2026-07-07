// Port knocking — open a hidden service with a secret sequence. The firewall drops everything; a daemon opens SSH
// only after it sees the exact ordered knock sequence. Click the ports in order to open the door; a wrong knock
// resets your progress. Then run a blind attacker scan and watch it never stumble on the sequence — the obscurity
// works against scanning, though a sniffer could still replay the knocks. Real state machine + tests in portknock.ts.
import { useState } from 'react';
import { knock, type KnockState } from './portknock';

const SECRET = [7000, 8000, 9000];
const PORTS = [7000, 3000, 8000, 5000, 9000]; // shuffled — you must pick the right ones in the right order
const SCAN = [22, 3389, 8000, 443, 9000, 7000, 5000, 3000, 80, 9000]; // a blind sweep that never completes the sequence

type Entry = { port: number; matched: boolean };

export function PortKnockSection() {
  const [state, setState] = useState<KnockState>({ progress: 0, opened: false });
  const [log, setLog] = useState<Entry[]>([]);
  const [scanned, setScanned] = useState(false);

  const doKnock = (port: number) => {
    if (state.opened) return;
    const matched = port === SECRET[state.progress];
    setState((s) => knock(s, port, SECRET));
    setLog((l) => [...l.slice(-9), { port, matched }]);
  };
  const reset = () => { setState({ progress: 0, opened: false }); setLog([]); setScanned(false); };
  const runScan = () => {
    let s: KnockState = { progress: 0, opened: false };
    const entries: Entry[] = [];
    for (const p of SCAN) { entries.push({ port: p, matched: p === SECRET[s.progress] }); s = knock(s, p, SECRET); }
    setState(s); setLog(entries.slice(-10)); setScanned(true);
  };

  return (
    <div className="knk">
      <div className="knk-combo">
        <span className="knk-lbl">secret knock — the combination the daemon is waiting for</span>
        <div className="knk-seq">
          {SECRET.map((p, i) => (
            <span key={p} className="knk-step">
              {i > 0 && <span className="knk-arrow">→</span>}
              <code className={i < state.progress ? 'knk-done' : ''}>{p}</code>
            </span>
          ))}
        </div>
      </div>

      <div className={`knk-door ${state.opened ? 'knk-open' : 'knk-closed'}`}>
        <span className="knk-lock">{state.opened ? '🔓' : '🔒'}</span>
        <div className="knk-door-txt">
          <strong>SSH (port 22) — {state.opened ? 'OPEN' : 'closed'}</strong>
          <span>{state.opened
            ? 'The full sequence arrived from your address — the daemon opened the port, just for you.'
            : scanned
              ? 'A blind scan hit lots of ports but never the exact sequence in order. Nothing to see.'
              : `waiting for the sequence · matched ${state.progress} of ${SECRET.length}`}</span>
        </div>
      </div>

      <div className="knk-ports">
        {PORTS.map((p) => (
          <button type="button" key={p} className="knk-knock" onClick={() => doKnock(p)} disabled={state.opened}>knock&nbsp;{p}</button>
        ))}
      </div>

      <div className="knk-log">
        <span className="knk-lbl">firewall log — connection attempts (all to closed ports)</span>
        <div className="knk-log-row">
          {log.length === 0 && <span className="knk-empty">no knocks yet</span>}
          {log.map((e, i) => (
            <code key={i} className={`knk-hit ${e.matched ? 'knk-good' : 'knk-bad'}`}>:{e.port}</code>
          ))}
        </div>
      </div>

      <div className="knk-controls">
        <button type="button" className="knk-btn" onClick={reset}>↺ reset</button>
        <button type="button" className="knk-btn" onClick={runScan} disabled={state.opened}>▶ run an attacker port scan</button>
      </div>

      <p className="knk-foot">
        A scanner sees only closed ports, and the sequence space is enormous (three ports out of 65,535, in order, is
        ~<code>2.8×10¹⁴</code>) — so blind scanning gets nowhere, and the service is invisible until you knock. But port
        knocking is <strong>obscurity, not authentication</strong>: the knocks cross the network in the clear, so anyone
        who can <strong>sniff</strong> them can replay the sequence, and a man-in-the-middle can ride the freshly-opened
        port. The cryptographic successor, <strong>single-packet authorization</strong> (fwknop), replaces the sequence
        with one signed, encrypted, replay-protected packet — same “invisible until authorized” idea, done properly.
        (knockd / fwknop.)
      </p>
    </div>
  );
}
