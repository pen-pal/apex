// The "view source" panel shown under each section — the actual tested TypeScript model that drives the
// visualization, loaded on demand. Lets an expert read the real logic, copy it, and reuse it. Line count and a
// copy button; collapsed by default so it never gets in the way.
import { useEffect, useRef, useState } from 'react';
import { hasSource, loadSource, sourceName } from './sources';

export function CodePanel({ id }: { id: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => { setSrc(null); setCopied(false); if (ref.current) ref.current.open = false; }, [id]);

  if (!hasSource(id)) return null;

  const onToggle = (e: React.SyntheticEvent<HTMLDetailsElement>) => {
    if (e.currentTarget.open && src === null) loadSource(id)?.then(setSrc);
  };
  const copy = () => { if (src) { navigator.clipboard?.writeText(src).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); } };

  return (
    <details ref={ref} className="codepanel" onToggle={onToggle}>
      <summary className="codepanel-sum">
        <span className="codepanel-icon">◆</span> View the tested source — <code>{sourceName(id)}</code>
        <span className="codepanel-hint">the real model behind this visualization; every value is verified, not faked</span>
      </summary>
      <div className="codepanel-body">
        {src === null ? <div className="codepanel-loading">loading…</div> : (
          <>
            <div className="codepanel-bar"><span>{src.split('\n').length} lines · tested in {sourceName(id).replace('.ts', '')}.test.ts</span><button type="button" className="codepanel-copy" onClick={copy}>{copied ? '✓ copied' : 'copy'}</button></div>
            <pre className="codepanel-pre"><code>{src}</code></pre>
          </>
        )}
      </div>
    </details>
  );
}
