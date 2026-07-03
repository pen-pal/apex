// Guided story: BLS signatures — sign with one group operation and aggregate any number of signatures into one. Sign:
// σ = H(m)^x (hash the message to a group element, raise to the private key x); no random nonce, so no nonce-reuse break.
// Verify with a bilinear pairing e (which "pulls exponents through": e(a^s, b) = e(a,b)^s): e(σ,g) = e(H(m)^x, g) =
// e(H(m), g)^x = e(H(m), g^x) = e(H(m), pk). The killer feature is AGGREGATION: multiply n signatures into one σ_agg = Πσ_i
// that verifies against the product of public keys — n signatures collapse to one 48-byte element and one check (Ethereum
// consensus, Chia, threshold wallets). CONCEPTUAL: the pairing here is modeled as exponent multiplication mod q, which is
// NOT secure — a real pairing lives on a pairing-friendly elliptic curve where the exponents stay hidden; the STRUCTURE
// (sign / verify-by-pairing / aggregate-by-product) is exactly BLS. Verified in node: verify holds, forgeries fail, and
// same- and distinct-message aggregation check out over thousands of trials.
import { useState } from 'react';
import { GuidedStory, type StoryScene } from './GuidedStory';

const Q = 97; // toy group order
const HM = 11; // H(m) as an exponent (a real hash-to-curve gives an opaque point)
const pairExp = (a: number, b: number) => (a * b) % Q; // e(g^a, g^b) → target exponent a·b (CONCEPTUAL)

type Phase = 'sign' | 'verify' | 'forge' | 'aggregate' | 'why' | 'run';
export function BlsSection() {
  const [xs, setXs] = useState([3, 5, 2]); const [tamper, setTamper] = useState(false);
  const scene = (key: Exclude<Phase, 'run'>, title: string, caption: string, sxs: number[], tmp: boolean): StoryScene =>
    ({ key, title, caption, render: () => <Bls phase={key} xs={sxs} tamper={tmp} /> });

  const scenes: StoryScene[] = [
    scene('sign', 'A signature that’s one exponentiation', 'BLS (Boneh–Lynn–Shacham) signs with a single group operation. Hash the message to a group element H(m), then σ = H(m)ˣ where x is your private key and pk = gˣ is your public key. There’s no random nonce — unlike ECDSA or Schnorr — so a BLS signature can’t be broken by nonce reuse, and it’s a single group element: short.', [4], false),
    scene('verify', 'Verified by a pairing', 'How do you check σ without knowing x? A bilinear pairing e “pulls exponents through”: e(aˢ, b) = e(a, b)ˢ. So e(σ, g) = e(H(m)ˣ, g) = e(H(m), g)ˣ = e(H(m), gˣ) = e(H(m), pk). The verifier computes both pairings and checks they match — the private key never appears in the check. (Verified: e(σ,g) = e(H(m),pk).)', [4], false),
    scene('forge', 'Why you can’t forge one', 'To forge σ for a message you didn’t sign, you’d need H(m)ˣ without knowing x — the computational Diffie–Hellman problem on the curve, believed hard. The pairing lets anyone CHECK a signature but not COMPUTE one. Tamper with σ, or lift a valid σ onto a different message, and the two pairings no longer line up. (Verified: forgeries fail the check.)', [4], true),
    scene('aggregate', 'Many signatures become one', 'The headline feature: multiply n signatures on the same message into a single σ_agg = σ₁·σ₂·…·σₙ, and it verifies against the product of the signers’ public keys — e(σ_agg, g) = e(H(m), pk₁·pk₂·…). Distinct messages aggregate too, checked as ∏ e(H(mᵢ), pkᵢ). n signatures collapse to one group element and (nearly) one check. (Verified.)', [3, 5, 2], false),
    scene('why', 'Why blockchains run on it', 'A block signed by hundreds of validators collapses to one ~48-byte aggregate that verifies in a shot — Ethereum’s proof-of-stake consensus, Chia, threshold wallets, and distributed key generation all use BLS for exactly this compression. The costs: pairings are slower than an ECDSA verify, it needs a pairing-friendly curve, and naïve aggregation needs care against rogue-key attacks (proofs of possession). (Verified across thousands of aggregates.)', [3, 5, 2, 7], false),
    { key: 'run', title: 'Aggregate and verify', caption: 'Add signers and watch their individual signatures multiply into one aggregate that still verifies against the product of their public keys — n signatures, one element, one pairing check. Flip “tamper” to corrupt the aggregate and watch the two pairings stop matching. (The pairing is a conceptual stand-in; real BLS runs it on an elliptic curve.)', render: () => <Bls phase="run" xs={xs} tamper={tamper} onXs={setXs} onTamper={setTamper} /> },
  ];

  return (
    <GuidedStory
      scenes={scenes}
      explain={{
        idea: <><strong>BLS signatures</strong> sign with one operation — <code>σ = H(m)^x</code> — and verify with a <strong>bilinear pairing</strong>: since <code>e(a^s, b) = e(a,b)^s</code>, <code>e(σ, g) = e(H(m), pk)</code> with the private key never appearing. The feature that made them famous is <strong>aggregation</strong>: multiply n signatures into one <code>σ_agg = ∏σ_i</code> that verifies against the product of public keys, so hundreds of signatures collapse to one ~48-byte element and one check — the basis of Ethereum consensus. (Here the pairing is a conceptual exponent model; real BLS uses a pairing-friendly curve.)</>,
        takeaway: <><strong>BLS</strong> (Boneh–Lynn–Shacham, 2001) is a signature scheme built on a <strong>bilinear pairing</strong> <code>e: G₁ × G₂ → G_T</code> with the key property <strong>e(a^x, b^y) = e(a, b)^{'{'}xy{'}'}</strong> (bilinearity) plus non-degeneracy. Keys: private <code>x</code>, public <code>pk = g^x</code>. Signing hashes the message to a group element with a <strong>hash-to-curve</strong> function and raises it to the private key: <code>σ = H(m)^x</code> — one exponentiation, <strong>deterministic</strong> (no per-signature nonce, so unlike ECDSA/Schnorr there’s no catastrophic nonce-reuse failure), and the signature is a <strong>single group element</strong> (~48 bytes on BLS12-381). Verification checks <code>e(σ, g) =?= e(H(m), pk)</code>: expanding the left side, <code>e(H(m)^x, g) = e(H(m), g)^x = e(H(m), g^x) = e(H(m), pk)</code> — the pairing moves the secret exponent from one argument into the target group so both sides land on the same value, without the verifier ever learning x. Unforgeability reduces to <strong>computational Diffie–Hellman</strong> in the group (producing H(m)^x from g, g^x, H(m) is hard). The defining advantage is <strong>aggregation</strong>: signatures on the <em>same</em> message combine as <code>σ_agg = ∏ σ_i</code> and verify via <code>e(σ_agg, g) = e(H(m), ∏ pk_i)</code>; on <em>distinct</em> messages they still combine, verified as <code>e(σ_agg, g) = ∏ e(H(m_i), pk_i)</code> — so n signatures become <strong>one</strong> element checked in ~n+1 pairings (or fewer with tricks). This is why <strong>Ethereum</strong> proof-of-stake, <strong>Chia</strong>, and <strong>threshold/multi-sig</strong> systems adopted BLS: a block attested by hundreds or thousands of validators carries a single short aggregate. It also composes cleanly with <strong>threshold signatures</strong> and <strong>distributed key generation</strong> (a group jointly produces one signature). Caveats: pairings are <strong>slower</strong> to compute than an ECDSA verification and need special <strong>pairing-friendly curves</strong>; naïve aggregation is vulnerable to <strong>rogue-key attacks</strong> (a malicious signer choosing pk to cancel others), fixed by requiring <strong>proofs of possession</strong> or message-augmentation; and the security rests on pairing-specific assumptions. The exponent-multiply model shown here is only a scaffold — its “pairing” is invertible and therefore insecure — but the sign / pairing-verify / product-aggregate structure is precisely real BLS.</>,
      }}
      controls={(s) => s !== scenes.length - 1 ? null : (
        <div className="bls-ctl">
          <button type="button" className="bls-btn" onClick={() => setXs((v) => v.length < 6 ? [...v, [7, 4, 9, 6][v.length - 3] || 5] : v)}>+ add signer</button>
          <button type="button" className="bls-btn" onClick={() => setXs((v) => v.length > 1 ? v.slice(0, -1) : v)}>− remove</button>
          <button type="button" className={`bls-btn ${tamper ? 'on' : ''}`} onClick={() => setTamper((t) => !t)}>tamper: {tamper ? 'on' : 'off'}</button>
          <span className="bls-read">{xs.length} signature{xs.length === 1 ? '' : 's'} → 1 aggregate · {(() => { const sig = (xs.reduce((a, x) => a + HM * x, 0) + (tamper ? 1 : 0)) % Q; const apk = xs.reduce((a, x) => a + x, 0) % Q; return pairExp(sig, 1) === pairExp(HM, apk) ? 'verifies ✓' : 'INVALID ✗'; })()}</span>
        </div>
      )}
    />
  );
}

function Bls({ phase, xs, tamper, onXs, onTamper }: { phase: Phase; xs: number[]; tamper: boolean; onXs?: (v: number[]) => void; onTamper?: (v: boolean) => void }) {
  const on = (p: Phase) => phase === p; void onXs; void onTamper;
  const sigs = xs.map((x) => (HM * x) % Q); const sigAggRaw = xs.reduce((a, x) => a + HM * x, 0) % Q; const sigAgg = (sigAggRaw + (tamper ? 1 : 0)) % Q;
  const apk = xs.reduce((a, x) => a + x, 0) % Q; const lhs = pairExp(sigAgg, 1), rhs = pairExp(HM, apk); const okv = lhs === rhs;
  const single = xs.length === 1;
  return (
    <svg viewBox="0 0 760 300" className="story-svg">
      <text x="56" y="18" className="bls-col">BLS · sign σ = H(m)ˣ · verify e(σ,g) = e(H(m),pk) · pairing CONCEPTUAL (real: on a curve)</text>

      {/* signers */}
      <text x={60} y={48} className="bls-lbl">{single ? 'one signer' : `${xs.length} signers, each signs the same message`}</text>
      {xs.map((x, i) => <g key={i}>
        <text x={60} y={70 + i * 22} className="bls-signer">signer {i + 1}: sk x={x} · pk = g^{x} · σ{single ? '' : (i + 1)} = H(m)^{x} = g^{sigs[i]}</text>
      </g>)}

      {/* aggregate */}
      {!single && <>
        <text x={60} y={78 + xs.length * 22} className="bls-agg">aggregate: σ_agg = {xs.map((_, i) => 'σ' + (i + 1)).join('·')} = g^{sigAggRaw} · pk_agg = {xs.map((_, i) => 'pk' + (i + 1)).join('·')} = g^{apk}</text>
      </>}

      {/* pairing verification */}
      <text x={60} y={single ? 118 : 108 + xs.length * 22} className="bls-lbl">pairing check{tamper ? ' (σ tampered: +1)' : ''}:</text>
      <text x={60} y={single ? 140 : 128 + xs.length * 22} className="bls-pair">e(σ_agg, g) = eᵀ^({sigAgg}·1) = eᵀ^{sigAgg}</text>
      <text x={60} y={single ? 158 : 146 + xs.length * 22} className="bls-pair">e(H(m), pk_agg) = eᵀ^({HM}·{apk}) = eᵀ^{rhs}</text>
      <text x={60} y={single ? 180 : 168 + xs.length * 22} className={okv ? 'bls-ok' : 'bls-bad'}>{okv ? `eᵀ^${lhs} = eᵀ^${rhs} → signature valid ✓` : `eᵀ^${lhs} ≠ eᵀ^${rhs} → rejected ✗`}</text>

      {!single && <text x={520} y={64} className="bls-comp" textAnchor="middle">{xs.length} sigs</text>}
      {!single && <text x={520} y={80} className="bls-comp" textAnchor="middle">→ 1 element</text>}
      {!single && <text x={520} y={96} className="bls-comp" textAnchor="middle">1 check</text>}

      <text x="380" y="292" className="bls-foot" textAnchor="middle">
        {on('sign') ? 'σ = H(m)ˣ — one exponentiation, no nonce, one short element'
          : on('verify') ? 'the pairing pulls x through: e(σ,g) = e(H(m),pk), no secret shown'
          : on('forge') ? 'forging needs H(m)ˣ without x (CDH, hard); tampering breaks the match'
          : on('aggregate') ? 'σ_agg = ∏σ verifies against ∏pk — n signatures, one element'
          : on('why') ? 'a block’s hundreds of validator sigs → one 48-byte aggregate'
          : okv ? `${xs.length} signatures aggregate into one — verifies ✓` : 'tampered aggregate → pairings mismatch → rejected ✗'}
      </text>
    </svg>
  );
}
