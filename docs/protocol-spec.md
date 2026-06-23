# Authoring a protocol

A protocol is a `ProtocolSpec` (defined in `src/core/types.ts`). The engine reads it; you never touch the engine to add a protocol.

## The shape

```ts
interface ProtocolSpec {
  id: string;            // 'udp'
  name: string;          // 'UDP'
  layer: number;         // OSI-ish number, for grouping (4 = transport)
  summary: string;       // one-line teaching summary
  fields: Field[];       // the header, top to bottom
  next?:  (h, registry) => string | null;   // which protocol is inside?
  headerBytes?: (h) => number;              // variable header length (e.g. IHL*4)
  pduBytes?:    (h) => number;              // total PDU length if a length field says so
  encode?: (ctx) => number[];               // build this header (generator direction)
  states?: StateMachine;                    // behaviour view
  conversation?: ConversationSpec;          // sequence view
}
```

### `Field`
```ts
interface Field {
  name: string;          // 'srcPort'
  label: string;         // 'Source port'
  bits: number;          // width in BITS (sub-byte fields are fine)
  type?: 'uint' | 'hex' | 'ipv4' | 'mac' | 'enum' | 'flags';
  enumMap?: Record<number, string>;   // for 'enum'
  flagBits?: string[];                // for 'flags'; index 0 = most-significant bit
  decode?: (value, header) => string; // custom human meaning (can read sibling fields)
  endian?: 'le';                      // read this byte-aligned field little-endian (e.g. SMB2); default big-endian
  note?: string;                      // short teaching note
  desc?: string;                      // one-paragraph plain explanation (shown in the byte view)
  detail?: string;                    // deep-dive teaching text (multi-line; \n preserved)
}
```

Rules that keep the bytes honest:
- Widths are **bits**, in order. The field widths of a header must sum to its byte length × 8.
- Multi-byte values are big-endian (network order). `flagBits[0]` is the most-significant bit.
- `headerBytes` is required when the header is variable length. `pduBytes` is required when a length field bounds the whole PDU (so trailing bytes — FCS, padding — don't leak into the payload).
- `next` returns the child protocol's `id`, or `null` to stop. Returning an id that isn't registered yet is fine — the engine stops gracefully and it's ready when that protocol lands.

## Worked examples in the tree
- **`src/protocols/ipv4.ts`** — sub-byte fields (version/IHL), `enum` (protocol), `flags`, `headerBytes` from IHL, `pduBytes` from total length, a real header-checksum `encode`.
- **`src/protocols/tcp.ts`** — an 8-bit `flags` field, port-based `next` dispatch, a full `states` machine, a `conversation` script, and a checksum that covers the pseudo-header.
- **`src/protocols/ethernet.ts`** — fixed header, `enum` EtherType dispatch; note the FCS is a frame trailer, not part of this header.

## Recipe: add a protocol
1. Find the authoritative **RFC**. Note its number.
2. Copy the closest existing spec as a starting point.
3. Transcribe every field from the RFC (name, bits, order). Add `enumMap`/`flagBits`/`type` as needed.
4. Add `headerBytes`/`pduBytes` if the format needs them; add `next` for the child; add `states`/`conversation` if there's behaviour worth showing.
5. Write clear `summary` and `note`s — a learner reads these. For richer teaching, add `desc` (a one-paragraph explanation) and `detail` (a deep-dive) per field; the byte view shows `desc` inline and `detail` behind a "Deep dive" expander. Every claim must be RFC-accurate — never fabricate.
6. Register it in `src/protocols/index.ts`.
7. Add `tests/<id>.test.ts` that dissects a **real or hand-verified** byte array and asserts the fields. Anchor assertions to the RFC/capture, not to your own output.
8. `npm run test:run`, then double-check it against the RFC.
