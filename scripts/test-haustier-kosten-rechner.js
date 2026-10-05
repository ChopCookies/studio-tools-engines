// Node unit test for haustier-kosten-rechner.js
// Validates defaults (Stand 09/2026), the pure compute() math and the new
// Hundesteuer (dog tax) inclusion. Run: node scripts/test-haustier-kosten-rechner.js
/* eslint-env node */
'use strict';

// DOM/window shim so the IIFE can load in Node (readyState 'loading' => only
// addEventListener is touched, which we no-op). getElementById returns null.
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

var mod = require('../public/assets/js/haustier-kosten-rechner.js');
var K = mod.K, compute = mod.compute, FODOG = mod.FODOG;
var fails = 0;
function chk(name, cond, detail) {
  if (!cond) { console.error('FAIL: ' + name + (detail != null ? ' -> ' + detail : '')); fails++; }
  else { console.log('ok: ' + name); }
}
function approx(a, b) { return Math.abs(a - b) < 1e-9; }

// 1. Constants / reference figures (Stand 09/2026)
chk('steuerDog default 100 (Stand 09/2026)', K.steuerDog === 100);
chk('lifeDog 12', K.lifeDog === 12);
chk('lifeCat 15', K.lifeCat === 15);
chk('neuterDog 180 (GOT 2022 range)', K.neuterDog === 180);
chk('FODOG mittel 48', FODOG.mittel === 48);

// 2. Cat default (mittel, tierheim, keine versicherung, blank futter/sonst)
var c = compute('katze', 'mittel', 'tierheim', 'keine', '', '', '');
// once = 150 + 250 + 40 + 0 (tierheim) + 180 = 620
chk('cat once 620', approx(c.once, 620), c.once);
// monthly = 30 + 0 + 20 = 50
chk('cat monthly 50', approx(c.monthly, 50), c.monthly);
// yearly = 50*12 + 45 (vaccCatYear) + 0 (no dog tax) = 645
chk('cat yearly 645 (no dog tax)', approx(c.yearly, 645), c.yearly);
// lifetime = 620 + 645*15 = 10295
chk('cat lifetime 10295', approx(c.lifetime, 10295), c.lifetime);
chk('cat steuer 0', c.steuer === 0);

// 3. Dog default (mittel, tierheim, op, blank futter/sonst/steuer)
var d = compute('hund', 'mittel', 'tierheim', 'op', '', '', '');
// once = 350 + 500 + 40 + 0 + 180 = 1070
chk('dog once 1070', approx(d.once, 1070), d.once);
// monthly = 48 + 25 + 30 = 103
chk('dog monthly 103', approx(d.monthly, 103), d.monthly);
// yearly = 103*12 + 75 + steuer(blank -> 100) = 1236 + 175 = 1411
chk('dog yearly 1411 (incl. dog tax 100)', approx(d.yearly, 1411), d.yearly);
chk('dog steuer 100', d.steuer === 100);
// lifetime = 1070 + 1411*12 = 18002
chk('dog lifetime 18002', approx(d.lifetime, 18002), d.lifetime);

// 4. Dog with explicit steuer "0" (exempt) -> no dog tax added
var d0 = compute('hund', 'mittel', 'tierheim', 'op', '', '', '0');
chk('dog steuer 0 explicit -> yearly 1311', approx(d0.yearly, 1311), d0.yearly);
chk('dog steuer 0 explicit -> steuer 0', d0.steuer === 0);

// 5. Dog custom steuer e.g. 160
var d160 = compute('hund', 'mittel', 'tierheim', 'op', '', '', '160');
chk('dog steuer 160 -> yearly 1471', approx(d160.yearly, 1471), d160.yearly);

// 6. Full coverage dog bumps monthly
var dfull = compute('hund', 'gross', 'zuechter', 'voll', '', '', '');
// monthly = 70 + 60 + 40 = 170
chk('dog large voll monthly 170', approx(dfull.monthly, 170), dfull.monthly);

if (fails === 0) {
  console.log('PASS: haustier-kosten-rechner defaults + compute math + Hundesteuer correct (Stand 09/2026)');
} else {
  console.log('FAILURES: ' + fails);
  process.exit(1);
}
