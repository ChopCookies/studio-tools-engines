/* Node unit tests for batteriespeicher-rechner compute() */
'use strict';
const assert = require('assert');
global.window = { __siteLang: 'de' };
global.document = { readyState: 'complete', addEventListener: function() {}, getElementById: function() { return null; } };
const m = require('../public/assets/js/batteriespeicher-rechner.js');

// 2026 defaults: 10 kWh, 6000 EUR, 37 ct, 15% extra, 8000 kWh, 15y, 90% RTE, 3% esc
const r = m.compute(10, 6000, 37, 15, 8000, 15, 90, 3);
assert.strictEqual(r.savings1, 400, 'year-1 savings at 2026 defaults must be 400 EUR');
assert.strictEqual(r.result, 1212, 'cumulative result after 15y must be +1212 EUR');
assert.ok(Math.abs(r.payback - 12.8) < 0.2, 'payback ~12.8y, got ' + r.payback);
assert.strictEqual(r.lifeYears, 15);

// Regression: higher (older) battery cost should NOT pay back
const rHigh = m.compute(10, 9000, 37, 15, 8000, 15, 90, 3);
assert.ok(rHigh.result < 0, '9000 EUR battery must still show a loss');
assert.strictEqual(rHigh.payback, undefined, 'no payback when never profitable');

// Lower electricity price should reduce savings
const rLow = m.compute(10, 6000, 20, 15, 8000, 15, 90, 3);
assert.ok(rLow.savings1 < r.savings1, 'lower price => lower year-1 savings');

// Round-trip efficiency affects the saving linearly
const r80 = m.compute(10, 6000, 37, 15, 8000, 15, 80, 3);
assert.ok(r80.savings1 < r.savings1, '80% RTE => lower savings than 90%');

// 20-year horizon with same inputs covers the cost much more
const r20 = m.compute(10, 6000, 37, 15, 8000, 20, 90, 3);
assert.ok(r20.result > r.result, 'longer life => higher cumulative result');

console.log('All batteriespeicher-rechner tests passed.');
