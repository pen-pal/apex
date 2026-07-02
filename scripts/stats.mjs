#!/usr/bin/env node
// Measure the repo's real numbers so the README/badges are never asserted from thin air.
// Run: node scripts/stats.mjs   (or: npm run stats)
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const sectionsTs = readFileSync(join(root, 'src/web/sections.ts'), 'utf8');
const sections = (sectionsTs.match(/^\s*\{ id: '/gm) || []).length;

const testDir = join(root, 'tests');
const testFiles = readdirSync(testDir).filter((f) => f.endsWith('.test.ts'));
let testCases = 0;
for (const f of testFiles) {
  const src = readFileSync(join(testDir, f), 'utf8');
  testCases += (src.match(/\b(it|test)\s*\(/g) || []).length; // it()/test() blocks (a floor; suite reports the exact pass count)
}

const stats = { sections, testFiles: testFiles.length, testCases };
console.log(JSON.stringify(stats, null, 2));
console.log(`\n${sections} sections · ${testFiles.length} test files · ${testCases}+ test cases`);
console.log('For the exact passing count, run: npm run test:run  (CI runs the full suite on every push).');
export default stats;
