// Node unit test for waschkosten-rechner.js
// Validates default reference prices (Stand 08/2026) and the per-cycle / resource math.
// Run: node scripts/test-waschkosten-rechner.js
/* eslint-env node */
'use strict';

// DOM/window shim so the IIFE can load in Node (readyState 'loading' => only
// addEventListener is touched, which we no-op). getElementById returns null so
// buildResult() falls back to the hard-coded defaults.
global.window = {
  __siteLang: 'de',
  esc: function (s) { return String(s); },
  playbook: { report: function () {} }
};
global.document = {
  readyState: 'loading',
  addEventListener: function () {},
  getElementById: function () { return null; },
  createElement: function () { return {}; }
};

var mod = require('../public/assets/js/waschkosten-rechner.js');
var CONST = mod.CONST, MACHINE = mod.MACHINE, PROGRAM = mod.PROGRAM;
var fails = 0;
function chk(name, cond, detail) {
  if (!cond) { console.error('FAIL: ' + name + (detail ? ' -> ' + detail : '')); fails++; }
  else { console.log('ok: ' + name); }
}

// 1. Reference prices are current (08/2026)
chk('Strom default 0.37 (BDEW 08/2026)', Math.abs(CONST.kWh_price_default - 0.37) < 1e-9);
chk('Wasser default 4.80 (Ø 2026)', Math.abs(CONST.water_price_default - 4.80) < 1e-9);
chk('Waschmittel default 0.15', Math.abs(CONST.detergent_default - 0.15) < 1e-9);

// 2. Default machine/program data still present
chk('modern machine water 45 L', MACHINE.modern.water === 45);
chk('eco40 program 0.55 kWh', PROGRAM.eco40.kWh === 0.55);

// 3. buildResult() with null DOM => defaults (modern + eco40, 4 washes/month)
var r = mod.buildResult();
if (!r || r.error) { console.error('FAIL: buildResult returned error: ' + (r && r.error)); fails++; }
else {
  // elec: 0.55 * 0.37 = 0.2035 ; water: 45/1000 * 4.80 = 0.216 ; +0.15
  chk('elecCost 0.2035', Math.abs(r.elecCost - 0.2035) < 1e-9, r.elecCost);
  chk('waterCost 0.216', Math.abs(r.waterCost - 0.216) < 1e-9, r.waterCost);
  chk('totalPer 0.5695', Math.abs(r.totalPer - 0.5695) < 1e-9, r.totalPer);
  chk('perMonth (4x) 2.278', Math.abs(r.perMonth - 2.278) < 1e-9, r.perMonth);
  chk('perYear 27.336', Math.abs(r.perYear - 27.336) < 1e-9, r.perYear);
  // resource use per year
  chk('kwhPerYear 26.4', Math.abs(r.kwhPerYear - 26.4) < 1e-9, r.kwhPerYear);
  chk('waterPerYear 2.16', Math.abs(r.waterPerYear - 2.16) < 1e-9, r.waterPerYear);
}

if (fails === 0) {
  console.log('PASS: waschkosten-rechner defaults + math correct (Stand 08/2026)');
} else {
  console.log('FAILURES: ' + fails);
  process.exit(1);
}
