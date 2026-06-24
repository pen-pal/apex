// WebSocket (RFC 6455) — upgrading a plain HTTP connection into a full-duplex,
// message-framed channel. The client sends an HTTP GET with Upgrade: websocket and a
// random Sec-WebSocket-Key; the server proves it speaks WebSocket by replying 101 with
// Sec-WebSocket-Accept = base64( SHA-1( key + magic GUID ) ) — a fixed challenge that
// stops a confused HTTP cache/server from being tricked into the handshake. After that,
// messages travel as small frames (FIN, opcode, mask, length). Client→server frames are
// XOR-masked. The accept value is verified against the RFC 6455 §1.3 vector.
import { sha1 } from './sha1';

export const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export function base64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i], b = bytes[i + 1], c = bytes[i + 2];
    const n = (a << 16) | ((b ?? 0) << 8) | (c ?? 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    out += i + 1 < bytes.length ? B64[(n >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? B64[n & 63] : '=';
  }
  return out;
}

/** Sec-WebSocket-Accept = base64(SHA1(Sec-WebSocket-Key + GUID)). */
export function accept(key: string): string {
  return base64(sha1(new TextEncoder().encode(key + WS_GUID)));
}

export const OPCODES: Record<number, string> = { 0x0: 'continuation', 0x1: 'text', 0x2: 'binary', 0x8: 'close', 0x9: 'ping', 0xa: 'pong' };

/** XOR each payload byte with the 4-byte masking key (client→server frames). */
export function maskPayload(data: Uint8Array, key: Uint8Array): Uint8Array {
  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) out[i] = data[i] ^ key[i % 4];
  return out;
}

export interface Frame { fin: boolean; opcode: number; masked: boolean; len: number; bytes: Uint8Array }

/** Build a single WebSocket frame (payloads < 126 bytes for the demo). */
export function buildFrame(opcode: number, payload: Uint8Array, maskKey?: Uint8Array): Frame {
  const masked = !!maskKey;
  const header: number[] = [0x80 | (opcode & 0x0f)]; // FIN=1
  header.push((masked ? 0x80 : 0) | (payload.length & 0x7f));
  const body = masked ? maskPayload(payload, maskKey!) : payload;
  const bytes = Uint8Array.from([...header, ...(masked ? [...maskKey!] : []), ...body]);
  return { fin: true, opcode, masked, len: payload.length, bytes };
}
