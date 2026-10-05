/* Node unit tests for cron-generator pure engine (DOM stubbed). */
'use strict';
const fs = require('fs');
const path = require('path');

// Minimal DOM stub so require() doesn't throw on buildUI()
const el = () => ({ innerHTML: '', value: '', appendChild(){}, addEventListener(){}, querySelector(){ return { addEventListener(){} }; } });
global.document = {
  readyState: 'complete',
  getElementById: () => el(),
  createElement: () => el(),
  addEventListener() {},
};
global.window = {};

const src = fs.readFileSync(path.resolve(__dirname, '../public/assets/js/cron-generator.js'), 'utf8');
const mod = { exports: {} };
new Function('module', 'exports', 'document', 'window', src)(mod, mod.exports, global.document, global.window);
const { PARTS, presets, buildCron, describe } = mod.exports;

let pass = 0, fail = 0;
function assert(name, cond) {
  if (cond) { pass++; console.log('  ok ' + name); }
  else { fail++; console.log('  FAIL ' + name); }
}

// (a) buildCron all-star returns '* * * * *'
assert('buildCron all-star returns * * * * *', buildCron({ minute: '*', hour: '*', dayOfMonth: '*', month: '*', weekday: '*' }) === '* * * * *');

// (b) buildCron({minute:'0',hour:'9',dayOfMonth:'*',month:'*',weekday:'1-5'}) returns '0 9 * * 1-5'
assert('buildCron fixed 0 9 * * 1-5', buildCron({ minute: '0', hour: '9', dayOfMonth: '*', month: '*', weekday: '1-5' }) === '0 9 * * 1-5');

// (c) buildCron with invalid minute 99 throws
assert('buildCron invalid minute 99 throws', (function() { try { buildCron({ minute: '99', hour: '*', dayOfMonth: '*', month: '*', weekday: '*' }); return false; } catch (e) { return true; } })());

// (d) describe('* * * * *') mentions 'Minute' or 'Jede'
var descAll = describe('* * * * *');
assert('describe all-star mentions Minute or Jede', descAll.includes('Minute') || descAll.includes('Jede'));

// (e) describe('0 9 * * 1-5') mentions '9' (or '9:00')
var desc9 = describe('0 9 * * 1-5');
assert('describe 0 9 * * 1-5 mentions 9', desc9.includes('9') || desc9.includes('9:00'));

// (f) all 6 presets produce a describe() that returns a non-empty string
presets.forEach(function (p) {
  var d = describe(p.cron);
  assert('describe "' + p.cron + '" non-empty', d && d.length > 0);
});

// Also verify PARTS
assert('PARTS has 5 fields', PARTS.length === 5);

// Verify no em-dashes in copy
assert('no em-dashes in presets', presets.every(function (p) { return !p.label.includes('—') && !p.cron.includes('—'); }));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
