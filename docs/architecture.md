# Architecture

Apex has one idea at its center:

> **A protocol is data.** Each protocol is a *description* — its fields, how to find the next layer, and optionally its behaviour. One generic engine reads those descriptions. "Support every protocol" becomes "add a registry entry," never "write new engine code."

This mirrors how Wireshark, Scapy, and Kaitai Struct work, and it's what keeps the project able to grow indefinitely without the core rotting.

## The pieces

```
            bytes ──►  ENGINE  ──►  DissectionNode tree  ──►  VIEWS
                          ▲                                     ▲
                          │                                     │
                       REGISTRY                              SimClock
                          ▲                                (one event stream
                          │                                 all views share)
                   ProtocolSpec[]  (src/protocols/*)
```

### `src/core/` — the generic engine (framework-agnostic, fully tested)
- **`types.ts`** — the contract. `ProtocolSpec`, `Field`, `ParsedHeader`, `DissectionNode`, `StateMachine`, `ConversationSpec`, `Registry`.
- **`bits.ts`** — `BitReader.readBits(n)` reads big-endian (network order). Exact to 48 bits (uses multiply-accumulate, not `<<`, so 32-bit sequence numbers don't overflow).
- **`checksum.ts`** — `inetChecksum` (RFC 1071) and `crc32` (IEEE 802.3). Verified against published vectors.
- **`format.ts`** — turns raw field values into human strings (IP, MAC, hex, flags, enums).
- **`registry.ts`** — `ProtocolRegistry`: register / get / list specs.
- **`engine.ts`** — `dissect(bytes, startId, registry)`: walks a spec's `fields` with the `BitReader`, computes the header length, bounds the payload with length fields, follows `next` to the child protocol, recurses. `describe()` pretty-prints the tree.
- **`builder.ts`** — the *generator* direction: `buildFrame(payload)` composes payload → TCP → IPv4 → Ethernet → +FCS using each spec's `encode()`. The same specs drive both directions.

### `src/protocols/` — the data
One file per protocol, each exporting a `ProtocolSpec`. `index.ts` registers them. This is the **only** place that knows what Ethernet/IPv4/TCP look like. Adding a protocol means adding a file here and one line in `index.ts`. See `protocol-spec.md`.

### `src/sim/clock.ts` — synchronization
`SimClock` is a tiny event bus. The four views subscribe to it; advancing the simulation emits one event that every view reacts to, so they never drift out of sync. (Phase 2 wires the views in; the contract exists now.)

### `src/web/` — the UI
React views rendered from the engine output. See `views.md`.

## How dissection works (the important invariant)
`dissect()` only ever does these generic steps:
1. read each field in `spec.fields` as bits,
2. ask the spec how long the header is (`headerBytes`) and how long the whole PDU is (`pduBytes`),
3. slice the payload, treat anything past the PDU as a trailer (this is how the Ethernet FCS stays out of the recovered data),
4. ask the spec for the child protocol id (`next`) and recurse.

It never branches on a protocol name. If a protocol needs something the engine can't express, the fix is a new *generic* hook on `ProtocolSpec`, not a special case.

## Encryption model (forward-looking)
Encryption fits the same "protocol is data" model and is built in phases:
- **TLS as a protocol** — its handshake is its `states` machine. The engine dissects the record/handshake structure up to the point where traffic becomes encrypted.
- **Honest opacity** — after the handshake, application data records are shown as what they are: a record header + length + an opaque ciphertext blob + auth tag. The byte view shows readable structure turning into noise. The engine does **not** pretend to see plaintext.
- **A real crypto sandbox** — a WebCrypto (AES-GCM) panel lets the learner encrypt/decrypt sandbox values to *see* real ciphertext and the avalanche effect. Decrypting a real captured TLS stream needs the session keys and is explicitly out of scope; never claim otherwise.
