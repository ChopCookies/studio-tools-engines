// Node unit test: altersvorsorge-gap
// Stubs window/document so the IIFE loads, then asserts on the exported pure compute().
'use strict';
const assert = require('assert');
const path = require('path');

const JS = path.join(__dirname, '..', 'public', 'assets', 'js', 'altersvorsorge-gap.js');

function mkEl() { return { value: '', checked: false, style: {}, innerHTML: '', appendChild: function(){}, addEventListener: function(){} }; }

global.window = { __siteLang: 'de', esc: (s) => String(s) };
global.document = {
  readyState: 'complete',
  addEventListener: function(){},
  getElementById: function(){ return null; },
  createElement: function(){ return mkEl(); }
};

const m = require(JS);
function near(a, b, tol) { return Math.abs(a - b) <= tol; }

// --- Baseline: no inflation ---
let r = m.compute({ ziel:1800, rente:1200, andere:0, jahre:20, ret:4, dauer:20, infl:0 });
assert.strictEqual(r.gap, 600, 'gap 600');
assert.strictEqual(r.kapital, 144000, 'kapital 144000');
assert.ok(near(r.spar, 392.6, 2), 'spar ~392.6, got ' + r.spar);
assert.ok(r.inflZiel === undefined, 'no inflZiel when infl=0');

// --- With inflation 2% ---
r = m.compute({ ziel:1800, rente:1200, andere:0, jahre:20, ret:4, dauer:20, infl:2 });
let f = Math.pow(1.02, 20);
assert.ok(near(r.inflZiel, 1800*f, 1), 'inflZiel ~2674.7, got ' + r.inflZiel);
assert.ok(near(r.inflKapital, 144000*f, 5), 'inflKapital ~213976, got ' + r.inflKapital);
assert.strictEqual(r.gap, 600, 'gap unchanged');

// Inflation raises the expressed target (13.x years same inflation -> less)
r = m.compute({ ziel:1800, rente:1200, andere:0, jahre:10, ret:4, dauer:20, infl:2 });
assert.ok(r.inflZiel < 2674, 'shorter horizon -> smaller inflated target, got ' + r.inflZiel);

// --- Validation ---
r = m.compute({ ziel:0, rente:0, andere:0, jahre:0, ret:4, dauer:20, infl:2 });
assert.strictEqual(r.valid, false, 'no target/jahre -> invalid');
r = m.compute({ ziel:1800, rente:0, andere:0, jahre:25, ret:4, dauer:10, infl:2 });
assert.strictEqual(r.valid, true, 'valid');

// --- Negative gap clamps to 0 ---
r = m.compute({ ziel:800, rente:1200, andere:0, jahre:20, ret:4, dauer:20, infl:0 });
assert.strictEqual(r.gap, 0, 'gap clamped to 0');
assert.strictEqual(r.kapital, 0, 'kapital 0');

// --- ret=0 fallback (linear savings) ---
r = m.compute({ ziel:1800, rente:1200, andere:0, jahre:20, ret:0, dauer:20, infl:0 });
assert.ok(near(r.spar, 144000/240, 1), 'spar = kapital/n when ret=0, got ' + r.spar);

// --- String-style inputs via num (German comma) ---
assert.strictEqual(m.num('1.800,50'.replace(/\./g,'').replace(',','.')), 1800.5, 'num german comma');
assert.strictEqual(m.num('abc'), 0, 'num non-numeric -> 0');

console.log('altersvorsorge-gap: ALL TESTS GREEN');
