#!/usr/bin/env node
// Measure the repo's real numbers so the README/badges are never asserted from thin air.
// Run: node scripts/stats.mjs   (or: npm run stats)
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const sectionsTs = readFileSync(join(root, 'src/web/sections.ts'), 'utf8');
const sections = (sectionsTs.match(/^\s*\{ id: '/gm) || []).length;
const groups = (sectionsTs.match(/label: '[^']+', icon: '[^']+', ids:/g) || []).length;

const testDir = join(root, 'tests');
const testFiles = readdirSync(testDir).filter((f) => f.endsWith('.test.ts'));
let testCases = 0;
for (const f of testFiles) {
  const src = readFileSync(join(testDir, f), 'utf8');
  testCases += (src.match(/\b(it|test)\s*\(/g) || []).length; // it()/test() blocks (a floor; suite reports the exact pass count)
}

// Guided stories: section components using the narrated GuidedStory engine. Measured so "N of M" is never asserted.
const webDir = join(root, 'src/web');
const guidedStories = readdirSync(webDir)
  .filter((f) => f.endsWith('.tsx'))
  .filter((f) => /from '\.\/GuidedStory'/.test(readFileSync(join(webDir, f), 'utf8'))).length;

const stats = { sections, groups, testFiles: testFiles.length, testCases, guidedStories };
console.log(JSON.stringify(stats, null, 2));
console.log(`\n${sections} sections across ${groups} areas · ${testFiles.length} test files · ${testCases}+ test cases`);
console.log(`${guidedStories} of ${sections} sections have a narrated guided story (cinematic rollout in progress).`);
console.log('For the exact passing count, run: npm run test:run  (CI runs the full suite on every push).');

// `--write` regenerates the drift-prone counts in README.md from these measurements, so the numbers
// are never hand-asserted (anti-slop rule 1). Idempotent: re-run after adding sections/areas.
if (process.argv.includes('--write')) {
  const readmePath = join(root, 'README.md');
  const before = readFileSync(readmePath, 'utf8');
  const after = before
    .replace(/sections-\d+-/g, `sections-${sections}-`) // the shields.io badge
    .replace(/\*\*\d+ interactive sections across \d+ areas\*\*/g, `**${sections} interactive sections across ${groups} areas**`)
    .replace(/\*\*\d+ hands-on[^*]*visualizations\*\*/g, `**${sections} hands-on visualizations**`); // title tagline
  if (after !== before) { writeFileSync(readmePath, after); console.log(`\nREADME.md regenerated → ${sections} sections, ${groups} areas.`); }
  else console.log('\nREADME.md already current.');
  // index.html meta + package.json description carry the same count — keep them in lockstep so no two
  // files ever disagree (rule 1: the same number must never appear with two different values).
  for (const rel of ['index.html', 'package.json']) {
    const p = join(root, rel);
    const b = readFileSync(p, 'utf8');
    const a = b.replace(/\b\d+( (?:live|tested)[^"]{0,50}?visualizations)/g, `${sections}$1`);
    if (a !== b) { writeFileSync(p, a); console.log(`${rel} regenerated → ${sections}.`); }
  }
}

export default stats;
