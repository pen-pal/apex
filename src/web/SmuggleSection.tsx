// HTTP request smuggling, made visible. The SAME raw bytes are handed to a front-end proxy and a
// back-end server; pick CL.TE or TE.CL and watch the two parsers draw the request boundary in
// different places. The bytes between the two boundaries — highlighted — are smuggled: the back-end
// treats them as the beginning of the NEXT request, which becomes a prefix on the next victim's
// traffic. All boundaries computed by smuggle.ts (tested against RFC 9112 framing).
import { useMemo, useState } from 'react';
import { desync, buildCLTE, buildTECL } from './smuggle';

type Attack = 'CL.TE' | 'TE.CL';

// render a byte string with CRLFs made visible
function Vis({ text }: { text: string }) {
  return <>{text.split('\r\n').map((seg, i, a) => <span key={i}>{seg}{i < a.length - 1 && <span className="smug-crlf">␍␊{'\n'}</span>}</span>)}</>;
}

export function SmuggleSection() {
  const [attack, setAttack] = useState<Attack>('CL.TE');
  const raw = useMemo(() => (attack === 'CL.TE' ? buildCLTE() : buildTECL()), [attack]);
  const front: 'CL' | 'TE' = attack === 'CL.TE' ? 'CL' : 'TE';
  const back: 'CL' | 'TE' = attack === 'CL.TE' ? 'TE' : 'CL';
  const d = useMemo(() => desync(raw, front, back), [raw, front, back]);

  const pre = raw.slice(0, d.smuggledStart);
  const mid = raw.slice(d.smuggledStart, d.smuggledEnd);
  const post = raw.slice(d.smuggledEnd);

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>HTTP request smuggling — when two parsers disagree</h2></div>
        <p className="jsec-sub">
          An HTTP/1.1 body can be delimited two ways: <strong>Content-Length</strong> (a byte count) or <strong>Transfer-Encoding: chunked</strong>
          (size-prefixed chunks ending in a <code>0</code>-chunk). If a request carries <em>both</em>, <strong>RFC 9112 §6.1</strong> says
          Transfer-Encoding wins and Content-Length must be ignored. When a front-end proxy and the back-end server choose <strong>differently</strong>,
          they split the same bytes at different offsets — and the leftover gets glued onto the next victim’s request.
        </p>

        <div className="smug-tabs">
          <button className={attack === 'CL.TE' ? 'on' : ''} onClick={() => setAttack('CL.TE')}>CL.TE</button>
          <button className={attack === 'TE.CL' ? 'on' : ''} onClick={() => setAttack('TE.CL')}>TE.CL</button>
          <span className="smug-tabnote">front-end uses <b>{front === 'CL' ? 'Content-Length' : 'chunked'}</b>, back-end uses <b>{back === 'CL' ? 'Content-Length' : 'chunked'}</b></span>
        </div>

        <div className="smug-parsers">
          <div className="smug-parser"><span className="smug-plbl">front-end ({front})</span><span className="smug-pval">{d.front.note}</span><span className="smug-pcons">stops at byte {d.front.consumed}</span></div>
          <div className="smug-parser back"><span className="smug-plbl">back-end ({back})</span><span className="smug-pval">{d.back.note}</span><span className="smug-pcons">stops at byte {d.back.consumed}</span></div>
        </div>

        <div className="smug-rawwrap">
          <div className="smug-rawlbl">the raw request both servers receive (␍␊ = CRLF):</div>
          <pre className="smug-raw"><Vis text={pre} /><mark className="smug-mark"><Vis text={mid} /></mark><Vis text={post} /></pre>
        </div>

        <div className="smug-explain">
          <p>
            The front-end forwards all <b>{d.front.consumed}</b> bytes as one request. The back-end’s parser stops after <b>{d.back.consumed}</b>,
            so the <b className="smug-hl">{d.smuggledEnd - d.smuggledStart}</b> highlighted bytes are left in its buffer — and prepended to whatever
            request arrives next:
          </p>
          <pre className="smug-next"><mark className="smug-mark"><Vis text={d.smuggled} /></mark><span className="smug-victim">…GET /home HTTP/1.1␍␊Host: victim.example␍␊…  ← next victim’s request, now hijacked</span></pre>
        </div>

        <p className="smug-foot">
          The fix is to refuse the ambiguity, not to parse it cleverly: a server that sees both headers should reject the message (RFC 9112 §6.1),
          and front-end and back-end must agree on framing — which is exactly why HTTP/2’s single, length-delimited binary framing kills this whole
          bug class (each stream’s length is unambiguous). Smuggling is how attackers bypass front-end access controls, poison shared caches, and
          capture other users’ requests; PortSwigger’s “HTTP Desync Attacks” research catalogued CL.TE, TE.CL, and TE.TE variants in the wild.
        </p>
      </section>
    </div>
  );
}
