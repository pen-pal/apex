// IEEE 802.1X — port-based network access control, the "you don't get on this LAN until you prove who
// you are" used by enterprise Wi-Fi (WPA2/3-Enterprise) and wired switch ports. Three roles: the
// SUPPLICANT (the device), the AUTHENTICATOR (the switch/AP guarding the port), and the AUTHENTICATION
// SERVER (RADIUS). Until authentication succeeds the port is UNAUTHORIZED — it passes only EAPOL frames,
// nothing else. The authenticator is a blind relay: it shuttles EAP messages between the supplicant
// (over EAPOL on the wire) and RADIUS (over the network), never seeing the actual credentials — only
// the RADIUS server decides. On EAP-Success the port flips to AUTHORIZED and normal traffic flows; on
// failure it stays shut. We model the message exchange, the EAPOL↔RADIUS translation, and the port
// state machine. Pure, tested.

export type Outcome = 'accept' | 'reject';
export type Role = 'supplicant' | 'authenticator' | 'radius';
export type Proto = 'EAPOL' | 'RADIUS';
export type Port = 'unauthorized' | 'authorized';

export interface Msg {
  n: number;
  from: Role;
  to: Role;
  proto: Proto; // EAPOL on the supplicant↔authenticator link, RADIUS on authenticator↔server
  label: string;
  port: Port; // the access port's state AFTER this message
  note: string;
}

/** The full EAP exchange. The authenticator translates EAPOL↔RADIUS; the port stays unauthorized
 *  until EAP-Success (only on accept). */
export function exchange(outcome: Outcome): Msg[] {
  const ok = outcome === 'accept';
  const steps: Omit<Msg, 'n' | 'port'>[] = [
    { from: 'supplicant', to: 'authenticator', proto: 'EAPOL', label: 'EAPOL-Start', note: 'device asks to authenticate; the port is still blocked to everything but EAPOL.' },
    { from: 'authenticator', to: 'supplicant', proto: 'EAPOL', label: 'EAP-Request/Identity', note: 'authenticator asks who you are.' },
    { from: 'supplicant', to: 'authenticator', proto: 'EAPOL', label: 'EAP-Response/Identity', note: 'device sends its identity (e.g. user@corp).' },
    { from: 'authenticator', to: 'radius', proto: 'RADIUS', label: 'Access-Request (EAP)', note: 'authenticator wraps the EAP message in RADIUS and forwards it — it is just a relay.' },
    { from: 'radius', to: 'authenticator', proto: 'RADIUS', label: 'Access-Challenge (EAP method)', note: 'server starts an EAP method (TLS/PEAP); credentials are validated here, never at the switch.' },
    { from: 'authenticator', to: 'supplicant', proto: 'EAPOL', label: 'EAP-Request (method challenge)', note: 'relayed back to the device over EAPOL. Several method round-trips happen here.' },
    { from: 'supplicant', to: 'authenticator', proto: 'EAPOL', label: 'EAP-Response (method reply)', note: 'device proves its credential (certificate / password inside a TLS tunnel).' },
    { from: 'authenticator', to: 'radius', proto: 'RADIUS', label: 'Access-Request (EAP)', note: 'forwarded to the server for the verdict.' },
    ok
      ? { from: 'radius', to: 'authenticator', proto: 'RADIUS', label: 'Access-Accept (+ EAP-Success, keys)', note: 'server accepts and ships the session key (MSK) to the authenticator.' }
      : { from: 'radius', to: 'authenticator', proto: 'RADIUS', label: 'Access-Reject (+ EAP-Failure)', note: 'server rejects — bad credential.' },
    ok
      ? { from: 'authenticator', to: 'supplicant', proto: 'EAPOL', label: 'EAP-Success', note: 'port flips to AUTHORIZED; normal traffic now flows (WPA2-Enterprise then runs the 4-way handshake from the MSK).' }
      : { from: 'authenticator', to: 'supplicant', proto: 'EAPOL', label: 'EAP-Failure', note: 'port stays UNAUTHORIZED; the device is kept off the network.' },
  ];
  return steps.map((s, i) => ({
    ...s,
    n: i + 1,
    port: (ok && s.label === 'EAP-Success') || (ok && i === steps.length - 1) ? 'authorized' : 'unauthorized',
  }));
}

/** Convenience: was the port opened? */
export const portAuthorized = (msgs: Msg[]): boolean => msgs[msgs.length - 1].port === 'authorized';
