// ReDoS, made visible. Pick a pattern and drag the input length; the input is n 'a's plus one character that
// can't match, so the engine must try every way to split the a's among the nested quantifiers before failing.
// For an evil pattern the step count — and the little curve — explode exponentially; for a safe one it stays
// a flat line. The kicker: the evil pattern is FAST when the input fully matches; catastrophe needs a
// near-miss, which is exactly what an attacker sends. Real backtracking matcher from redos.ts.
import { useMemo, useState } from 'react';
import { run, PATTERNS } from './redos';

const LIMIT = 5_000_000;
const STEPS_PER_SEC = 1e7; // rough backtracking-engine throughput, for a time estimate

function humanTime(steps: number): string {
  const s = steps / STEPS_PER_SEC;
  if (s < 1e-3) return '<1ms';
  if (s < 1) return `${Math.round(s * 1000)}ms`;
  if (s < 60) return `${s.toFixed(1)}s`;
  if (s < 3600) return `${(s / 60).toFixed(1)} min`;
  return `${(s / 3600).toFixed(1)} hours`;
}

export function RedosSection() {
  const [pid, setPid] = useState('evilPlus');
  const [n, setN] = useState(16);
  const pat = PATTERNS[pid];

  const input = 'a'.repeat(n) + '!';
  const res = useMemo(() => run(pat.node, input, LIMIT), [pid, n]);
  const matchRes = useMemo(() => run(pat.node, 'a'.repeat(n), LIMIT), [pid, n]); // fully-matching input

  const curve = useMemo(
    () => Array.from({ length: 12 }, (_, i) => { const k = 2 + i * 2; return { n: k, steps: run(pat.node, 'a'.repeat(k) + '!', LIMIT).steps }; }),
    [pid],
  );
  const maxLog = Math.log2(Math.max(...curve.map((c) => c.steps), 2));

  return (
    <div className="rds">
      <p className="rds-intro">
        A classic backtracking regex engine, faced with nested quantifiers like <code>(a+)+</code> and an input
        that <strong>almost</strong> matches, tries <strong>every</strong> way to divide the input among the
        quantifiers before giving up — and the number of ways is <strong>exponential</strong> in the length. A
        30-character string can take seconds; 40, hours. One crafted request pins a CPU (it took down Cloudflare
        in 2019).
      </p>

      <div className="rds-patterns">
        {Object.entries(PATTERNS).map(([id, p]) => (
          <button key={id} type="button" className={`rds-pbtn ${pid === id ? 'on' : ''} ${p.evil ? 'evil' : 'safe'}`} onClick={() => setPid(id)}>
            <code>{p.label}</code><span>{p.evil ? 'nested quantifier' : 'linear'}</span>
          </button>
        ))}
      </div>

      <div className="rds-input">
        <label>input length <input type="range" min={2} max={26} value={n} onChange={(e) => setN(+e.target.value)} /><b>{n}</b></label>
        <code className="rds-str">{'a'.repeat(Math.min(n, 20))}{n > 20 ? '…' : ''}<span className="rds-fail">!</span></code>
        <span className="rds-strnote">n a's + one non-matching char (the near-miss)</span>
      </div>

      <div className="rds-result">
        <div className={`rds-steps ${res.blownUp ? 'blown' : pat.evil && res.steps > 5000 ? 'warn' : 'ok'}`}>
          <span className="rds-slbl">backtracking steps</span>
          <b>{res.blownUp ? `> ${LIMIT.toLocaleString()}` : res.steps.toLocaleString()}</b>
          <span className="rds-time">≈ {res.blownUp ? 'seconds → hours' : humanTime(res.steps)} to fail</span>
        </div>
        <div className="rds-vs">
          <div className="rds-vsrow"><span>this input (near-miss)</span><b className={pat.evil ? 'bad' : ''}>{res.blownUp ? 'blows up' : res.steps.toLocaleString()}</b></div>
          <div className="rds-vsrow"><span>same length, fully matches</span><b className="good">{matchRes.steps.toLocaleString()}</b></div>
        </div>
      </div>

      <div className="rds-curve">
        <div className="rds-ch">steps vs input length (log scale)</div>
        <div className="rds-bars">
          {curve.map((c) => (
            <div key={c.n} className={`rds-bar ${c.n === n ? 'cur' : ''}`} title={`n=${c.n}: ${c.steps.toLocaleString()} steps`}>
              <div className={`rds-barfill ${pat.evil ? 'evil' : 'safe'}`} style={{ height: `${(Math.log2(c.steps) / maxLog) * 100}%` }} />
              <span className="rds-bn">{c.n}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="rds-foot">
        Two things make it catastrophic: the pattern is <strong>ambiguous</strong> (many ways to match the same
        text — <code>(a+)+</code> can split "aaa" as 3, 2+1, 1+2, 1+1+1…) and the engine <strong>backtracks</strong>
        (tries them one by one). The real fix is to not use a backtracking engine: <strong>RE2</strong>,
        Rust's <code>regex</code>, and Go's <code>regexp</code> compile to an automaton that runs in
        <strong> linear time, guaranteed</strong> — no catastrophic case exists. Failing that: avoid nested
        quantifiers and overlapping alternations, bound input length, add a match timeout, and never run a
        user-supplied regex on a shared thread. PCRE/JS/Java/Python all use backtracking and are all
        vulnerable. (Russ Cox, "Regular Expression Matching Can Be Simple And Fast"; OWASP ReDoS.)
      </p>
    </div>
  );
}
