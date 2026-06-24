// TCP Fast Open (RFC 7413) — shaving the handshake round-trip off repeat connections. Normal TCP
// makes you complete SYN → SYN-ACK → ACK before you may send a byte, so a short request pays a full
// RTT of pure setup latency. TFO lets the client put request DATA right in the SYN. The danger is that
// a SYN's source address is unverified, so accepting data + replying to a spoofed SYN is an
// amplification weapon. The fix is a COOKIE: on the first visit the server hands the client an
// encrypted token bound to its IP (a normal handshake, no savings yet); on later visits the client
// echoes the cookie alongside data in the SYN, the server validates it (proving the client received
// it at that IP before) and answers immediately — one RTT saved. A bad/missing cookie just falls back
// to a normal handshake. We model the packet exchange and the round-trip cost. Pure, tested.

export interface TfoStep { from: 'client' | 'server'; label: string; carriesData: boolean }
export interface Conn { mode: string; steps: TfoStep[]; responseMs: number; savedMs: number; cookie: boolean }

/** Plain TCP: full handshake before the request, response arrives 2 RTT after the SYN. */
export function normal(rttMs: number): Conn {
  return {
    mode: 'normal TCP',
    steps: [
      { from: 'client', label: 'SYN', carriesData: false },
      { from: 'server', label: 'SYN-ACK', carriesData: false },
      { from: 'client', label: 'ACK + request', carriesData: true }, // data only after the handshake
      { from: 'server', label: 'response', carriesData: true },
    ],
    responseMs: 2 * rttMs, // 1 RTT handshake + 1 RTT request/response
    savedMs: 0,
    cookie: false,
  };
}

/** First TFO connection: a normal handshake that ALSO returns a cookie for next time. No RTT saved yet. */
export function firstTfo(rttMs: number): Conn {
  return {
    mode: 'TFO — first visit (get cookie)',
    steps: [
      { from: 'client', label: 'SYN (TFO cookie request)', carriesData: false },
      { from: 'server', label: 'SYN-ACK (cookie)', carriesData: false },
      { from: 'client', label: 'ACK + request', carriesData: true },
      { from: 'server', label: 'response', carriesData: true },
    ],
    responseMs: 2 * rttMs,
    savedMs: 0,
    cookie: true, // client now holds a cookie
  };
}

/** Repeat TFO: data rides in the SYN. Valid cookie → 0-RTT data, response in ONE RTT; invalid → fallback. */
export function repeatTfo(rttMs: number, cookieValid: boolean): Conn {
  if (!cookieValid) {
    return {
      mode: 'TFO — bad cookie (fallback)',
      steps: [
        { from: 'client', label: 'SYN (stale cookie + data)', carriesData: true },
        { from: 'server', label: 'SYN-ACK (cookie ignored, data dropped)', carriesData: false },
        { from: 'client', label: 'ACK + request (resent)', carriesData: true },
        { from: 'server', label: 'response', carriesData: true },
      ],
      responseMs: 2 * rttMs, // no savings — server fell back to a normal handshake
      savedMs: 0,
      cookie: true,
    };
  }
  return {
    mode: 'TFO — repeat visit (0-RTT data)',
    steps: [
      { from: 'client', label: 'SYN (cookie + request data)', carriesData: true }, // request travels in the SYN
      { from: 'server', label: 'SYN-ACK + response', carriesData: true }, // server validates cookie, answers at once
    ],
    responseMs: rttMs, // the whole handshake RTT is saved
    savedMs: rttMs,
    cookie: true,
  };
}
