// Node unit test for hauskauf-nebenkosten.js
// Validates the per-state GrESt rates (Stand: August 2026).
// Run: node scripts/test-hauskauf-nebenkosten.js
/* eslint-env node */
'use strict';

// DOM/window shim so the IIFE can load in Node (readyState 'loading' => only
// addEventListener is touched, which we no-op).
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

var mod = require('../public/assets/js/hauskauf-nebenkosten.js');
var rateFor = mod.rateFor;

var expected = {
  'Bayern': 0.035,
  'Baden-Württemberg': 0.05,
  'Berlin': 0.06,
  'Brandenburg': 0.065,
  'Bremen': 0.055,
  'Hamburg': 0.055,
  'Hessen': 0.06,
  'Mecklenburg-Vorpommern': 0.06,
  'Niedersachsen': 0.05,
  'Nordrhein-Westfalen': 0.065,
  'Rheinland-Pfalz': 0.05,
  'Saarland': 0.065,
  'Sachsen': 0.055,
  'Sachsen-Anhalt': 0.05,
  'Schleswig-Holstein': 0.065,
  'Thüringen': 0.05
};

var fails = 0;
var states = Object.keys(expected);
if (mod.STATES.length !== states.length) {
  console.error('FAIL: STATES length ' + mod.STATES.length + ' != 16');
  fails++;
}

states.forEach(function (s) {
  var got = rateFor(s);
  if (Math.abs(got - expected[s]) > 1e-9) {
    console.error('FAIL: ' + s + ' rate ' + got + ' expected ' + expected[s]);
    fails++;
  }
});

// Spot check the calculation path for a known case: Hamburg, 400.000 €
// GrESt = 400000 * 0.055 = 22.000
var hamburgCalc = 400000 * rateFor('Hamburg');
if (Math.abs(hamburgCalc - 22000) > 0.01) {
  console.error('FAIL: Hamburg 400k GrESt = ' + hamburgCalc + ' expected 22000');
  fails++;
}

if (fails === 0) {
  console.log('PASS: all ' + states.length + ' states correct (Stand August 2026)');
} else {
  console.log('FAILURES: ' + fails);
  process.exit(1);
}
