// SSH transport (RFC 4253), as a flow you can step through. The handshake builds an
// encrypted, authenticated channel BEFORE you ever send a password: exchange version
// banners, negotiate algorithms (KEXINIT), run a Diffie–Hellman/ECDH key exchange in
// which the server signs the transcript with its HOST KEY (proving identity), then
// NEWKEYS flips encryption on — everything after is opaque. Only then comes user auth
// and the multiplexed channels (shell, exec, sftp, port-forward). Plus the host-key
// trust-on-first-use check that catches a man-in-the-middle. Pure model (tested).

export type Enc = 'plaintext' | 'encrypted';
export type Phase = 'setup' | 'kex' | 'auth' | 'channel';

export interface SshStep { n: number; phase: Phase; from: string; to: string; msg: string; enc: Enc; note: string }

export function handshake(): SshStep[] {
  const steps: Omit<SshStep, 'enc'>[] = [
    { n: 1, phase: 'setup', from: 'client', to: 'server', msg: 'TCP connect :22', note: 'A plain TCP connection — nothing is encrypted yet.' },
    { n: 2, phase: 'setup', from: 'both', to: 'both', msg: 'version exchange', note: 'Each side sends an identification banner like “SSH-2.0-OpenSSH_9.6”, in the clear.' },
    { n: 3, phase: 'kex', from: 'both', to: 'both', msg: 'KEXINIT', note: 'Both list the key-exchange, host-key, cipher and MAC algorithms they support; the best mutual choice wins.' },
    { n: 4, phase: 'kex', from: 'both', to: 'both', msg: 'KEX (ECDH) + host-key signature', note: 'Ephemeral ECDH gives a shared secret; the server SIGNS the exchange hash with its host key, proving it owns the identity — this is what the fingerprint check verifies.' },
    { n: 5, phase: 'kex', from: 'both', to: 'both', msg: 'NEWKEYS', note: 'Both switch to the keys derived from the exchange. From here on every packet is encrypted and MAC’d — opaque on the wire.' },
    { n: 6, phase: 'auth', from: 'client', to: 'server', msg: 'SERVICE_REQUEST ssh-userauth', note: 'Now, inside the encrypted tunnel, the client asks to authenticate. Your password (if used) never traverses the network in the clear.' },
    { n: 7, phase: 'auth', from: 'client', to: 'server', msg: 'USERAUTH (publickey / password)', note: 'Public-key auth signs a challenge with your private key; the server checks it against authorized_keys. No secret is sent.' },
    { n: 8, phase: 'channel', from: 'client', to: 'server', msg: 'CHANNEL_OPEN (session) + shell/exec', note: 'One connection multiplexes many channels — an interactive shell, exec, sftp, and forwarded ports — all over the single encrypted transport.' },
  ];
  // encryption turns on at NEWKEYS (step 5): steps after it are encrypted
  return steps.map((s) => ({ ...s, enc: s.n >= 6 ? 'encrypted' : 'plaintext' }));
}

export const firstEncrypted = (steps: SshStep[]): number => steps.findIndex((s) => s.enc === 'encrypted');

export type HostKeyResult = 'tofu' | 'trusted' | 'changed';

/** known_hosts check: no record → trust-on-first-use; match → trusted; mismatch →
 *  CHANGED (a possible man-in-the-middle — SSH refuses loudly). */
export function verifyHost(knownFp: string | null, presentedFp: string): HostKeyResult {
  if (knownFp === null) return 'tofu';
  return knownFp === presentedFp ? 'trusted' : 'changed';
}
