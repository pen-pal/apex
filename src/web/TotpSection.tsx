// Guided story: how the 6-digit 2FA code in your authenticator app works (TOTP, RFC 6238 / HOTP, RFC 4226). The app
// and the server share one secret (the QR code); from then on both independently compute HMAC(secret, 30-second time
// step) and reduce it to 6 digits — same secret + same time → same code, offline, changing every 30 s. Real HMAC-SHA1
// built on the project's synchronous sha1(), and real dynamic truncation (verified against the RFC 4226 test vectors:
// counter 0 → 755224). Sandboxed/CONCEPTUAL. Defenses-forward: notes it's a shared secret and phishable (→ passkeys).
import { useState } from 'react';
import { sha1 } from './sha1';
import { GuidedStory, type StoryScene } from './GuidedStory';

const SECRET = new TextEncoder().encode('12345678901234567890'); // the RFC 4226 test key, so codes are checkable
const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0'));
function concat(a: Uint8Array, b: Uint8Array) { const r = new Uint8Array(a.length + b.length); r.set(a); r.set(b, a.length); return r; }
function hmacSha1(key: Uint8Array, msg: Uint8Array): Uint8Array {
  const BS = 64; let k = key.length > BS ? sha1(key) : key; const kp = new Uint8Array(BS); kp.set(k);
  const ipad = new Uint8Array(BS), opad = new Uint8Array(BS);
  for (let i = 0; i < BS; i++) { ipad[i] = kp[i] ^ 0x36; opad[i] = kp[i] ^ 0x5c; }
  return sha1(concat(opad, sha1(concat(ipad, msg))));
}
function ctrBytes(c: number): Uint8Array { const b = new Uint8Array(8); let n = c; for (let i = 7; i >= 0; i--) { b[i] = n & 0xff; n = Math.floor(n / 256); } return b; }
function hotp(counter: number) {
  const h = hmacSha1(SECRET, ctrBytes(counter));
  const off = h[19] & 0xf;
  const bin = ((h[off] & 0x7f) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3];
  return { code: String(bin % 1000000).padStart(6, '0'), h, off, bin };
}

const BASE = 1_700_000_000; // a fixed epoch so scrubbing time is deterministic

type Phase = 'shared' | 'compute' | 'truncate' | 'window' | 'limits' | 'run';

export function TotpSection() {
  const [offsetSec, setOffsetSec] = useState(8);
  const time = BASE + offsetSec;
  const counter = Math.floor(time / 30);
  const left = 30 - (time % 30);

  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string, t: number): StoryScene =>
    ({ key, title, caption, render: () => <Totp phase={key} time={t} /> });

  const scenes: StoryScene[] = [
    scene('shared', 'One shared secret, then silence', 'When you scan the QR code to set up an authenticator, your phone and the server agree on one secret. After that, they never talk again — no code is ever sent over the network. Yet both produce the same 6-digit number, and it changes every 30 seconds. How?', BASE + 8),
    scene('compute', 'Code = HMAC(secret, time)', 'Both sides do the identical thing: take the current time chopped into 30-second steps as a counter, and compute HMAC-SHA1 of that counter under the shared secret. Same secret, same time step → the same 20-byte HMAC, computed independently on each side, entirely offline.', BASE + 8),
    scene('truncate', 'Dynamic truncation → 6 digits', 'You can’t type 20 bytes, so reduce it: the last nibble of the HMAC picks a 4-byte offset into it; read those 4 bytes, mask the top bit, and take the value mod 1,000,000. That’s a 6-digit code — fully deterministic, not random. (This is HOTP, RFC 4226; the RFC’s own test key gives 755224 at counter 0.)', BASE + 8),
    scene('window', 'A new code every 30 seconds', 'Because the counter is floor(time / 30), the code holds steady for 30 seconds, then flips to a new one. That’s the little countdown ring in the app. The server checks the current window and the one on each side, so a slightly wrong clock still verifies. Scrub time and watch the code change at each boundary.', BASE + 52),
    scene('limits', 'Strong, but a shared secret', 'This proves you hold the secret without ever sending it, and a stolen code is useless within seconds. But two weaknesses remain: it’s a shared secret, so a breach of the server leaks it — and it’s phishable, since you can be tricked into typing a live code into a fake site. That’s exactly why WebAuthn/passkeys, which sign a per-site challenge with a key that never leaves your device, are replacing it.', BASE + 8),
    { key: 'run', title: 'Scrub time, watch it tick', caption: 'Move time forward and watch the counter, the HMAC, and the 6-digit code recompute — and flip to a fresh code each time you cross a 30-second boundary. The offset byte that selects the 4 truncation bytes is highlighted. Both your phone and the server are running exactly this, in lockstep, without exchanging a thing.', render: () => <Totp phase="run" time={time} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <>When you set up an authenticator app, you and the server share one secret (that’s what the QR code carries). From then on no messages pass between you — yet your phone and the server independently produce the same 6-digit code, changing every 30 seconds. The code is just <code>HMAC(shared secret, current 30-second time step)</code> reduced to six digits: same secret, same time, same code, computed offline on both sides.</>,
        takeaway: <>Each side takes Unix time divided into 30-second steps as a counter, computes <strong>HMAC-SHA1</strong> of that counter under the shared secret, then <em>dynamically truncates</em> the 20-byte result: the last nibble picks a 4-byte offset, the top bit is masked off, and the value mod 1,000,000 gives six digits (this is HOTP, RFC 4226; TOTP, RFC 6238, is just HOTP with time as the counter — verified here against the RFC’s test vectors). Because the counter is <code>floor(time/30)</code>, the code is stable for 30 seconds then flips, and the server accepts the neighbouring windows to tolerate clock skew. It proves you hold the secret without transmitting it, and a stolen code expires in seconds — but it is a <strong>shared secret</strong> (a server breach leaks it) and it is <strong>phishable</strong> (you can be tricked into typing it into a fake site), which is exactly why WebAuthn/passkeys, which sign a per-site challenge with a key that never leaves your device, are replacing it.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <>
          <label className="otp-ctl">time +<input type="range" min={0} max={89} value={offsetSec} onChange={(e) => setOffsetSec(+e.target.value)} /><b>{offsetSec}s</b></label>
          <span className="otp-live">counter {counter} · code {hotp(counter).code} · {left}s left</span>
        </>
      )}
    />
  );
}

function Totp({ phase, time }: { phase: Phase; time: number }) {
  const on = (p: Phase) => phase === p;
  const counter = Math.floor(time / 30);
  const { code, h, off } = hotp(counter);
  const left = 30 - (time % 30);
  const bytes = hex(h);
  return (
    <svg viewBox="0 0 900 480" className="story-svg">
      {/* shared secret + two parties */}
      <rect x="330" y="40" width="240" height="40" rx="8" className="otp-secret" />
      <text x="450" y="65" className="otp-secretlbl" textAnchor="middle">🔑 shared secret (from the QR code)</text>
      <rect x="70" y="110" width="180" height="46" rx="8" className="otp-party" />
      <text x="160" y="138" className="otp-partylbl" textAnchor="middle">📱 your phone</text>
      <rect x="650" y="110" width="180" height="46" rx="8" className="otp-party" />
      <text x="740" y="138" className="otp-partylbl" textAnchor="middle">🖥 the server</text>
      <line x1="250" y1="60" x2="330" y2="60" className="otp-wire" /><line x1="570" y1="60" x2="650" y2="60" className="otp-wire" />
      <text x="450" y="98" className="otp-nonet" textAnchor="middle">…and no network traffic after setup</text>

      {/* HMAC(secret, counter) */}
      <text x="70" y="196" className="otp-lbl">counter = floor(time / 30) = {counter}</text>
      <text x="70" y="220" className="otp-lbl">HMAC-SHA1(secret, counter) =</text>
      {(on('compute') || on('truncate') || on('window') || on('run')) && bytes.map((b, i) => {
        const sel = i >= off && i < off + 4; const offb = i === 19;
        return (
          <g key={i}>
            <rect x={70 + i * 38} y={232} width={34} height={30} rx="4" className={`otp-byte ${on('truncate') || on('run') ? (sel ? 'sel' : offb ? 'off' : '') : ''}`} />
            <text x={70 + i * 38 + 17} y={252} className="otp-bytet" textAnchor="middle">{b}</text>
          </g>
        );
      })}
      {(on('truncate') || on('run')) && <text x={70 + 19 * 38 + 17} y={228} className="otp-offlbl" textAnchor="middle">↑ offset</text>}
      {(on('truncate') || on('run')) && <text x={70 + off * 38 + 68} y={284} className="otp-sellbl">→ 4 bytes, mask top bit, mod 1,000,000</text>}

      {/* the code + countdown */}
      <text x="450" y="356" className="otp-codelbl" textAnchor="middle">6-digit code</text>
      <text x="450" y="404" className="otp-code" textAnchor="middle">{code.slice(0, 3)} {code.slice(3)}</text>
      <circle cx="700" cy="386" r="22" className="otp-ring" />
      <path d={arc(700, 386, 22, left / 30)} className="otp-ringfill" fill="none" />
      <text x="700" y="391" className="otp-ringt" textAnchor="middle">{left}s</text>

      <text x="450" y="452" className="otp-foot" textAnchor="middle">
        {on('shared') ? 'one secret shared at setup — never transmitted again'
          : on('compute') ? 'both sides compute the same HMAC from the same secret + time, offline'
          : on('truncate') ? 'the last nibble picks 4 bytes → a deterministic 6-digit code'
          : on('window') ? 'stable for 30 s, then a new code — the server allows ±1 window for clock skew'
          : on('limits') ? 'proves you hold the secret without sending it — but shared and phishable'
          : 'phone and server, in lockstep, never exchanging a thing'}
      </text>
    </svg>
  );
}

function arc(cx: number, cy: number, r: number, frac: number): string {
  const a = -Math.PI / 2 + frac * 2 * Math.PI; const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
  const large = frac > 0.5 ? 1 : 0;
  return `M ${cx} ${cy - r} A ${r} ${r} 0 ${large} 1 ${x.toFixed(1)} ${y.toFixed(1)}`;
}
