// Node unit tests for the renten-rechner statutory-pension model.
// Run: node scripts/test-renten-rechner.js
// Stubs window/document so the IIFE's setup() no-ops; pure functions are
// exported via module.exports.
'use strict';

const assert = require('assert');

global.window = { __siteLang: 'de' };
global.document = { readyState: 'complete', addEventListener: function(){}, getElementById: function(){ return null; } };

const m = require('../public/assets/js/renten-rechner.js');

function approx(a, b, tol) { return Math.abs(a - b) <= tol; }

const CY = new Date().getFullYear();

// Regelaltersgrenze by birth year.
assert.strictEqual(m.regelaltersgrenze(1940), 65, 'pre-1947 = 65');
assert.strictEqual(m.regelaltersgrenze(1950), 65 + 4 / 12, '1950 ramps to 65y4m');
assert.strictEqual(m.regelaltersgrenze(1960), 66 + 2 * 2 / 12, '1960 = 66y4m');
assert.strictEqual(m.regelaltersgrenze(1990), 67, '1964+ = 67');

// Zugangsfaktor: 48 months early -> 0.856; 12 months late (post-1946) -> 1.06.
assert.ok(approx(m.zugangsfaktor(67, 63), 1 - 0.003 * 48, 1e-9), 'early 48mo -> 0.856');
assert.ok(approx(m.zugangsfaktor(67, 68), 1 + 0.005 * 12, 1e-9), 'late 12mo -> 1.06');
assert.strictEqual(m.zugangsfaktor(67, 67), 1, 'at regel -> 1');

// Entgeltpunkte: 50.000 of 51.944 -> 0.9626; capped at BBG 101.400 -> 1.952.
assert.ok(approx(m.epPerYear(50000), 50000 / 51944, 1e-4), 'ep/yr 0.9626, got ' + m.epPerYear(50000));
assert.ok(approx(m.epPerYear(200000), 101400 / 51944, 1e-4), 'capped at BBG ~1.952, got ' + m.epPerYear(200000));

// End-to-end reference case (matches SEO): 1990, 50.000, 10 yrs, age 67,
// rw 42.52, growth 2%, infl 2%. growth==infl -> real == totalEP * zf * rw.
const r = m.compute({ birth: 1990, salary: 50000, years: 10, age: 67,
                      rw: 42.52, rwGrowth: 0.02, infl: 0.02 });
const eppy = 50000 / 51944;
const futureYears = Math.max(67 - (CY - 1990), 0);
const expectedEP = eppy * 10 + eppy * futureYears;
assert.ok(approx(r.totalEP, expectedEP, 1e-6), 'totalEP matches, got ' + r.totalEP);
assert.ok(approx(r.realMonthly, expectedEP * 42.52, 0.01), 'real ~1600-1700, got ' + r.realMonthly);
assert.ok(r.realMonthly > 1500 && r.realMonthly < 1800, 'real plausible, got ' + r.realMonthly);
assert.strictEqual(r.zf, 1, 'at regel zf=1');

// fmtRegel localization.
assert.ok(m.fmtRegel(67).indexOf('67') === 0, 'fmtRegel 67 shown');

console.log('All renten-rechner tests passed. realMonthly reference = ' + Math.round(r.realMonthly) + ' EUR');
