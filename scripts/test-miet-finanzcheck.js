/* Node unit test for miet-finanzcheck.js (pure logic via buildResult).
   Script-only, deploy-excluded (lives in scripts/). */
'use strict';
const path = require('path');

// Minimal DOM stub so the IIFE's buildUI() and E() don't throw on require.
const vals = {};
const mkEl = (id) => ({
  id, value: (id in vals ? String(vals[id]) : ''),
  appendChild: () => {}, addEventListener: () => {}, textContent: '',
  innerHTML: '', className: '', type: '', style: {}
});
global.document = {
  readyState: 'complete',
  getElementById: (id) => mkEl(id),
  createElement: () => mkEl('__new__')
};
global.window = { __siteLang: 'de', esc: (s) => String(s) };

const mf = require(path.join(__dirname, '..', 'public', 'assets', 'js', 'miet-finanzcheck.js'));

let pass = 0, fail = 0;
function assert(name, cond) {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('  FAIL ' + name); }
}
function approx(a, b) { return Math.abs(a - b) < 0.0001; }

// helper to run buildResult with given field values
function r(fields) {
  for (const k of Object.keys(fields)) vals[k] = fields[k];
  return mf.buildResult();
}

console.log('Konstanten:');
assert('GUIDELINE = 0.30', mf.GUIDELINE === 0.30);
assert('STRESS = 0.35', mf.STRESS === 0.35);
assert('OPERATING_PER_M2 = 2.67', mf.OPERATING_PER_M2 === 2.67);

console.log('Gruen / ok: income 2000, rent 500');
let res = r({ 'mf-income': '2000', 'mf-rent': '500', 'mf-area': '' });
assert('share 0.25', approx(res.share, 0.25));
assert('status ok', res.status === 'ok');
assert('maxWarm 600', res.maxWarm === 600);

console.log('Watch: income 2000, rent 650');
res = r({ 'mf-income': '2000', 'mf-rent': '650', 'mf-area': '' });
assert('share 0.325', approx(res.share, 0.325));
assert('status watch', res.status === 'watch');

console.log('Kritisch: income 2000, rent 800');
res = r({ 'mf-income': '2000', 'mf-rent': '800', 'mf-area': '' });
assert('status crit', res.status === 'crit');

console.log('Kaltmiete-Schaetzung: income 2000, rent 800, area 50');
res = r({ 'mf-income': '2000', 'mf-rent': '800', 'mf-area': '50' });
assert('estOperating ~ 133.5', approx(res.estOperating, 133.5));
assert('estCold ~ 666.5', approx(res.estCold, 666.5));
assert('estCold != null', res.estCold !== null);

console.log('Anpassbare Betriebskosten: opcost 3.5');
res = r({ 'mf-income': '2000', 'mf-rent': '800', 'mf-area': '50', 'mf-opcost': '3.5' });
assert('opCost 3.5', approx(res.opCost, 3.5));
assert('estOperating 175', approx(res.estOperating, 175));
assert('estCold 625', approx(res.estCold, 625));
assert('leeres opcost -> Default 2.67', approx(r({ 'mf-income':'2000','mf-rent':'800','mf-area':'50','mf-opcost':'' }).opCost, 2.67));
assert('ungueltiges opcost -> Default 2.67', approx(r({ 'mf-income':'2000','mf-rent':'800','mf-area':'50','mf-opcost':'abc' }).opCost, 2.67));

console.log('Fehlerfaelle:');
res = r({ 'mf-income': '', 'mf-rent': '500', 'mf-area': '' });
assert('fehlendes income -> error', !!res.error);
res = r({ 'mf-income': '2000', 'mf-rent': '', 'mf-area': '' });
assert('fehlende rent -> error', !!res.error);

console.log('');
console.log('Ergebnis: ' + pass + ' ok, ' + fail + ' fail');
process.exit(fail ? 1 : 0);
