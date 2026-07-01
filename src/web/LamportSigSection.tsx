// Lamport one-time signatures, made visible. A key pair is 2L secrets (private) and their hashes (public). Type
// a message: it hashes to L bits, and for each bit the signature REVEALS one of the two secrets at that
// position. Verify re-hashes each revealed secret and checks it against the public key. Then sign a SECOND
// message with the same key and watch positions light up where BOTH secrets are now exposed — the one-time
// weakness. Real model from lamportsig.ts.
import { useMemo, useState } from 'react';
import { keygen, sign, verify, messageBits, revealed, forgeablePositions, L } from './lamportsig';

const KP = keygen(20240701);

export function LamportSigSection() {
  const [msg, setMsg] = useState('pay alice 100');
  const [msg2, setMsg2] = useState('pay bob 250');
  const [reuse, setReuse] = useState(false);

  const bits = useMemo(() => messageBits(msg), [msg]);
  const sig = useMemo(() => sign(msg, KP.priv), [msg]);
  const ok = verify(msg, sig, KP.pub);

  const bits2 = useMemo(() => messageBits(msg2), [msg2]);
  const rev = useMemo(() => (reuse ? revealed([msg, msg2]) : revealed([msg])), [msg, msg2, reuse]);
  const forgeable = reuse ? forgeablePositions([msg, msg2]) : 0;

  return (
    <div className="lms">
      <p className="lms-intro">
        A signature made from a hash and nothing else — the ancestor of the post-quantum schemes (SPHINCS+/XMSS).
        The private key is <b>2L</b> random secrets, two per bit position; the public key is those secrets
        <strong> hashed</strong>. Signing reveals, for each bit of the message digest, the matching secret; a
        forger would have to invert the hash to fake one. Type a message ({L}-bit digest shown):
      </p>

      <label className="lms-mf">message<input value={msg} onChange={(e) => setMsg(e.target.value)} spellCheck={false} /></label>

      <div className="lms-grid">
        <div className="lms-labels"><span>bit</span><span>digest</span><span>reveal secret</span><span>H(secret) = pubkey?</span></div>
        {Array.from({ length: L }, (_, i) => {
          const bit = bits[i];
          const bothRevealed = reuse && rev[i].size === 2;
          return (
            <div key={i} className={`lms-col ${bothRevealed ? 'forge' : ''}`}>
              <span className="lms-i">{i}</span>
              <span className={`lms-bit b${bit}`}>{bit}</span>
              <span className={`lms-secret b${bit}`}>{sig[i].slice(0, 4)}</span>
              <span className="lms-check">✓</span>
            </div>
          );
        })}
      </div>

      <div className={`lms-verdict ${ok ? 'ok' : 'bad'}`}>
        {ok ? <><b>✓ VALID</b> — every revealed secret hashes to the matching half of the public key.</> : <><b>✗ INVALID</b></>}
        <span className="lms-hint">the signature is just the {L} revealed secrets; the other {L} stay hidden.</span>
      </div>

      <div className={`lms-otp ${reuse ? 'on' : ''}`}>
        <label className="lms-reuse"><input type="checkbox" checked={reuse} onChange={(e) => setReuse(e.target.checked)} /> reuse this key to also sign a second message (the fatal mistake)</label>
        {reuse && (
          <>
            <label className="lms-mf2">message&nbsp;2<input value={msg2} onChange={(e) => setMsg2(e.target.value)} spellCheck={false} /></label>
            <div className="lms-otpbits">
              {Array.from({ length: L }, (_, i) => (
                <span key={i} className={`lms-otpb ${rev[i].size === 2 ? 'both' : ''}`} title={rev[i].size === 2 ? 'both secrets exposed — forgeable' : 'one secret exposed'}>{bits[i]}{bits2[i]}</span>
              ))}
            </div>
            <div className={`lms-otpverdict ${forgeable > 0 ? 'bad' : ''}`}>
              ⚠ <b>{forgeable}</b> of {L} positions now expose <b>both</b> secrets (where the two digests differ) — a forger can freely set those bits and sign messages you never approved. This is why a Lamport key signs <strong>exactly once</strong>.
            </div>
          </>
        )}
      </div>

      <p className="lms-foot">
        The one-time limit sounds crippling but is engineered around cleanly. To sign many messages you generate
        many one-time key pairs and put all their public keys as leaves of a <strong>Merkle tree</strong>; the
        single tree root becomes your long-term public key, and each signature ships one OTS signature plus the
        Merkle path proving that leaf belongs to the tree. That's exactly <strong>XMSS</strong> (stateful — you
        must never reuse a leaf, so you track an index) and <strong>SPHINCS+</strong> (stateless — it picks leaves
        pseudo-randomly with enough of them that collisions are negligible), both NIST-standardized as
        quantum-resistant signatures. Real Lamport also halves signature size with a trick: sign the message bits
        AND a checksum of them, so an attacker who flips some bits to 0 (revealing fewer secrets) is forced to
        flip a checksum bit to 1 (needing a secret they don't have) — that's <strong>Winternitz</strong> (WOTS),
        which further trades hashing for size. The whole family buys post-quantum security with a very
        conservative assumption — a decent hash function — at the cost of larger signatures and, for the
        stateful variants, careful key-state management. (Lamport 1979; NIST SP 800-208 for LMS/XMSS, FIPS 205 for SPHINCS+.)
      </p>
    </div>
  );
}
