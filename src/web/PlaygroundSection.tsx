// The playground — edit JavaScript and run it for real, offline, sandboxed in a Web Worker (see playground.ts). Output
// is the actual console + return value, with a timeout. The other four languages stay read-only verified examples in
// each section's "In other languages" panel, because Apex has no backend to run them.
import { useState } from 'react';
import { runJs, type RunResult } from './playground';

const STARTERS: { label: string; code: string }[] = [
  {
    label: 'Kadane (max subarray)',
    code: `// Maximum sum of any contiguous subarray, in one pass.
function maxSubarray(a) {
  let best = a[0], cur = a[0];
  for (const x of a.slice(1)) {
    cur = Math.max(x, cur + x);   // extend the run, or start fresh
    best = Math.max(best, cur);
  }
  return best;
}
console.log(maxSubarray([-2, 1, -3, 4, -1, 2, 1, -5, 4])); // 6`,
  },
  {
    label: 'UTF-8 bytes',
    code: `// How text becomes bytes — the same real encoding Apex visualizes.
const bytes = [...new TextEncoder().encode("héllo")];
console.log(bytes.map(b => b.toString(16).padStart(2, "0")).join(" "));
// 'é' is two bytes (c3 a9) — UTF-8 is variable-width
bytes.length;`,
  },
  {
    label: 'Recursion (Fibonacci)',
    code: `const fib = n => (n < 2 ? n : fib(n - 1) + fib(n - 2));
console.log(Array.from({ length: 10 }, (_, i) => fib(i)));
fib(20);`,
  },
];

export function PlaygroundSection() {
  const [code, setCode] = useState(STARTERS[0].code);
  const [res, setRes] = useState<RunResult | null>(null);
  const [running, setRunning] = useState(false);

  const run = async () => {
    setRunning(true);
    setRes(await runJs(code, 2000));
    setRunning(false);
  };
  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); void run(); return; }
    if (e.key === 'Tab') { // insert two spaces instead of leaving the field
      e.preventDefault();
      const t = e.currentTarget, s = t.selectionStart, en = t.selectionEnd;
      const next = code.slice(0, s) + '  ' + code.slice(en);
      setCode(next);
      requestAnimationFrame(() => { t.selectionStart = t.selectionEnd = s + 2; });
    }
  };

  return (
    <div className="pg">
      <p className="pg-note">
        <strong>JavaScript runs here, for real</strong> — offline, in a sandboxed Web Worker in your browser, with a 2-second
        timeout. Nothing is sent anywhere. The Go / Python / Rust / C / C++ versions of an idea are read-only, compiler-verified
        examples in each section’s <em>“In other languages”</em> panel — Apex has no backend to run those.
      </p>

      <div className="pg-starters">
        <span className="pg-starters-lbl">load:</span>
        {STARTERS.map((s) => (
          <button key={s.label} type="button" onClick={() => { setCode(s.code); setRes(null); }}>{s.label}</button>
        ))}
      </div>

      <textarea className="pg-editor" value={code} spellCheck={false} onChange={(e) => setCode(e.target.value)} onKeyDown={onKey} rows={14} aria-label="JavaScript code" />

      <div className="pg-bar">
        <button type="button" className="pg-run" onClick={run} disabled={running}>{running ? 'running…' : '▶ run'}</button>
        <span className="pg-hint">⌘/Ctrl + Enter</span>
        {res && <span className="pg-ms">{res.ms} ms</span>}
      </div>

      {res && (
        <div className="pg-out">
          {res.logs.length > 0 && <pre className="pg-logs">{res.logs.join('\n')}</pre>}
          {res.result !== undefined && <div className="pg-result"><span className="pg-result-lbl">⇒</span> <code>{res.result}</code></div>}
          {res.error !== undefined && <div className="pg-error">✗ {res.error}</div>}
          {res.logs.length === 0 && res.result === undefined && res.error === undefined && <div className="pg-empty">(no output — nothing was logged and the last expression was undefined)</div>}
        </div>
      )}

      <p className="pg-foot">
        This is the whole no-backend idea, turned on itself: a Web Worker is a separate thread with no access to the page’s
        DOM, so your code runs isolated and the tab stays responsive even if you write an infinite loop (the timeout kills
        it). The same discipline is why Apex ships as one static bundle — everything you see, including this, runs on your
        machine. Try the <em>UTF-8 bytes</em> starter to see the exact encoding the protocol views are built on.
      </p>
    </div>
  );
}
