// OAuth 2.0 Authorization Code flow with PKCE (RFC 6749 + RFC 7636). How an app gets
// permission to call an API on your behalf WITHOUT ever seeing your password. The app
// redirects you to the authorization server; you authenticate and consent there; it
// redirects back with a one-time code; the app trades that code (plus a secret it can
// prove it created) for an access token. Two defenses make it safe: `state` stops CSRF,
// and PKCE — code_challenge = BASE64URL(SHA-256(code_verifier)) — stops an attacker who
// steals the code from redeeming it. Pure model; PKCE is anchored to the RFC 7636 vector.
import { sha256 } from './sha256';

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/** base64url (no padding), the encoding PKCE and JWT use. */
export function base64url(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i], b1 = bytes[i + 1] ?? 0, b2 = bytes[i + 2] ?? 0;
    out += B64[b0 >> 2] + B64[((b0 & 3) << 4) | (b1 >> 4)];
    if (i + 1 < bytes.length) out += B64[((b1 & 15) << 2) | (b2 >> 6)];
    if (i + 2 < bytes.length) out += B64[b2 & 63];
  }
  return out;
}

/** PKCE S256 challenge from a verifier. */
export const codeChallenge = (verifier: string): string => base64url(sha256(new TextEncoder().encode(verifier)));

export interface Params { clientId: string; redirectUri: string; scope: string; state: string; verifier: string }
export interface Tamper { wrongState?: boolean; attackerStealsCode?: boolean }

export interface Step { actor: 'app' | 'browser' | 'authserver'; title: string; detail: string; ok: boolean }
export interface Flow { steps: Step[]; tokenIssued: boolean; reason: string }

export function runFlow(p: Params, t: Tamper = {}): Flow {
  const challenge = codeChallenge(p.verifier);
  const steps: Step[] = [];
  const code = 'AUTHCODE_' + p.state.slice(0, 4);
  const returnedState = t.wrongState ? p.state + 'X' : p.state;

  steps.push({ actor: 'app', title: '1 · Authorization request', ok: true,
    detail: `redirect to /authorize?client_id=${p.clientId}&redirect_uri=${p.redirectUri}&scope=${p.scope}&state=${p.state}&code_challenge=${challenge.slice(0, 12)}…&code_challenge_method=S256` });
  steps.push({ actor: 'authserver', title: '2 · Authenticate & consent', ok: true,
    detail: `the user logs in AT the authorization server and approves scope "${p.scope}". The app never sees the password.` });
  steps.push({ actor: 'browser', title: '3 · Redirect back with code', ok: true,
    detail: `→ ${p.redirectUri}?code=${code}&state=${returnedState}` });

  // CSRF defense: the returned state must equal the one the app sent
  const stateOk = returnedState === p.state;
  steps.push({ actor: 'app', title: '4 · Verify state (CSRF check)', ok: stateOk,
    detail: stateOk ? `state matches "${p.state}" — this response belongs to our request` : `state "${returnedState}" ≠ "${p.state}" — possible CSRF, abort` });
  if (!stateOk) return { steps, tokenIssued: false, reason: 'state mismatch — request rejected (CSRF protection)' };

  // PKCE defense: redeemer must present the verifier whose SHA-256 equals the challenge
  const presentedVerifier = t.attackerStealsCode ? 'attacker-guess' : p.verifier;
  const pkceOk = codeChallenge(presentedVerifier) === challenge;
  steps.push({ actor: 'app', title: '5 · Exchange code at /token', ok: pkceOk,
    detail: t.attackerStealsCode
      ? 'an attacker who intercepted the code tries to redeem it — but must also send code_verifier'
      : `POST /token  code=${code}&code_verifier=${p.verifier.slice(0, 10)}…` });
  steps.push({ actor: 'authserver', title: '6 · Server checks PKCE', ok: pkceOk,
    detail: pkceOk ? 'SHA-256(code_verifier) == code_challenge ✓ — issue access_token (+ id_token for OIDC)'
      : 'SHA-256(verifier) ≠ stored challenge — the code is useless without the original verifier' });
  if (!pkceOk) return { steps, tokenIssued: false, reason: 'PKCE verification failed — stolen code cannot be redeemed' };

  return { steps, tokenIssued: true, reason: 'access token issued — the app can now call the API as the user' };
}
