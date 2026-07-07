# Contributing to Apex

Apex is a live, interactive simulator for how computers actually work: you type real input and watch it become
bytes, get wrapped layer by layer, cross the wire, and get unwrapped again — across protocols, data structures,
crypto, and systems, with the bytes and the math kept real. Contributions are welcome; this page is the short
version of how the project stays honest.

## Setup

```bash
npm install
npm run dev        # Vite dev server — the UI
npm run demo       # CLI: build a frame from a message and dissect it back
npm run test:run   # run the vitest suite once
npm run typecheck  # tsc --noEmit
```

## The one idea to protect

**A protocol (and a section) is data, not code.** Each protocol is a `ProtocolSpec` describing its fields and how to
find the next layer; one generic engine reads those descriptions. `src/core/` must contain **zero** protocol-specific
knowledge. Adding a protocol is a new file in `src/protocols/` plus one line in `index.ts` — never new engine code.
Sections are registered the same way: one row in a `src/web/sections/` chunk plus a `sections.ts` entry.

## Adding a section or protocol

1. Write the model in its own `.ts` file — the real computation, no UI.
2. Write `tests/<id>.test.ts` whose expected values come from an **independent source** — an RFC/FIPS/NIST vector, a
   published paper, a reference implementation, or a brute-force oracle written to *different* logic. Never assert the
   code against its own output, and never re-state the model's own formula using its own constants.
3. Build the view. Prefer **interactive**: let the reader *produce and break* the insight, not just watch it.
4. Register it (chunk row + `sections.ts`), and cite the RFC/paper in a top-of-file comment.
5. Gate it: `npm run typecheck`, `npm run test:run`, and `npm run lint:slop` must all pass.

## Non-negotiables

- **Real bytes, real math.** Checksums, CRC-32, field layouts, and crypto match their specs and published vectors.
  Nothing is faked to look plausible. After a TLS handshake, application data is shown as an opaque encrypted record,
  not invented plaintext.
- **No hand-typed metrics.** Counts and figures are derived (`npm run stats:write`) or omitted — never typed by hand.
- **Comments and docs describe the code as it is now.** A stale comment is a bug.
- **No dead scaffolding.** If it isn't wired in and used, it doesn't get committed.

See [`CLAUDE.md`](../CLAUDE.md) and `docs/` for the full engineering rules and the `ProtocolSpec` authoring guide.

## Commits & pull requests

- Keep commits focused; write a message that explains the *why*, not just the *what*.
- **Sign off every commit** with `Signed-off-by: pen-pal <unameme@protonmail.com>` (`git commit -s`), and do not add
  any tool/AI attribution or co-author lines.
- Before opening a PR: typecheck, full test suite, and the anti-slop linter all green. Fill in the PR checklist.

## Code of conduct

Participation is governed by the [Code of Conduct](CODE_OF_CONDUCT.md).
