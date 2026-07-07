<!-- Thanks for contributing to Apex. Keep the PR focused; explain the WHY, not just the what. -->

## What & why

<!-- One or two sentences: what does this change and why? Link any issue with "Closes #123". -->

## Type

- [ ] New section / protocol
- [ ] Fix (behavior, wire-accuracy, or UI)
- [ ] Refactor / cleanup
- [ ] Docs / chore

## Checklist

- [ ] `npm run typecheck` passes
- [ ] `npm run test:run` passes
- [ ] `npm run lint:slop` passes (no ERRORs)
- [ ] Any new model has a test whose expected values come from an **independent source** (RFC/FIPS/NIST vector,
      a paper, a reference impl, or a brute-force oracle) — not the code's own output
- [ ] Real bytes / real math — nothing faked to look plausible; RFC or paper cited in the file
- [ ] No hand-typed metrics (counts are derived via `npm run stats:write` or omitted)
- [ ] Comments and docs match the code as it is now; no dead scaffolding left behind
- [ ] New section is interactive where it can be (produce-and-break, not just watch)
- [ ] Commits are signed off (`git commit -s`, `Signed-off-by: pen-pal <unameme@protonmail.com>`) with no tool/AI
      attribution

## Screenshots / notes

<!-- For UI changes, drop before/after screenshots (both light and dark themes if relevant). -->
