// DNS cache poisoning, made visible. An off-path attacker forges replies to a resolver, guessing the fields
// that make one look valid. Toggle the defenses and watch the entropy the attacker must guess — and the
// time to poison the cache — jump from "a fraction of a second" (16-bit query ID only) to "longer than the
// universe" (add source-port randomization, 0x20 case, or DNSSEC). Real model from kaminsky.ts.
import { useState } from 'react';
import { entropyBits, expectedAttempts, timeToPoison } from './kaminsky';

function humanTime(s: number): string {
  if (!isFinite(s)) return 'infeasible';
  if (s < 1e-3) return '<1 ms';
  if (s < 1) return `${Math.round(s * 1000)} ms`;
  if (s < 60) return `${s.toFixed(1)} s`;
  if (s < 3600) return `${(s / 60).toFixed(1)} min`;
  if (s < 86400) return `${(s / 3600).toFixed(1)} hours`;
  if (s < 3.15e7) return `${(s / 86400).toFixed(1)} days`;
  const y = s / 3.15e7;
  return y > 1e6 ? `${(y / 1e6).toExponential(1)} million yrs` : `${y.toFixed(0)} years`;
}

const NAME = 'www.bank.com'; // 10 case-flippable letters

export function KaminskySection() {
  const [portRandom, setPortRandom] = useState(false);
  const [zero, setZero] = useState(false);
  const [dnssec, setDnssec] = useState(false);
  const [rate, setRate] = useState(100000);

  const case0x20Letters = zero ? 10 : 0;
  const bits = entropyBits({ portRandom, case0x20Letters, dnssec });
  const time = timeToPoison(bits, rate);
  const feasible = isFinite(time) && time < 3600; // "practically poisonable" within an hour

  return (
    <div className="kam">
      <p className="kam-intro">
        A recursive resolver asks an authoritative server for <code>{NAME}</code> and accepts the <strong>first
        valid-looking reply</strong>. An off-path attacker can't see the query, so they <strong>guess</strong>
        the fields that validate a reply and flood forgeries. Kaminsky's 2008 trick — query random names so
        every guess is a fresh race with no cache lockout — turned "one slow shot" into <strong>unlimited
        attempts</strong>. The only defense is <strong>entropy</strong>.
      </p>

      <div className="kam-defenses">
        <label className={`kam-def ${!portRandom && !zero && !dnssec ? 'base' : ''}`}><input type="checkbox" checked disabled /> 16-bit query ID <span>always guessed</span></label>
        <label className={`kam-def ${portRandom ? 'on' : ''}`}><input type="checkbox" checked={portRandom} onChange={(e) => setPortRandom(e.target.checked)} /> source-port randomization <span>+16 bits (RFC 5452)</span></label>
        <label className={`kam-def ${zero ? 'on' : ''}`}><input type="checkbox" checked={zero} onChange={(e) => setZero(e.target.checked)} /> 0x20 case randomization <span>+{10} bits (letters in the name)</span></label>
        <label className={`kam-def ${dnssec ? 'on' : ''}`}><input type="checkbox" checked={dnssec} onChange={(e) => setDnssec(e.target.checked)} /> DNSSEC <span>signed — unforgeable</span></label>
      </div>

      <div className="kam-readout">
        <div className="kam-stat"><span>entropy to guess</span><b>{bits === Infinity ? '∞' : `${bits} bits`}</b></div>
        <div className="kam-stat"><span>per-packet odds</span><b>{bits === Infinity ? '0' : `1 in ${expectedAttempts(bits).toLocaleString()}`}</b></div>
        <div className="kam-stat"><span>expected packets</span><b>{bits === Infinity ? '∞' : expectedAttempts(bits) > 1e9 ? expectedAttempts(bits).toExponential(1) : expectedAttempts(bits).toLocaleString()}</b></div>
      </div>

      <div className="kam-race">
        <label className="kam-rate">attacker rate <input type="range" min={1000} max={1000000} step={1000} value={rate} onChange={(e) => setRate(+e.target.value)} /><b>{(rate / 1000).toLocaleString()}k pkt/s</b></label>
        <div className={`kam-poison ${dnssec || !feasible ? 'safe' : 'danger'}`}>
          <span>time to poison the cache</span>
          <b>{humanTime(time)}</b>
          <i>{dnssec ? 'DNSSEC signatures can\'t be forged' : feasible ? '⚠ practically poisonable' : 'entropy makes it impractical'}</i>
        </div>
      </div>

      <p className="kam-foot">
        The math is brutal in both directions: 16 bits (65,536) falls in well under a second at a modern packet
        rate, but each defense <em>multiplies</em> the search space — port randomization alone turns sub-second
        into ~half a day, and stacking them pushes it past any practical horizon. That's why the post-Kaminsky
        fix was operational, not a redesign: every resolver randomized its source port overnight (RFC 5452), many
        added 0x20 case-mixing, and the real end-state is <strong>DNSSEC</strong>, which signs answers so a forged
        reply is rejected no matter how lucky the guess. It's the same lesson as hash-flooding: when an attacker
        can retry cheaply, your only safety is unpredictability they can't precompute. (Kaminsky 2008; RFC 5452.)
      </p>
    </div>
  );
}
