// eBPF & the verifier, made visible. You're writing an XDP program that drops a DDoS flood at the NIC. Toggle the
// program's properties and watch the kernel's static verifier accept it (loaded — the flood is dropped) or reject it
// with the exact reason (in which case the filter never loads and the flood gets through). Model + tests in ebpf.ts.
import { useMemo, useState } from 'react';
import { verify, runXdp, score, DEFAULT_PACKETS, type Program } from './ebpf';

const CHECKS: { key: keyof Program; label: string; unsafe: string }[] = [
  { key: 'boundedLoop', label: 'loop has a compile-time bound', unsafe: 'unbounded loop' },
  { key: 'checksBounds', label: 'checks data_end before reading the packet', unsafe: 'reads past the packet' },
  { key: 'smallEnough', label: 'within the instruction / complexity limit', unsafe: 'too large to verify' },
  { key: 'safeHelpers', label: 'calls only helpers allowed for XDP', unsafe: 'disallowed helper' },
];

export function EbpfSection() {
  const [prog, setProg] = useState<Program>({ boundedLoop: true, checksBounds: true, smallEnough: true, safeHelpers: true });
  const packets = useMemo(() => DEFAULT_PACKETS(), []);
  const verdict = useMemo(() => verify(prog), [prog]);
  const results = useMemo(() => runXdp(verdict.loaded, packets), [verdict.loaded, packets]);
  const sc = useMemo(() => score(results), [results]);
  const flip = (k: keyof Program) => setProg((p) => ({ ...p, [k]: !p[k] }));

  return (
    <div className="ebpf">
      <div className="ebpf-prog">
        <div className="ebpf-lbl">your XDP program — the verifier checks each property before it can load</div>
        <div className="ebpf-checks">
          {CHECKS.map((c) => (
            <button key={c.key} type="button" className={`ebpf-check ${prog[c.key] ? 'ok' : 'bad'}`} onClick={() => flip(c.key)}>
              <span className="ebpf-check-mark">{prog[c.key] ? '✓' : '✗'}</span>
              <span className="ebpf-check-txt">{prog[c.key] ? c.label : c.unsafe}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={`ebpf-verdict ${verdict.loaded ? 'ebpf-loaded' : 'ebpf-rejected'}`}>
        <b>{verdict.loaded ? '✓ VERIFIED → loaded' : '✗ VERIFIER REJECTED'}</b> — {verdict.reason}
      </div>

      <div className="ebpf-hook">
        <div className="ebpf-lbl">packets hitting the NIC → the XDP program runs before the kernel stack</div>
        <div className="ebpf-flow">
          {results.map((r) => (
            <div key={r.packet.id} className={`ebpf-pkt ${r.action === 'DROP' ? 'ebpf-drop' : r.packet.flood ? 'ebpf-flood-pass' : 'ebpf-legit'}`}>
              <code>{r.packet.src}</code>
              <span className="ebpf-pkt-act">{r.action}</span>
            </div>
          ))}
        </div>
        <div className="ebpf-score">
          <span><b className="ebpf-n-drop">{sc.dropped}</b> flood dropped</span>
          <span><b className={sc.floodThrough ? 'ebpf-n-bad' : 'ebpf-n-ok'}>{sc.floodThrough}</b> flood reached the stack</span>
          <span><b className="ebpf-n-ok">{sc.legitPassed}</b> legit served</span>
        </div>
      </div>

      <p className="ebpf-foot">
        eBPF is the kernel’s sanctioned way to run <em>your</em> code in kernel space — attached to <strong>XDP</strong>
        (the earliest point on the NIC, before an skb even exists — how you drop millions of DDoS packets per second),
        to <strong>kprobes</strong> (trace any function, the basis of <code>bcc</code>/<code>bpftrace</code>), or to
        <strong> LSM</strong> hooks (security policy). Loading untrusted code into the kernel is only sane because of the
        <strong> verifier</strong>: a static analyzer that walks every path and proves the program halts, never touches
        memory out of bounds, and stays within a complexity budget — the same discipline as seccomp and capabilities,
        one level deeper. That safety is also its cage: no unbounded loops, a size ceiling, and only the helper calls
        your program type allows. Reject one check and the program simply never runs — which is why the filter above
        stops protecting you the moment it stops verifying. (Linux eBPF / XDP.)
      </p>
    </div>
  );
}
