// JSON Web Tokens (RFC 7519). A JWT is three base64url parts —
// header.payload.signature — that are SIGNED, not encrypted: anyone can read the
// claims, only the key holder can forge a valid signature. The notorious failure
// is `alg:none`, which tells a naive verifier to skip the check entirely. We
// decode honestly and flag that. Signature verification is real HMAC-SHA256.

export function b64urlToBytes(s: string): Uint8Array {
  let t = s.replace(/-/g, '+').replace(/_/g, '/');
  while (t.length % 4) t += '=';
  const bin = atob(t);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToB64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export interface JwtParsed {
  ok: boolean;
  error?: string;
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signature: string; // the raw base64url signature segment
  signingInput: string; // header.payload — what the signature covers
  alg: string;
  warnings: string[];
}

/** Decode (NOT verify) a JWT into its parts, flagging dangerous algorithms. */
export function decodeJwt(token: string): JwtParsed {
  const empty: JwtParsed = { ok: false, header: {}, payload: {}, signature: '', signingInput: '', alg: '', warnings: [] };
  const parts = token.trim().split('.');
  if (parts.length !== 3) return { ...empty, error: 'A JWT has exactly three dot-separated parts.' };
  try {
    const dec = new TextDecoder();
    const header = JSON.parse(dec.decode(b64urlToBytes(parts[0]))) as Record<string, unknown>;
    const payload = JSON.parse(dec.decode(b64urlToBytes(parts[1]))) as Record<string, unknown>;
    const alg = String(header.alg ?? '');
    const warnings: string[] = [];
    if (alg.toLowerCase() === 'none' || parts[2] === '') {
      warnings.push('alg is "none" — the token is UNSIGNED. A verifier that honours this accepts forged tokens.');
    }
    if (alg.startsWith('HS') && 'kid' in header === false) {
      // informational only
    }
    return { ok: true, header, payload, signature: parts[2], signingInput: `${parts[0]}.${parts[1]}`, alg, warnings };
  } catch (e) {
    return { ...empty, error: e instanceof Error ? e.message : 'Could not parse the token.' };
  }
}

/** Verify an HS256 JWT signature with a candidate secret (real HMAC-SHA256). */
export async function verifyHs256(token: string, secret: string): Promise<boolean> {
  const parts = token.trim().split('.');
  if (parts.length !== 3) return false;
  if (!globalThis.crypto?.subtle) throw new Error('WebCrypto unavailable.');
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(`${parts[0]}.${parts[1]}`)));
  return bytesToB64url(sig) === parts[2];
}
