// Node unit test for stromkosten-rechner.js
// Validates the default reference price (Stand 09/2026) and the cost math.
// Run: node scripts/test-stromkosten-rechner.js
/* eslint-env node */
'use strict';

// DOM/window shim so the IIFE can load in Node (readyState 'loading' => only
// addEventListener is touched, which we no-op). getElementById returns null so
// buildUI() skips building into #tool-inputs.
global.window = {
  __siteLang: 'de',
  esc: function (s) { return String(s); },
  playbook: { report: function () {} }
};
global.document = {
  readyState: 'loading',
  addEventListener: function () {},
  getElementById: function () { return null; },
  querySelector: function () { return null; },
  createElement: function () { return {}; }
};

var mod = require('../public/assets/js/stromkosten-rechner.js');
var compute = mod.compute;
var STROM_DEFAULT = mod.STROM_DEFAULT;
var T = mod.T;
var fails = 0;
function chk(name, cond, detail) {
  if (!cond) { console.error('FAIL: ' + name + (detail ? ' -> ' + detail : '')); fails++; }
  else { console.log('ok: ' + name); }
}

// 1. Reference price is current (09/2026, BDEW Herbst 2026: 37,0 ct/kWh)
chk('Strom default 0.37 (BDEW 09/2026)', Math.abs(STROM_DEFAULT - 0.37) < 1e-9);

// 2. Localization present (DE true with __siteLang de)
chk('DE label Jahreskosten', T.jahreskosten === 'Jahreskosten');

// 3. Math: known appliance
// 100 W (0.1 kW) for 3 h/day, 365 days, at 0.40 €/kWh
// kwhPerDay = 0.1*3 = 0.3; kwhPerYear = 0.3*365 = 109.5; costPerYear = 109.5*0.4 = 43.80
var r = compute({ watts: 100, hoursPerDay: 3, daysPerYear: 365, pricePerKwh: 0.40 });
function near(a, b) { return Math.abs(a - b) < 1e-9; }
chk('kWh/day = 0.3', near(r.kwhPerDay, 0.3));
chk('kWh/year = 109.5', near(r.kwhPerYear, 109.5));
chk('cost/year = 43.80', near(r.costPerYear, 43.80));
chk('cost/month = 3.65', near(r.costPerMonth, 43.80 / 12));
chk('cost/day = 0.12', near(r.costPerDay, 0.12));

// 4. Zero/edge guarding
var rz = compute({ watts: 0, hoursPerDay: 0, daysPerYear: 0, pricePerKwh: 0 });
chk('zero input yields zero', rz.costPerYear === 0 && rz.kwhPerYear === 0);

// 5. fmtEuro uses localised formatting
var fe = mod.fmtEuro(42.5);
chk('fmtEuro has comma + Euro', fe.indexOf('42,50') === 0 && fe.indexOf('€') > -1);

console.log(fails === 0 ? '\nALL TESTS PASSED' : '\n' + fails + ' TEST(S) FAILED');
process.exit(fails === 0 ? 0 : 1);
