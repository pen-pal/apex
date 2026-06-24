// Kerberos (RFC 4120) — single sign-on without ever sending the password. Three
// exchanges, each a request/reply: AS (get a ticket-granting ticket), TGS (trade the
// TGT for a service ticket), AP (present the service ticket to the server). The trick
// is that the KDC shares a long-term key with every principal, so it can hand each
// side a session key sealed under a key only that side holds — and tickets are opaque
// to the client, who just relays them. We model who can read what; the encryption is
// honest about opacity (no invented plaintext for blobs the holder can't open).

export type Key =
  | 'Kc' // client long-term key (derived from the password — never transmitted)
  | 'Ktgs' // TGS long-term key
  | 'Ksvc' // service long-term key
  | 'Kc_tgs' // client↔TGS session key (issued by AS)
  | 'Kc_svc'; // client↔service session key (issued by TGS)

export interface Blob {
  label: string;
  encWith: Key; // which key this blob is sealed under
  readableBy: 'client' | 'tgs' | 'service'; // who holds that key
  contents: string[]; // what's inside (visible only to readableBy)
}

export interface Step {
  n: number;
  exchange: 'AS' | 'TGS' | 'AP';
  from: string;
  to: string;
  msg: string;
  blobs: Blob[];
  note: string;
}

const who: Record<Key, 'client' | 'tgs' | 'service'> = {
  Kc: 'client', Kc_tgs: 'client', Kc_svc: 'client', Ktgs: 'tgs', Ksvc: 'service',
};

export function flow(): Step[] {
  const b = (label: string, encWith: Key, contents: string[]): Blob => ({ label, encWith, readableBy: who[encWith], contents });
  return [
    {
      n: 1, exchange: 'AS', from: 'client', to: 'AS (KDC)', msg: 'AS-REQ',
      blobs: [b('pre-auth', 'Kc', ['timestamp']), b('cleartext', 'Kc', ['principal: alice', 'wants: TGT'])],
      note: 'Alice proves she knows her password by encrypting a fresh timestamp with Kc (derived from it). The password itself never goes on the wire.',
    },
    {
      n: 2, exchange: 'AS', from: 'AS (KDC)', to: 'client', msg: 'AS-REP',
      blobs: [b('for the client', 'Kc', ['session key Kc_tgs', 'TGT expiry']), b('TGT', 'Ktgs', ['alice', 'session key Kc_tgs', 'expiry'])],
      note: 'The AS returns a session key Kc_tgs sealed with Kc (only Alice can open it) plus the TGT — sealed with the TGS key, so it is OPAQUE to Alice; she just stores and relays it.',
    },
    {
      n: 3, exchange: 'TGS', from: 'client', to: 'TGS (KDC)', msg: 'TGS-REQ',
      blobs: [b('TGT (relayed)', 'Ktgs', ['alice', 'session key Kc_tgs', 'expiry']), b('authenticator', 'Kc_tgs', ['alice', 'timestamp']), b('cleartext', 'Kc_tgs', ['wants: http/server'])],
      note: 'Alice sends back the opaque TGT plus a fresh authenticator sealed with Kc_tgs. The TGS opens the TGT, learns Kc_tgs, and uses it to verify the authenticator — proving she holds the session key, not a replay.',
    },
    {
      n: 4, exchange: 'TGS', from: 'TGS (KDC)', to: 'client', msg: 'TGS-REP',
      blobs: [b('for the client', 'Kc_tgs', ['session key Kc_svc', 'ticket expiry']), b('service ticket', 'Ksvc', ['alice', 'session key Kc_svc', 'expiry'])],
      note: 'A new service session key Kc_svc sealed with Kc_tgs, plus a service ticket sealed with the SERVICE’s key — again opaque to Alice. No password was needed: the TGT did the work (single sign-on).',
    },
    {
      n: 5, exchange: 'AP', from: 'client', to: 'service', msg: 'AP-REQ',
      blobs: [b('service ticket (relayed)', 'Ksvc', ['alice', 'session key Kc_svc', 'expiry']), b('authenticator', 'Kc_svc', ['alice', 'timestamp'])],
      note: 'Alice presents the opaque service ticket and an authenticator sealed with Kc_svc. The service opens the ticket with its own key, learns Kc_svc, and verifies the authenticator — the KDC never had to be online for this step.',
    },
    {
      n: 6, exchange: 'AP', from: 'service', to: 'client', msg: 'AP-REP',
      blobs: [b('mutual auth', 'Kc_svc', ['timestamp + 1'])],
      note: 'Optional: the service returns the timestamp+1 sealed with Kc_svc, proving it could open the ticket — so Alice knows she’s talking to the real server, not an impostor. Mutual authentication.',
    },
  ];
}

/** Can `party` read this blob? (Only the holder of its key.) */
export const canRead = (blob: Blob, party: 'client' | 'tgs' | 'service'): boolean => blob.readableBy === party;
