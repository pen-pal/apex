// Memory-hard password hashing. The PBKDF2 tool (in the crypto playground) already
// shows salt + iterations; this section adds the part that defeats modern cracking:
// memory-hardness. Pick a password strength and an attacker, toggle the GPU farm,
// and watch PBKDF2 crumble while Argon2 holds — because each Argon2 guess costs
// megabytes of RAM the attacker can't parallelise away. Model in pwhash.ts (tested).
import { useState } from 'react';
import { KDFS, crackSeconds, humanTime } from './pwhash';

const ENTROPY_NOTE = (b: number) =>
  b < 30 ? 'weak — a common password' : b < 46 ? '≈ 4-word passphrase' : b < 60 ? '≈ 8 random characters' : 'strong — 5–6 random words';

const ATTACKERS: { label: string; cores: number }[] = [
  { label: 'one laptop', cores: 8 },
  { label: '100-GPU rig', cores: 100_000 },
  { label: 'cloud farm', cores: 5_000_000 },
];

const tier = (sec: number) => (sec < 86400 ? 'bad' : sec < 31557600 * 100 ? 'mid' : 'good');

export function PasswordHashSection() {
  const [bits, setBits] = useState(44);
  const [atk, setAtk] = useState(1);
  const [gpu, setGpu] = useState(true);
  const cores = ATTACKERS[atk].cores;

  const times = KDFS.map((k) => ({ k, sec: crackSeconds(k, bits, cores, gpu) }));
  const maxLog = Math.max(...times.map((t) => Math.log10(Math.max(t.sec, 1))), 1);

  return (
    <div className="journey">
      <section className="jsec">
        <div className="jsec-head"><h2>① The password-hashing ladder</h2></div>
        <p className="jsec-sub">
          Never store a raw password hash. A <strong>salt</strong> defeats rainbow tables and an <strong>iteration count</strong>
          makes each guess slow — but PBKDF2 and bcrypt use almost no memory, so attackers crack them on cheap, massively-parallel
          GPUs and ASICs. <strong>scrypt</strong> and <strong>Argon2</strong> make each guess also cost a big chunk of <em>RAM</em>,
          which can’t be parallelised away.
        </p>
        <div className="pw-ladder">
          {KDFS.map((k) => (
            <div key={k.id} className="pw-kdf">
              <div className="pw-k-top"><span className="pw-k-name">{k.name}</span><span className="pw-k-year">{k.year}</span></div>
              <div className="pw-k-mem">{k.memoryKiB < 1 ? '~0' : k.memoryKiB >= 1024 ? `${k.memoryKiB / 1024} MiB` : `${k.memoryKiB} KiB`} / guess</div>
              <div className="pw-k-tags">{k.defends.map((d) => <span key={d} className={`pw-tag ${d.includes('memory') ? 'mem' : ''}`}>{d}</span>)}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="jsec">
        <div className="jsec-head"><h2>② Attacker economics</h2></div>
        <p className="jsec-sub">
          Each KDF is tuned so a login takes ~0.25 s on the server. On a plain CPU that makes them all equally slow to attack — the
          difference is what a <strong>GPU/ASIC farm</strong> buys. Set the password strength and the attacker, then flip the farm on.
        </p>
        <div className="pw-controls">
          <label className="pw-slider">password entropy: <strong>{bits} bits</strong> <span className="pw-ent-note">({ENTROPY_NOTE(bits)})</span>
            <input type="range" min={24} max={72} value={bits} onChange={(e) => setBits(Number(e.target.value))} /></label>
          <div className="pw-atk">
            <span>attacker:</span>
            {ATTACKERS.map((a, i) => <button key={a.label} className={atk === i ? 'on' : ''} onClick={() => setAtk(i)}>{a.label}</button>)}
          </div>
          <label className="pw-gpu"><input type="checkbox" checked={gpu} onChange={(e) => setGpu(e.target.checked)} /> GPU / ASIC farm</label>
        </div>

        <div className="pw-bars">
          {times.map(({ k, sec }) => (
            <div key={k.id} className="pw-bar-row">
              <span className="pw-bar-name">{k.name}</span>
              <div className="pw-bar-track">
                <div className={`pw-bar ${tier(sec)}`} style={{ width: `${Math.max(2, (Math.log10(Math.max(sec, 1)) / maxLog) * 100)}%` }} />
              </div>
              <span className={`pw-bar-t ${tier(sec)}`}>{humanTime(sec)}</span>
            </div>
          ))}
        </div>
        <p className="pw-note">
          With the GPU farm on, PBKDF2’s ~1000× advantage turns the same password into a fast crack, while Argon2id — memory-hard —
          barely moves. That’s why Argon2id is today’s default (OWASP), tuned to the most memory and iterations your login latency
          budget allows. None of this saves a truly weak password: slide the entropy down and watch even Argon2 fall.
        </p>
      </section>
    </div>
  );
}
