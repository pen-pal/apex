// VRF made visible. A VRF is a coin only YOU can flip but EVERYONE can check. Type a seed; the secret
// key turns it into a pseudorandom output plus a proof. Anyone with the public key verifies the output
// is the one true result for that seed — you couldn't have predicted it, and you can't shop for a nicer
// one. That's exactly what a blockchain needs to pick a block leader fairly without a trusted dealer:
// everyone runs VRF(secret, round); the lowest output wins and PROVES it. Real model from vrf.ts.
import { useMemo, useState } from 'react';
import { prove, verify } from './vrf';

// A few "validators", each a distinct secret key emulated by salting the seed. (The real scheme gives
// each its own RSA key; the toy reuses one key + a per-validator label — enough to show the race.)
const VALIDATORS = ['alice', 'bob', 'carol', 'dave'];

export function VrfSection() {
  const [seed, setSeed] = useState('round-42');
  const [tamper, setTamper] = useState(false);

  const me = useMemo(() => prove('alice|' + seed), [seed]);
  const shownOutput = tamper ? (me.output + 1) % 1000 : me.output;
  const ok = verify(me.input, shownOutput, me.proof);

  const race = useMemo(
    () => VALIDATORS.map((v) => ({ v, ...prove(v + '|' + seed) })).sort((a, b) => a.output - b.output),
    [seed],
  );
  const winner = race[0];

  return (
    <div className="vrf">
      <p className="vrf-intro">
        A <strong>verifiable random function</strong> is a coin only the key-holder can flip, yet anyone can
        check. Feed it a seed → it returns a pseudorandom <b>output&nbsp;β</b> and a <b>proof&nbsp;π</b>.
        The proof lets the whole world confirm β is the one true result for that seed — <em>without</em>
        being able to predict it, and without the holder being able to <em>pick</em> a favorable one.
      </p>

      <div className="vrf-io">
        <label className="vrf-seed">seed&nbsp;(x)
          <input value={seed} onChange={(e) => setSeed(e.target.value)} spellCheck={false} />
        </label>
        <div className="vrf-arrow">prove(sk, x) →</div>
        <div className="vrf-out">
          <div className="vrf-field"><span>H(x)</span><b>{me.hashed}</b></div>
          <div className="vrf-field"><span>proof π = H(x)<sup>d</sup> mod n</span><b>{me.proof}</b></div>
          <div className={`vrf-field big ${tamper ? 'lie' : ''}`}><span>output β = H′(π)</span><b>{shownOutput}</b></div>
        </div>
      </div>

      <div className="vrf-verify">
        <div className="vrf-vrow">
          <span className="vrf-vlabel">verify(pk, x, β, π)</span>
          <span className={`vrf-verdict ${ok ? 'ok' : 'bad'}`}>{ok ? '✓ valid — β really is the VRF output for this seed' : '✗ invalid — β does not match the proof'}</span>
        </div>
        <label className="vrf-tamper">
          <input type="checkbox" checked={tamper} onChange={(e) => setTamper(e.target.checked)} />
          try to cheat — claim a different output β (keep the same proof)
        </label>
        <div className="vrf-note">
          The check is two equations: <code>π<sup>e</sup> mod n = H(x)</code> (the proof is genuinely the
          secret key applied to this seed) and <code>β = H′(π)</code> (the output is the proof's hash).
          Change β and the second fails; you'd need the secret key to forge a matching proof.
        </div>
      </div>

      <div className="vrf-lottery">
        <div className="vrf-lh">Leaderless lottery — lowest output wins this round, and proves it:</div>
        <div className="vrf-bars">
          {race.map((r) => (
            <div key={r.v} className={`vrf-bar ${r.v === winner.v ? 'win' : ''}`}>
              <span className="vrf-bn">{r.v}</span>
              <div className="vrf-track"><div className="vrf-fill" style={{ width: `${(r.output / 999) * 100}%` }} /></div>
              <span className="vrf-bo">{r.output}</span>
              {r.v === winner.v && <span className="vrf-crown">★ leader</span>}
            </div>
          ))}
        </div>
        <div className="vrf-note">
          No dealer, no coordination: each validator runs the VRF on the shared round seed, and the smallest
          output is the elected leader. Everyone re-checks the winner's proof — so a validator can't grind
          seeds or claim a win it didn't earn. This is the heart of <strong>Algorand</strong> sortition and
          <strong> Cardano's Ouroboros Praos</strong> leader election; the same primitive backs
          <strong> DNSSEC NSEC5</strong> and public randomness beacons.
        </div>
      </div>

      <p className="vrf-foot">
        Three properties make it work: <strong>uniqueness</strong> (exactly one valid β per seed, so no
        cherry-picking), <strong>pseudorandomness</strong> (β is unpredictable without the secret key), and
        <strong> verifiability</strong> (the proof convinces anyone holding the public key). This toy uses an
        RSA-FDH construction on a tiny modulus for clarity; production VRFs (ECVRF over Ed25519) are built
        from elliptic curves and a hash-to-curve step, but the contract is identical. (Micali–Rabin–Vadhan
        1999; IRTF CFRG ECVRF.)
      </p>
    </div>
  );
}
