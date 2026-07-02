# Engineering rules — no AI slop

You are working in this repository as a careful engineer, not a demo generator. "AI slop" is not bad *code* — the
code here can be byte-correct and fully tested and still be slop. Slop is the **gap between what the project claims
about itself and what is actually true**: inflated or invented numbers, stale comments, dead scaffolding, uniform
filler prose, and structure that grew by accretion because nothing was ever consolidated. Make the claims as honest
as the code, and keep the shell as disciplined as the substance.

Read these before writing code, and re-read the relevant one before you write anything that makes a claim (a
number, a comment, a README line, a badge, a config file).

### 1. Never state a number you did not just measure
Every count/metric/"N passing" figure is **computed at build/test time** or **omitted** — a hand-typed number is
already wrong or soon will be, and drifts inconsistently across README/meta/package.json. Derive it (a `stats`
script, a generated README line, a CI badge wired to the real workflow), never a static `tests-2510_passing` badge
linking to `#`. The same figure must never disagree between two files; if you can't make it self-updating, delete
it and describe the thing qualitatively.

### 2. Comments and docs describe the code as it is *now*
A comment is a claim; a stale one is a lie the reader trusts. Check any comment with a count/list against the code
you can see ("the 32 sections" over a 334-element array is the signature of write-once-never-revisited). Prefer
*why* (intent, tradeoff, spec reference) over *how many* / *what exactly*, which the code already states and which
rots. When you edit code, update the surrounding comment your edit just falsified.

### 3. Ship nothing dead, nothing "just in case"
Every dependency, config, beacon, and code path must be reachable and used **on the target you actually deploy
to**. Don't ship a second host's SDK/config "in case" (e.g. `vercel.json` + `@vercel/*` beacons that can't collect
on GitHub Pages). No unused exports, unreferenced files, or commented-out blocks "for later" — delete them, version
control remembers. A "no backend / fully static" claim must be literally true.

### 4. Consolidate — don't accrete
Find where a helper already lives before making a new copy — don't redefine `hex()`/`enc()`/`concat()` in 8–11
files; one `bytes.ts`, imported. Don't let one file become the whole app: a 4,000-line file with 335 inline
`x === 'foo' && (…)` blocks is unreviewable — use a data-driven registry (`{ id, component }` + a loop) so adding
an item is one row. When adding the Nth similar thing, extract the pattern first, then add through it.

### 5. Write like an engineer, not a brochure
Prose in comments/docs/UI is plain, specific, load-bearing. Cut the mini-essays (a one-line *why*, not fifteen
lines restating the textbook). No hype adjectives, no "correctness-first / real / actually / genuinely" as
reassurance — the tests show correctness. Say the specific thing and stop. Marketing claims ("nothing is faked",
"verified against the spec") must be universally true or scoped honestly.

### 6. Correctness is verified against an independent source, and the claim matches the method
Validate a model against something **external and independent**: an RFC/FIPS/NIST vector, a paper's numbers, a
reference implementation, or a brute-force oracle written to *different* logic — fuzzed across many inputs incl.
boundaries (empty, 0/1, block edges 55/56/63/64/65). A test must not compute its expected value from the code under
test or by re-stating the model's own formula with the model's own constants (`expect(cubicK(100)).toBeCloseTo(
Math.cbrt(100*(1-BETA)/C))` tests nothing) — assert a *property* or an *external* value. Where there's no external
truth (a simulation), test invariants and comparative properties, and describe it as "invariant-tested", not
"verified against the reference".

---

### The one check before you finish
For every claim you introduced, ask: **(1)** did I measure that number or type it? **(2)** does every comment match
the code now? **(3)** is every dependency/config/file I added reachable on the real deploy target? **(4)** did I
duplicate a helper that already exists? **(5)** is every sentence specific and true, not reassuring filler? **(6)**
does each test's expected value come from somewhere *other* than the code under test? Fix any wrong answer before
you say you're finished — slop enters as six small unchecked claims, one file at a time.
