// IPsec ESP (RFC 4303) — how a VPN encrypts and authenticates IP packets, in two modes. ESP wraps a
// packet with a header (SPI + sequence number), encrypts a payload, appends an integrity tag (ICV),
// and the receiver uses the SPI to look up the Security Association (SA) — the agreed key + algorithm —
// to undo it. The two modes differ in WHAT is protected and whether a new IP header is added:
//   • TRANSPORT mode (host↔host): encrypts just the upper-layer payload; the ORIGINAL IP header stays
//     in the clear (its protocol becomes 50 = ESP). Endpoints see who's talking, just not what's said.
//   • TUNNEL mode (gateway↔gateway, the classic VPN): encrypts the ENTIRE original IP packet — addresses
//     and all — and prepends a NEW outer IP header between the gateways. On the wire only the gateway
//     IPs show; the real source/destination are hidden inside the ciphertext.
// Honest crypto: the encrypted region is shown as opaque (we never invent plaintext bytes). Tested.

export type Mode = 'transport' | 'tunnel';

export interface SA { spi: number; peer: string; cipher: string } // a Security Association (one direction)
export type SADB = Record<number, SA>;

export interface Layer { label: string; detail: string; encrypted: boolean }

export interface EspPacket {
  mode: Mode;
  layers: Layer[]; // outer → inner, for the anatomy view
  observerSees: { src: string; dst: string }; // the IP header an on-path eavesdropper reads
  originalHidden: boolean; // are the real endpoints concealed?
  protects: string;
  nextHeader: string; // ESP trailer's Next Header field
  overheadBytes: number;
}

export interface Endpoints { origSrc: string; origDst: string; gwSrc: string; gwDst: string }

/** Build the ESP-protected packet for a mode. Encrypted layers are opaque — no plaintext is fabricated. */
export function encapsulate(mode: Mode, spi: number, seq: number, ep: Endpoints): EspPacket {
  const espHeader: Layer = { label: 'ESP header', detail: `SPI 0x${spi.toString(16).padStart(8, '0')} · seq ${seq}`, encrypted: false };
  const icv: Layer = { label: 'ICV (auth tag)', detail: '16-byte integrity tag over the packet — opaque', encrypted: false };

  if (mode === 'transport') {
    return {
      mode,
      layers: [
        { label: 'IP header (original)', detail: `${ep.origSrc} → ${ep.origDst} · proto 50 (ESP)`, encrypted: false },
        espHeader,
        { label: 'encrypted: payload + ESP trailer', detail: 'the TCP/UDP payload, padding, pad-length, next-header = 6 (TCP) — ciphertext', encrypted: true },
        icv,
      ],
      observerSees: { src: ep.origSrc, dst: ep.origDst }, // original IP header is in the clear
      originalHidden: false,
      protects: 'the upper-layer payload only; the original IP header (who is talking) is exposed.',
      nextHeader: 'TCP (6)',
      overheadBytes: 8 /*ESP hdr*/ + 16 /*ICV*/ + 4 /*trailer*/,
    };
  }
  return {
    mode,
    layers: [
      { label: 'IP header (NEW outer)', detail: `${ep.gwSrc} → ${ep.gwDst} · proto 50 (ESP)`, encrypted: false },
      espHeader,
      { label: 'encrypted: entire original IP packet + ESP trailer', detail: `the whole inner packet (${ep.origSrc} → ${ep.origDst} + payload), padding, next-header = 4 (IPv4) — ciphertext`, encrypted: true },
      icv,
    ],
    observerSees: { src: ep.gwSrc, dst: ep.gwDst }, // only the gateways are visible
    originalHidden: true,
    protects: 'the ENTIRE original IP packet, including the real source and destination addresses.',
    nextHeader: 'IPv4 (4)',
    overheadBytes: 20 /*new IP hdr*/ + 8 /*ESP hdr*/ + 16 /*ICV*/ + 4 /*trailer*/,
  };
}

/** The receiver demultiplexes an arriving ESP packet to its SA using the SPI (RFC 4303 §2.1). */
export function demux(sadb: SADB, spi: number): SA | null {
  return sadb[spi] ?? null;
}
