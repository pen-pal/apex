// Silly Window Syndrome (SWS) — a TCP flow-control pathology where a connection degenerates into sending a
// flood of tiny segments, so almost all the bandwidth is wasted on packet headers instead of data. TCP's
// receiver advertises a "window": how much buffer space it has free. The bug appears when an application reads
// its received data very slowly — a byte or a few bytes at a time. Each little read frees a little space, the
// receiver dutifully advertises that tiny new window, and an eager sender immediately fires off a segment just
// big enough to fill it. The result: 1-byte payloads wrapped in 40 bytes of TCP/IP header — 40x overhead, the
// "silly window." Every full segment carries MSS (~1460) bytes of payload for the same 40-byte header, so the
// cure is to stop sending (or advertising) dribbles. Two coordinated fixes: the RECEIVER (Clark's algorithm)
// refuses to advertise a bigger window until it can offer at least a full MSS or half its buffer — it hides the
// small openings; and the SENDER (Nagle's algorithm) refuses to transmit a small segment while it still has
// unacknowledged small data outstanding, coalescing bytes into full segments instead. This models the transfer
// arithmetic: how segment size drives header overhead and goodput. Reference: RFC 813 (SWS avoidance); RFC 896
// (Nagle); RFC 1122.

export interface Transfer {
  segments: number;    // how many segments the payload is chopped into
  segSize: number;     // payload bytes per segment
  payload: number;     // useful bytes delivered
  headerBytes: number; // total header overhead
  wireBytes: number;   // bytes actually put on the wire (payload + headers)
  efficiency: number;  // goodput ratio = payload / wireBytes
}

/** Send `payload` bytes in segments of `segSize` payload each, with `header` bytes of overhead per segment. */
export function transfer(payload: number, segSize: number, header = 40): Transfer {
  const seg = Math.max(1, Math.floor(segSize));
  const segments = Math.ceil(payload / seg);
  const headerBytes = segments * header;
  const wireBytes = payload + headerBytes;
  return { segments, segSize: seg, payload, headerBytes, wireBytes, efficiency: wireBytes === 0 ? 1 : payload / wireBytes };
}

/** SWS scenario: a slow reader frees `readChunk` bytes at a time. Naive TCP sends readChunk-sized segments;
 *  with SWS avoidance the data is coalesced into full-MSS segments. */
export function scenario(payload: number, readChunk: number, mss = 1460, header = 40): { naive: Transfer; avoided: Transfer; speedup: number } {
  const naive = transfer(payload, readChunk, header);          // tiny segments driven by the slow reader
  const avoided = transfer(payload, mss, header);              // Clark + Nagle coalesce to full segments
  return { naive, avoided, speedup: naive.wireBytes / avoided.wireBytes };
}
