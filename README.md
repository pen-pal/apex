# Apex

**A live, interactive way to *see* how networks actually work.** Type real text (or load a real capture) and watch it become bytes, get wrapped layer by layer, travel the wire through a router, and get unwrapped again — across **80+ protocols**, from Ethernet to TLS to QUIC, with encryption shown honestly.

It exists because learning a protocol from static diagrams forces you to synchronize them in your head — the byte layout, the handshake, the state machine, the encapsulation. Apex does that synchronization for you, live.

It's built on one idea: **a protocol is data, not code.** Each protocol is a small description the engine reads, so adding one means adding a file — never rewriting the engine. The bytes are real: real checksums, real CRC-32, RFC-accurate fields, capture-anchored tests.

## What you can do

- **Byte anatomy** — a clickable hex grid where every byte is coloured by the field that owns it; click any byte for a bit-level breakdown and a deep dive into *why* it's there.
- **Packet story** — one timeline that steps a packet through its whole life (encapsulate → on the wire → through a router → decapsulate), with the byte strip, the layer stack, and a plain-English narration all moving together.
- **Journey** — the encapsulation animated: your message wrapped by each layer, the on-the-wire signal, the router re-wrap, then peeled back.
- **Connection lifecycle** — the TCP state machine and 3-way-handshake-to-teardown sequence, with seq/ack numbers that update live with your payload.
- **Checksum walkthrough** — the IPv4 header checksum computed step by step (RFC 1071), proving the value is genuine.
- **Crypto sandbox** — real WebCrypto AES-256-GCM: encrypt a value, see the opaque ciphertext + auth tag, and the avalanche effect (flip one bit → half the tag changes). Ciphertext is always shown as opaque; it never claims to decrypt a real stream.
- **Examples + .pcap / .pcapng import** — load 70+ real example captures (DNS, TLS, VXLAN-in-VXLAN, a PPPoE→PPP→IP DSL chain, SMB2, QUIC, …) or drop in your own capture file and dissect every packet.

## Quick start

```bash
npm install
npm run dev             # start the UI at http://localhost:5173
npm run test:run        # run the test suite
npm run demo            # CLI: build a frame from "Hi" and dissect it back
npm run demo -- "GET /" # try your own message
```

`npm run demo` builds a real Ethernet/IPv4/TCP frame from your message — with real checksums and a real CRC-32 FCS — then dissects those bytes back through the stack and recovers your message, proving nothing is faked.

## Layout

```
src/core/        the generic engine (types, bit reader, checksums, dissect, build)
src/protocols/   the data: one ProtocolSpec per protocol — adding a protocol is a file here
src/sim/         the SimClock that keeps views in sync
src/web/         the React UI (the views above)
tests/           vitest — every protocol ships a capture-anchored test
docs/            architecture.md · protocol-spec.md · views.md
```

To add a protocol, see **docs/protocol-spec.md**; for the design, **docs/architecture.md**.

## Deploy (GitHub Pages)

The app is a static client-side SPA (no backend — the dissection engine and crypto run in the browser). A GitHub Actions workflow (`.github/workflows/deploy.yml`) builds and publishes to Pages on every push to `main`.

1. In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Push to `main`; the workflow runs the tests, builds, and deploys.
3. The site is served from `/apex/` (the Vite `base`), e.g. `https://<user>.github.io/apex/`.

## What it is and isn't

It builds and dissects real bytes for **teaching**. It is not a packet injector or a traffic tool. For encrypted protocols (TLS, QUIC, WireGuard, ESP) it shows the cleartext header and leaves the encrypted body genuinely opaque — it never claims to decrypt a real captured stream, which would need session keys and is out of scope.
