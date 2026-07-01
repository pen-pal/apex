# Apex

**A live, interactive way to _see_ how computers actually work** — not from static diagrams you have to
synchronize in your head, but from ~250 hands-on visualizations you can poke, drag, and break.

Type a message and watch it become bytes and travel the wire. Flood a hash table and watch O(1) collapse to
O(n²). Splay a tree, race a coordinator crash through two-phase and three-phase commit, poison a DNS cache and
watch source-port randomization defend it, add two numbers that are still encrypted. Every section is a small,
**tested, spec-anchored model** with an interactive view — no hand-waving, no faked outputs.

Guiding principles:

- **The bytes (and the math) are real.** Real checksums, real CRC-32, RFC-accurate fields, published crypto
  test vectors, capture-anchored tests. Nothing is faked to look plausible.
- **A protocol is data, not code.** The network dissector reads a small `ProtocolSpec` per protocol, so adding
  one is adding a file — never rewriting the engine.
- **Every model is verified.** Each section ships a pure, framework-free model with its own test suite;
  models are checked against the RFC/paper/reference implementation, not against their own output.

## What's inside (~250 interactive sections across 10 areas)

- **Network basics** — build a real Ethernet/IPv4/TCP frame from your text and follow it byte-by-byte across
  the stack; ARP, switching, NAT, DHCP, subnetting, the on-the-wire signal, 90+ protocols + `.pcap` import.
- **Routing & naming** — BGP best-path & route reflectors, OSPF, distance-vector, DNS, DNSSEC, **DNS cache
  poisoning (Kaminsky)**, MPLS, VXLAN, VRRP, ECMP, IPsec.
- **Transport & web** — the TCP handshake & state machine, congestion control (CUBIC/BBR), flow control,
  QUIC vs TCP, **QUIC connection migration**, **0-RTT resumption & replay**, HTTP/2 & /3, WebSockets, CDNs.
- **Cryptography** — AES rounds, AEAD, Diffie–Hellman, RSA/ECC/ECDSA/EdDSA, Schnorr ZK, Merkle trees, the
  double ratchet, **VRFs**, **oblivious transfer**, **Paillier homomorphic encryption**, **Feldman VSS**,
  Shamir/threshold, post-quantum (NTT), blind signatures.
- **Security & web** — CORS, CSP, cookies, request smuggling, SSRF, clickjacking, HSTS, **open redirect**,
  **hash flooding**, **ReDoS**, **subdomain takeover**, site isolation, WebAuthn.
- **Data & encoding** — Huffman, arithmetic & **Golomb-Rice** coding, LZ77/LZW, BWT, move-to-front,
  **varint/zigzag**, **content-defined chunking**, CRC-32, Reed–Solomon, Viterbi.
- **Distributed systems** — Raft, Paxos, PBFT, vector/Lamport clocks, CRDTs, gossip, quorums, 2PC &
  **3PC**, **chain replication**, **hinted handoff**, SWIM, **stream watermarks**, **HdrHistogram** percentiles.
- **Storage, databases & algorithms** — B+trees, LSM, MVCC, WAL, query planning; and a deep algorithms track:
  sorting, quickselect, KMP/Boyer–Moore/Aho–Corasick/**Manacher**, suffix arrays, max-flow, MST, Dijkstra/
  **Bellman-Ford**, Floyd–Warshall, DP, FFT, **the alias method**, **k-d trees**, tries, skip lists, **splay
  trees**, AVL, union-find.
- **Systems & OS** — CPU pipeline & branch prediction, MESI, x86-TSO, virtual memory & page-table walks, TLB,
  copy-on-write, NUMA first-touch, CPU scheduling/CFS, **epoll & C10k**, **futex**, **io_uring**, **Lamport's
  bakery**.
- **Operations & SRE** — deployment strategies, health checks, autoscaling, SLOs & error budgets, load
  shedding, idempotency, distributed tracing, feature flags, graceful shutdown, single-flight, chaos.

Plus **guided journeys** (curated end-to-end walks like "How an HTTPS page loads", "Inside the CPU", "Build a
database") and a global filterable catalog. **Dark mode** toggle in the top bar.

## Quick start

```bash
npm install
npm run dev             # start the UI at http://localhost:5173
npm run test:run        # run the full test suite (2300+ tests)
npm run typecheck       # tsc --noEmit
npm run demo            # CLI: build a real frame from "Hi" and dissect it back
npm run demo -- "GET /" # try your own message
```

`npm run demo` builds a real Ethernet/IPv4/TCP frame from your message — with real checksums and a real
CRC-32 FCS, padded to the 64-byte Ethernet minimum — then dissects those bytes back and recovers your message,
proving nothing is faked.

## Layout

```
src/core/        the generic dissection engine (types, bit reader, checksums, dissect, build)
src/protocols/   the DATA: one ProtocolSpec per protocol — adding a protocol is a file here
src/web/         the React UI — one tested model (.ts) + one view (*Section.tsx) per topic
tests/           vitest — every protocol and every model ships an anchored test
docs/            architecture.md · protocol-spec.md · views.md
```

Each non-network section follows the same shape: a **pure, dependency-free model** in `src/web/<topic>.ts`
(with `tests/<topic>.test.ts` anchored to the reference), a **view** in `src/web/<Topic>Section.tsx`, and one
line of wiring. Models never import React, so they run in the CLI and the browser alike.

## Contributing

The bar is simple and strict: a new section is a **tested model + a view**, and the model is validated against
the source of truth (an RFC, a paper, a published test vector, or a brute-force reference), not against itself.
Keep `src/core/` free of protocol-specific knowledge — the engine stays generic. See
**docs/protocol-spec.md** to add a protocol and **docs/architecture.md** for the design.

## Tech & CI

TypeScript + React + Vite, tested with vitest — a fully static client-side app, no backend (the engine and
crypto run in the browser). CI runs the test suite and **CodeQL** code scanning
(`.github/workflows/codeql.yml`) on every push and PR; a deploy workflow publishes to GitHub Pages.

## What it is and isn't

It builds and dissects real bytes, and runs real algorithms and crypto, for **teaching**. It is not a packet
injector or a traffic tool. For encrypted protocols (TLS, QUIC, WireGuard, ESP) it shows the cleartext header
and leaves the encrypted body genuinely opaque — it never claims to decrypt a real captured stream, which
would need session keys and is out of scope. The crypto sandbox operates on sandbox values only.

## License

MIT.
