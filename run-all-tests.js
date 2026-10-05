#!/usr/bin/env node
/**
 * Runs every test in scripts/test-*.js sequentially and reports a summary.
 * Exits non-zero if any test fails, so `npm test` works in CI.
 *
 * Usage: node run-all-tests.js   (or `npm test`)
 */
'use strict';
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const testsDir = path.join(__dirname, 'scripts');
const tests = fs.readdirSync(testsDir)
  .filter(f => /^test-.+\.js$/.test(f))
  .sort();

const results = [];
for (const t of tests) {
  const r = spawnSync(process.execPath, [path.join(testsDir, t)], { encoding: 'utf8' });
  results.push({ t, ok: r.status === 0, out: (r.stdout || '') + (r.stderr || '') });
}

let pass = results.filter(r => r.ok).length;
console.log(`\n${pass}/${results.length} suites passed\n`);
let failed = false;
for (const r of results) {
  if (!r.ok) {
    failed = true;
    console.log(`FAIL ${r.t}`);
    console.log(r.out.split('\n').slice(-15).join('\n'));
    console.log('---');
  }
}
process.exit(failed ? 1 : 0);
