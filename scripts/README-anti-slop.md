# Anti-slop enforcement

Three layers, from advisory to blocking:

1. **CLAUDE.md** — the rules Claude Code reads automatically at the repo root. Governs the
   judgment calls a linter can't make (prose quality, honest scoping of claims).
2. **scripts/anti-slop.mjs** — dependency-free linter. `node scripts/anti-slop.mjs`.
   ERRORs (fail CI): fake metric badges, "no backend" vs shipped telemetry, dead deps,
   files over 800 lines. WARNs (review only): drifting counts, duplicated utils, monolith
   dispatch, hype prose, tests that recompute their own formula.
3. **CI + pre-push hook** — `.github/workflows/anti-slop.yml` runs it on every push/PR;
   `.githooks/pre-push` catches ERRORs before they leave your machine.

## Install
```bash
cp -r scripts .github .githooks CLAUDE.md <your-repo>/
cd <your-repo>
git config core.hooksPath .githooks        # enable the pre-push hook
npm pkg set scripts.lint:slop="node scripts/anti-slop.mjs"   # optional npm alias
node scripts/anti-slop.mjs                  # try it
```

## Tune
Edit the `CONFIG` block at the top of `scripts/anti-slop.mjs`: source dirs, the 800-line
limit, the util-name and dependency allowlists, hype phrases. Every threshold is one place.

## Honest limits
It catches *shapes*, not meaning. It cannot know a comment's count is wrong (only that one
exists — R2 is a WARN), nor that a dependency imported-but-useless-on-your-host is dead
(R3's dead-dep check is import-based; the claim/telemetry check covers the common case).
The judgment calls stay in CLAUDE.md and code review.
