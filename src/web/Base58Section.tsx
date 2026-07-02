// Base58 & Base58Check, made visible. Enter a 20-byte hash160 and a version byte and watch it become a real
// Bitcoin-style address: version ‖ payload ‖ a 4-byte double-SHA256 checksum, Base58-encoded. Then edit the
// address and watch the checksum catch the typo. All bytes and hashes are real. Real model from base58.ts.
import { useEffect, useState } from 'react';
import { encodeCheck, decodeCheck, fromHex, toHex, ALPHABET, type CheckResult } from './base58';

const VERSIONS: { v: number; label: string }[] = [
  { v: 0x00, label: '0x00 — Bitcoin P2PKH (address starts with 1)' },
  { v: 0x05, label: '0x05 — Bitcoin P2SH (starts with 3)' },
  { v: 0x80, label: '0x80 — mainnet WIF private key' },
];
const DEFAULT = '010966776006953d5567439e5e39f86a0d273bee';

export function Base58Section() {
  const [payloadHex, setPayloadHex] = useState(DEFAULT);
  const [version, setVersion] = useState(0x00);
  const [address, setAddress] = useState('');
  const [probe, setProbe] = useState('');       // the (editable) address being verified
  const [decoded, setDecoded] = useState<CheckResult | null>(null);

  const validHex = /^([0-9a-fA-F]{2})*$/.test(payloadHex) && payloadHex.length > 0;

  useEffect(() => {
    if (!validHex) return;
    let live = true;
    encodeCheck(version, fromHex(payloadHex)).then((a) => { if (live) { setAddress(a); setProbe(a); } });
    return () => { live = false; };
  }, [payloadHex, version, validHex]);

  useEffect(() => {
    if (!probe) { setDecoded(null); return; }
    let live = true;
    decodeCheck(probe).then((d) => { if (live) setDecoded(d); }).catch(() => { if (live) setDecoded(null); });
    return () => { live = false; };
  }, [probe]);

  return (
    <div className="b58">
      <p className="b58-intro">
        Base58 turns bytes into text like Base64, but drops the look-alike characters <code>0 O I l</code> (and
        <code> + /</code>) so a human can transcribe an address, and — since 58 isn't a power of two — it encodes
        the whole input as one big number in base 58 rather than chunking bits. <strong>Base58Check</strong> wraps
        a <em>version byte</em> and a <em>4-byte double-SHA256 checksum</em> around the payload, which is how a
        Bitcoin address catches typos before any coins move. Enter a 20-byte payload (a hash160):
      </p>

      <div className="b58-inputs">
        <label className="b58-f">payload (hex)<input value={payloadHex} onChange={(e) => setPayloadHex(e.target.value.trim())} spellCheck={false} className={validHex ? '' : 'bad'} /></label>
        <label className="b58-f">version<select value={version} onChange={(e) => setVersion(+e.target.value)}>{VERSIONS.map((v) => <option key={v.v} value={v.v}>{v.label}</option>)}</select></label>
      </div>

      {decoded && (
        <div className="b58-build">
          <div className="b58-bytes">
            <span className="b58-seg ver" title="version byte">{toHex(new Uint8Array([decoded.version]))}</span>
            <span className="b58-seg pay" title="payload">{toHex(decoded.payload)}</span>
            <span className="b58-seg sum" title="checksum = first 4 bytes of SHA256(SHA256(version‖payload))">{toHex(decoded.checksum)}</span>
          </div>
          <div className="b58-legend"><span className="b58-lg ver">version</span><span className="b58-lg pay">payload (hash160)</span><span className="b58-lg sum">checksum (SHA256d)</span></div>
          <div className="b58-arrow">↓ Base58-encode the whole thing</div>
          <div className="b58-addr">{address}</div>
        </div>
      )}

      <div className="b58-verify">
        <label className="b58-f">verify / tamper an address<input value={probe} onChange={(e) => setProbe(e.target.value.trim())} spellCheck={false} /></label>
        {decoded && (
          <div className={`b58-verdict ${decoded.valid ? 'ok' : 'bad'}`}>
            {decoded.valid
              ? <>✓ checksum valid — decodes to version <b>0x{toHex(new Uint8Array([decoded.version]))}</b> + payload <b>{toHex(decoded.payload).slice(0, 16)}…</b></>
              : <>✗ checksum FAILS — got <b>{toHex(decoded.checksum)}</b> but the payload hashes to <b>{toHex(decoded.expected)}</b>. A wallet would reject this address.</>}
          </div>
        )}
      </div>

      <div className="b58-alpha">alphabet: <code>{ALPHABET}</code> <span className="b58-note">(58 chars — no 0, O, I, or l)</span></div>

      <p className="b58-foot">
        The checksum is 4 bytes = 32 bits, so a random corruption slips through with probability 2⁻³² (~1 in 4
        billion), and because it is a cryptographic hash of the version and payload, changing anything (even
        swapping the version byte to target the wrong network) invalidates it. That's why a fat-fingered Bitcoin
        address won't silently send funds into a black hole, though it is an <em>integrity</em> check, not an
        <em>authorization</em> one: it stops typos, not an attacker who recomputes the checksum. Base58's real
        downsides, that bignum division is slow and there's no fixed byte-to-char ratio, are why newer addresses
        use <strong>Bech32</strong> (the <code>bc1…</code> ones): a base-32 encoding with a BCH code that
        <em>locates</em> errors, is case-insensitive, and packs into QR codes more tightly. The same Base58Check
        envelope wraps WIF private keys and extended keys, and IPFS's original CIDv0 was Base58 before
        <strong>multibase</strong> CIDv1 made the encoding self-describing. It's a human-centered choice, optimizing
        the bytes for the eyes and fingers copying them in a field that usually optimizes for the machine. (Bitcoin
        base58check; BIP 173 Bech32.)
      </p>
    </div>
  );
}
