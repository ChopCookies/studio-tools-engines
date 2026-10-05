// Node unit test for solar-wartungskosten.js compute()
// Verifies math incl. the new optional insurance position.
// Run: node scripts/test-solar-wartungskosten.js
/* eslint-env node */
'use strict';

// Load the IIFE's exported compute by stubbing the DOM environment
function makeEnv(lang) {
  var els = {};
  function mkEl(id) {
    return {
      id: id, value: '', innerHTML: '',
      addEventListener: function () {},
      querySelector: function () { return null; },
      appendChild: function () {},
      className: '', type: '', textContent: ''
    };
  }
  els['tool-inputs'] = mkEl('tool-inputs');
  els['tool-output'] = mkEl('tool-output');
  var documentShim = {
    readyState: 'complete',
    addEventListener: function () {},
    getElementById: function (id) { if (!els[id]) els[id] = mkEl(id); return els[id]; },
    createElement: function () { return mkEl('created'); }
  };
  global.window = { __siteLang: lang, esc: function (s) { return String(s); } };
  global.document = documentShim;
  return els;
}

var fails = 0;
function chk(name, cond) { if (!cond) { console.error('FAIL: ' + name); fails++; } else { console.log('ok: ' + name); } }

makeEnv('de');
var lib = require('../public/assets/js/solar-wartungskosten.js');
var c = lib.compute;

// Baseline: 8 kWp, 25yr, inv 1200@15yr -> 1 replacement, maint 80/yr, reserve 500, no insurance
var r0 = c(8, 25, 1200, 15, 80, 500, 8000, 0);
chk('baseline replacements = 1', r0.replacements === 1);
chk('baseline maintTotal = 2000', r0.maintTotal === 2000);
chk('baseline invTotal = 1200', r0.invTotal === 1200);
chk('baseline total = 3700', r0.total === 3700);
chk('baseline perYear = 148', Math.abs(r0.perYear - 148) < 1e-9);
chk('baseline perKwh ~ 0.0185', Math.abs(r0.perKwh - 0.0185) < 1e-9);
chk('baseline insTotal = 0', r0.insTotal === 0);

// With insurance 100/yr over 25yr
var r1 = c(8, 25, 1200, 15, 80, 500, 8000, 100);
chk('insurance insTotal = 2500', r1.insTotal === 2500);
chk('insurance total = 6200', r1.total === 6200);
chk('insurance perYear = 248', Math.abs(r1.perYear - 248) < 1e-9);

// Inverter life 10yr -> 2 replacements (at 10 and 20)
var r2 = c(8, 25, 1000, 10, 80, 500, 8000, 50);
chk('life10 replacements = 2', r2.replacements === 2);
chk('life10 invTotal = 2000', r2.invTotal === 2000);
chk('life10 total = 2000+2000+500+1250 = 5750', r2.total === 5750);

// 30 year lifetime, inverter 12yr -> replacements at 12,24 = 2
var r3 = c(8, 30, 1500, 12, 100, 700, 9000, 120);
chk('life30 replacements = 2', r3.replacements === 2);
var expTotal = 100*30 + 2*1500 + 700 + 120*30;
chk('life30 total', r3.total === expTotal);
chk('life30 perKwh = total/(9000*30)', Math.abs(r3.perKwh - (expTotal/(9000*30))) < 1e-9);

// Insurance undefined treated as 0
var r4 = c(8, 25, 1200, 15, 80, 500, 8000, undefined);
chk('insurance undefined = 0 total', r4.total === 3700);

console.log(fails === 0 ? '\nALL TESTS PASSED' : '\n' + fails + ' TEST(S) FAILED');
process.exit(fails === 0 ? 0 : 1);
