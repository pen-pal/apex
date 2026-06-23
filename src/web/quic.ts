// QUIC vs TCP+TLS — how many round trips before the first application data flows.
// The headline win of QUIC (RFC 9000/9001) is folding the transport and crypto
// handshakes together: TCP+TLS 1.3 spends one RTT on the TCP handshake and another
// on TLS before data; QUIC does it in one combined RTT, or ZERO on resumption
// (0-RTT) by reusing a cached secret. We model each as an ordered list of one-way
// messages and count completed round trips to first app data. Pure, tested.

export type Side = 'client' | 'server';
export interface Msg {
  from: Side;
  label: string;
  rtt: number; // which round trip (0-based) this message belongs to
  appData?: boolean; // does this message carry the first application data?
  note: string;
}

export interface Scenario {
  id: string;
  name: string;
  rttToFirstData: number; // round trips before the client's first app data is sent
  messages: Msg[];
}

/** TCP three-way handshake, then a TLS 1.3 handshake, then HTTP — two RTTs of setup. */
export function tcpTls(): Scenario {
  return {
    id: 'tcp-tls', name: 'TCP + TLS 1.3', rttToFirstData: 2,
    messages: [
      { from: 'client', label: 'SYN', rtt: 0, note: 'TCP handshake begins — no data may be sent yet.' },
      { from: 'server', label: 'SYN-ACK', rtt: 0, note: 'Server agrees to the connection.' },
      { from: 'client', label: 'ACK + ClientHello', rtt: 1, note: 'TCP is established; only now can the TLS handshake start (ClientHello piggybacks the ACK).' },
      { from: 'server', label: 'ServerHello … Finished', rtt: 1, note: 'TLS 1.3 server flight: key share, certificate, Finished — all encrypted from EncryptedExtensions on.' },
      { from: 'client', label: 'Finished + GET /', rtt: 2, appData: true, note: 'Client Finished completes TLS; the first HTTP request goes out — 2 full RTTs after the first packet.' },
    ],
  };
}

/** QUIC 1-RTT: the transport + TLS handshake are combined into a single round trip. */
export function quic1Rtt(): Scenario {
  return {
    id: 'quic-1rtt', name: 'QUIC (1-RTT)', rttToFirstData: 1,
    messages: [
      { from: 'client', label: 'Initial: ClientHello', rtt: 0, note: 'QUIC carries the TLS ClientHello inside its very first packet — transport and crypto start together.' },
      { from: 'server', label: 'Initial + Handshake: ServerHello … Finished', rtt: 0, note: 'Server returns its TLS flight in the same round trip; there is no separate transport handshake.' },
      { from: 'client', label: 'Finished + GET /', rtt: 1, appData: true, note: 'Client Finished + the first request — 1 RTT after the first packet, half of TCP+TLS.' },
    ],
  };
}

/** QUIC 0-RTT: a resumed connection sends application data in the very first packet. */
export function quic0Rtt(): Scenario {
  return {
    id: 'quic-0rtt', name: 'QUIC (0-RTT resumption)', rttToFirstData: 0,
    messages: [
      { from: 'client', label: 'Initial + 0-RTT: ClientHello + GET /', rtt: 0, appData: true, note: 'On a resumed session the client reuses a cached secret to encrypt a request in the FIRST packet — zero round trips of waiting.' },
      { from: 'server', label: 'ServerHello … Finished + response', rtt: 0, note: 'Server confirms the handshake and can answer immediately. (0-RTT data is replayable, so it is limited to safe, idempotent requests.)' },
    ],
  };
}

export function allScenarios(): Scenario[] {
  return [tcpTls(), quic1Rtt(), quic0Rtt()];
}

// ---- Transport-layer head-of-line blocking (one lost packet) -----------------

export interface HolResult {
  protocol: 'TCP' | 'QUIC';
  lostStream: number;
  stalledStreams: number[]; // which streams are blocked waiting for the retransmit
  note: string;
}

/**
 * One packet carrying stream `lostStream` is dropped while `streams` are in
 * flight. TCP delivers one ordered byte stream, so ALL streams stall until the
 * retransmit. QUIC delivers each stream independently, so only the lost one stalls.
 */
export function headOfLine(protocol: 'TCP' | 'QUIC', streams: number[], lostStream: number): HolResult {
  if (protocol === 'TCP') {
    return { protocol, lostStream, stalledStreams: streams.slice(), note: 'TCP is a single ordered stream: the receiver must hold every later byte — from every multiplexed stream — until the missing segment is retransmitted.' };
  }
  return { protocol, lostStream, stalledStreams: [lostStream], note: 'QUIC streams are delivered independently, so only the stream that lost a packet waits; the others keep flowing.' };
}
