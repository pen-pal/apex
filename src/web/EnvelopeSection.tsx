// Envelope encryption, made visible. Your data is encrypted with a fresh Data Encryption Key (DEK); the DEK is
// then wrapped (encrypted) with a Key-Encryption Key (KEK) that lives only inside the KMS. You store the big
// ciphertext next to the tiny wrapped DEK. What you can watch here: rotating the master KEK only re-wraps
// the 4-byte DEK — the ciphertext (your terabytes) is never touched. Real model from envelope.ts.
import { useEffect, useState } from 'react';
import { envelopeEncrypt, envelopeDecrypt, unwrapDEK, rotateKEK, bytes, str, type Envelope } from './envelope';

const DEK = 0x5ec12e7;
const kekOf = (v: number) => 0x1000 * v + 0xace;
const hex = (b: number[], max = 24) => b.slice(0, max).map((x) => x.toString(16).padStart(2, '0')).join(' ') + (b.length > max ? ' …' : '');

export function EnvelopeSection() {
  const [pt, setPt] = useState('customer SSN: 123-45-6789');
  const [version, setVersion] = useState(1);
  const [env, setEnv] = useState<Envelope>(() => envelopeEncrypt(bytes(pt), kekOf(1), DEK));
  const [rotations, setRotations] = useState(0);

  useEffect(() => { setEnv(envelopeEncrypt(bytes(pt), kekOf(1), DEK)); setVersion(1); setRotations(0); }, [pt]);

  const rotate = () => { setEnv((e) => rotateKEK(e, kekOf(version), kekOf(version + 1))); setVersion((v) => v + 1); setRotations((r) => r + 1); };

  const recoveredDEK = unwrapDEK(env.wrappedDEK, kekOf(version));
  const decrypted = str(envelopeDecrypt(env, kekOf(version)));

  return (
    <div className="evk">
      <p className="evk-intro">
        You never encrypt data with the master key directly. Instead: a fresh random <strong>DEK</strong>
        encrypts the data, and the <strong>KEK</strong> — which lives only inside the KMS — <strong>wraps</strong>
        the DEK. You store the ciphertext beside the wrapped DEK. Edit the data:
      </p>

      <label className="evk-field">plaintext<input value={pt} onChange={(e) => setPt(e.target.value)} spellCheck={false} /></label>

      <div className="evk-flow">
        <div className="evk-box data">
          <div className="evk-bh">📄 your data</div>
          <div className="evk-arrow">encrypt with <span className="evk-key dek">🔑 DEK</span> ↓</div>
          <div className="evk-blob ct">{hex(env.ciphertext)}</div>
          <div className="evk-cap">ciphertext · {env.ciphertext.length} bytes</div>
        </div>
        <div className="evk-box kms">
          <div className="evk-bh">🏛 KMS <span className="evk-kekv">KEK v{version}</span></div>
          <div className="evk-arrow">wrap <span className="evk-key dek">🔑 DEK</span> with <span className="evk-key kek">🗝 KEK</span> ↓</div>
          <div className="evk-blob wr">{env.wrappedDEK.map((x) => x.toString(16).padStart(2, '0')).join(' ')}</div>
          <div className="evk-cap">wrapped DEK · {env.wrappedDEK.length} bytes</div>
        </div>
      </div>

      <div className="evk-store">🗄 stored together: <code>{'{ ciphertext, wrapped_dek }'}</code> — the plaintext DEK and the KEK are <b>nowhere</b> on your servers.</div>

      <div className="evk-rotate">
        <button type="button" className="evk-btn" onClick={rotate}>🔄 rotate master key → KEK v{version + 1}</button>
        <div className="evk-rstats">
          <span>rotations: <b>{rotations}</b></span>
          <span className="evk-good">data re-encrypted: <b>0 bytes</b></span>
          <span>DEK re-wrapped: <b>{rotations ? '✓' : '—'}</b></span>
        </div>
      </div>
      {rotations > 0 && <div className="evk-rnote">✓ after {rotations} rotation{rotations === 1 ? '' : 's'}, the ciphertext is <b>byte-for-byte identical</b> — only the 4-byte wrapped DEK changed. Rotating the master key over a petabyte of data costs nothing.</div>}

      <div className="evk-decrypt">
        🔓 to read: KMS unwraps the DEK (KEK v{version} → DEK <code>0x{recoveredDEK.toString(16)}</code>), then the DEK decrypts locally → <b className={decrypted === pt ? 'ok' : 'bad'}>"{decrypted}"</b>
      </div>

      <p className="evk-foot">
        Two independent wins fall out of the split. <strong>Blast radius</strong>: the KEK never leaves the KMS's
        HSM, so an attacker who pops an application server gets one DEK (one object, or one data key's worth of
        objects) — not the master key that would unlock everything. <strong>Cheap rotation and revocation</strong>:
        because the data is bound to the DEK and only the DEK is bound to the KEK, you rotate the master key by
        re-wrapping DEKs (milliseconds, no data movement), and you can cut off access instantly by disabling the
        KEK — every wrapped DEK becomes undecryptable at once. Real KMS envelope encryption uses AES-GCM or
        AES-KW (RFC 3394) for the wrap (this model uses a toy stream cipher to show the structure), adds
        authentication so a tampered ciphertext or wrapped DEK is rejected, and often adds per-tenant KEKs and
        an offline root key. The same pattern shows up as <strong>DEK/KEK in disk encryption</strong> (LUKS wraps
        the volume key with your passphrase, so changing your passphrase re-wraps one key, not the disk) and in
        password managers. (NIST SP 800-57; AWS/GCP KMS.)
      </p>
    </div>
  );
}
