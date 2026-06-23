// The TLS 1.3 full handshake (RFC 8446 §2), as a pure data model so a view can
// animate it honestly. The crucial truths this encodes: only ClientHello and
// ServerHello travel in the clear; from EncryptedExtensions onward the handshake
// is already encrypted under HANDSHAKE traffic keys; and once both Finished
// messages are exchanged, application data flows under APPLICATION traffic keys
// and is OPAQUE on the wire. We never invent decrypted plaintext.

export type EncLevel = 'plaintext' | 'handshake' | 'application';

export interface TlsMessage {
  id: string;
  flight: number; // 1 = client hello, 2 = server flight, 3 = client finished, 4 = app data
  from: 'client' | 'server';
  record: 'handshake' | 'change_cipher_spec' | 'application_data';
  name: string;
  enc: EncLevel;
  purpose: string;
  establishes?: string; // key-schedule milestone reached AFTER this message
}

/** The ordered messages of a 1-RTT TLS 1.3 handshake, ending in application data. */
export function tls13Flow(): TlsMessage[] {
  return [
    {
      id: 'client-hello', flight: 1, from: 'client', record: 'handshake', name: 'ClientHello', enc: 'plaintext',
      purpose: 'Offers TLS 1.3, cipher suites, and a key_share — the client’s ephemeral (EC)DHE public key. Sent in the clear.',
    },
    {
      id: 'server-hello', flight: 2, from: 'server', record: 'handshake', name: 'ServerHello', enc: 'plaintext',
      purpose: 'Picks the cipher suite and returns the server’s key_share. Now both sides can derive the shared secret.',
      establishes: 'Handshake secret → client/server handshake traffic keys (the rest of the handshake is now encrypted)',
    },
    {
      id: 'change-cipher-spec', flight: 2, from: 'server', record: 'change_cipher_spec', name: 'ChangeCipherSpec', enc: 'plaintext',
      purpose: 'A dummy record kept only for middlebox compatibility — it carries no security meaning in TLS 1.3.',
    },
    {
      id: 'encrypted-extensions', flight: 2, from: 'server', record: 'handshake', name: 'EncryptedExtensions', enc: 'handshake',
      purpose: 'The remaining server hello parameters (ALPN, etc.) — the first message protected by the handshake keys.',
    },
    {
      id: 'certificate', flight: 2, from: 'server', record: 'handshake', name: 'Certificate', enc: 'handshake',
      purpose: 'The server’s X.509 certificate chain, encrypted (in TLS 1.3 the certificate is no longer sent in the clear).',
    },
    {
      id: 'certificate-verify', flight: 2, from: 'server', record: 'handshake', name: 'CertificateVerify', enc: 'handshake',
      purpose: 'A signature over the handshake transcript with the certificate’s private key — proves the server owns it.',
    },
    {
      id: 'server-finished', flight: 2, from: 'server', record: 'handshake', name: 'Finished', enc: 'handshake',
      purpose: 'An HMAC over the whole transcript so far — proves the server’s handshake keys are correct and untampered.',
    },
    {
      id: 'client-finished', flight: 3, from: 'client', record: 'handshake', name: 'Finished', enc: 'handshake',
      purpose: 'The client’s transcript HMAC, completing the handshake. Both sides have now authenticated the key exchange.',
      establishes: 'Master secret → application traffic keys (application data now flows encrypted)',
    },
    {
      id: 'app-data', flight: 4, from: 'client', record: 'application_data', name: 'Application Data', enc: 'application',
      purpose: 'HTTP, etc., under the application traffic keys. On the wire it is an opaque record: type 23, length, ciphertext + tag. Apex never invents the plaintext.',
    },
  ];
}

/** Index of the first message that is encrypted (under handshake keys). */
export function firstEncryptedIndex(flow: TlsMessage[]): number {
  return flow.findIndex((m) => m.enc !== 'plaintext');
}

/** The encryption level in effect *while sending* the message at `index`. */
export function levelAt(flow: TlsMessage[], index: number): EncLevel {
  return flow[index]?.enc ?? 'plaintext';
}
