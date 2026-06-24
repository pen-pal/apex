// WPA2 4-way handshake (IEEE 802.11i). Both the access point and your device already share
// a Pairwise Master Key (the PMK, derived from the Wi-Fi password). The handshake's job is
// to derive a fresh per-session Pairwise Transient Key (PTK) WITHOUT sending it, and to
// prove each side really holds the PMK. The AP sends a random ANonce; the station replies
// with its SNonce; now both sides have PMK + both nonces + both MAC addresses and compute
// the SAME PTK = PRF(PMK, "Pairwise key expansion", sorted MACs ‖ sorted nonces). A MIC
// (message integrity code keyed by part of the PTK) proves possession. Real HMAC; the
// derivation's properties (symmetry, freshness, secrecy) are tested. Real WPA2 uses an
// HMAC-SHA1 PRF; we use HMAC-SHA256 — the structure is identical.
import { hmacSha256 } from './hkdf';
import { hex } from './sha256';

const enc = (s: string) => new TextEncoder().encode(s);
const lo = (a: string, b: string) => (a <= b ? a : b);
const hi = (a: string, b: string) => (a <= b ? b : a);

/** PTK = PRF(PMK, label ‖ min(MACs) ‖ max(MACs) ‖ min(nonces) ‖ max(nonces)). The sorting
 *  is why both ends compute the same key regardless of who is AP vs station. */
export function derivePtk(pmk: string, apMac: string, staMac: string, aNonce: string, sNonce: string): string {
  const data = 'Pairwise key expansion' + lo(apMac, staMac) + hi(apMac, staMac) + lo(aNonce, sNonce) + hi(aNonce, sNonce);
  return hex(hmacSha256(enc(pmk), enc(data)));
}

/** The MIC over a handshake message, keyed by the KCK (first 16 bytes of the PTK). */
export function mic(ptk: string, message: string): string {
  return hex(hmacSha256(enc(ptk.slice(0, 32)), enc(message))).slice(0, 16);
}

export interface Msg { n: number; from: 'AP' | 'STA'; carries: string; apHasPtk: boolean; staHasPtk: boolean; note: string }
export interface Handshake { messages: Msg[]; apPtk: string; staPtk: string; match: boolean }

export function handshake(pmk: string, apMac: string, staMac: string, aNonce: string, sNonce: string): Handshake {
  const apPtk = derivePtk(pmk, apMac, staMac, aNonce, sNonce);
  const staPtk = derivePtk(pmk, apMac, staMac, aNonce, sNonce);
  const messages: Msg[] = [
    { n: 1, from: 'AP', carries: `ANonce = ${aNonce}`, apHasPtk: false, staHasPtk: false, note: 'AP sends its random nonce (no MIC yet — the station has no PTK to key one)' },
    { n: 2, from: 'STA', carries: `SNonce = ${sNonce} + MIC`, apHasPtk: false, staHasPtk: true, note: 'station now has both nonces → derives the PTK, and proves it with a MIC' },
    { n: 3, from: 'AP', carries: 'GTK (group key) + MIC', apHasPtk: true, staHasPtk: true, note: 'AP derives the same PTK, verifies the station’s MIC, and sends the group key' },
    { n: 4, from: 'STA', carries: 'ACK + MIC', apHasPtk: true, staHasPtk: true, note: 'station confirms — both sides install the PTK and encryption begins' },
  ];
  return { messages, apPtk, staPtk, match: apPtk === staPtk };
}
