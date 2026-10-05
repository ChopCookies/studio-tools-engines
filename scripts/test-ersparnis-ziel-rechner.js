// Node unit test: ersparnis-ziel-rechner
// Stubs window/document so the IIFE loads, then asserts on exported pure functions.
'use strict';
const assert = require('assert');
const path = require('path');

const JS = path.join(__dirname, '..', 'public', 'assets', 'js', 'ersparnis-ziel-rechner.js');

// Element stubs. getElementById returns null by default (setup() exits at its
// !inputs guard); setVals() populates the map so buildResult can read inputs.
const elements = {};
function mkEl() { return { value: '', checked: false, style: {}, innerHTML: '', appendChild: function(){}, addEventListener: function(){} }; }

// --- 1. Unit-test pure functions directly (no DOM needed) ---
global.window = { __siteLang: 'de', esc: (s) => String(s) };
global.document = {
  readyState: 'complete',
  addEventListener: function(){},
  getElementById: function(id){ return (id in elements) ? elements[id] : null; },
  createElement: function(){ return mkEl(); }
};

const m = require(JS);

function near(a, b, tol) { return Math.abs(a - b) <= tol; }

// monthsWithInterest vectors (exact annuity formula check)
// target 6000, saved 1000, rate 500/mo, ret 4% p.a.
// rm = 0.04/12 = 0.0033333; q=1.0033333
// numer = 6000 + 500/0.0033333 = 6000 + 150000 = 156000
// denom = 1000 + 150000 = 151000
// q^n = 156000/151000 = 1.0331126; n = ln(1.0331126)/ln(1.0033333)
// ln(1.0331126)=0.032576; ln(1.0033333)=0.0033278 -> n=9.79 -> ceil 10
let mon = m.monthsWithInterest(6000, 500, 1000, 4);
assert.strictEqual(mon, 10, 'compound months expected 10, got ' + mon);

// no-interest fallback when ret<=0
mon = m.monthsWithInterest(6000, 500, 1000, 0);
assert.strictEqual(mon, 10, 'no-interest months: 5000/500=10, got ' + mon);
mon = m.monthsWithInterest(6000, 500, 0, NaN);
assert.strictEqual(mon, Math.ceil(6000/500), 'NaN fallback months');

// already reached
mon = m.monthsWithInterest(1000, 500, 1200, 4);
assert.strictEqual(mon, 0, 'already reached -> 0');

// higher return shortens duration
const low = m.monthsWithInterest(12000, 300, 0, 2);
const high = m.monthsWithInterest(12000, 300, 0, 7);
assert.ok(high < low, 'higher return should shorten time (' + low + ' vs ' + high + ')');

// durText bilingual
assert.strictEqual(m.durText(14, true), '1 Jahr und 2 Monate');
assert.strictEqual(m.durText(14, false), '1 year and 2 months');
assert.strictEqual(m.durText(5, true), '5 Monate');

// --- 2. buildResult through a populated DOM stub ---
function setVals(v) {
  ['sz-target','sz-rate','sz-saved','sz-ret'].forEach(id => elements[id] = mkEl());
  if (v.target !== undefined) elements['sz-target'].value = v.target;
  if (v.rate !== undefined) elements['sz-rate'].value = v.rate;
  if (v.saved !== undefined) elements['sz-saved'].value = v.saved;
  if (v.ret !== undefined) elements['sz-ret'].value = v.ret;
}

setVals({ target: '6000', rate: '500', saved: '1000', ret: '4' });
let r = m.buildResult();
assert.strictEqual(r.months, 10, 'buildResult compound months');
assert.strictEqual(r.useInterest, true, 'useInterest true');
assert.strictEqual(r.ret, 4);

// no interest when ret empty
setVals({ target: '6000', rate: '500', saved: '1000', ret: '' });
r = m.buildResult();
assert.strictEqual(r.useInterest, false, 'no ret -> no interest');
assert.strictEqual(r.months, 10, 'no-interest division');

// already reached
setVals({ target: '1000', rate: '500', saved: '1200', ret: '4' });
r = m.buildResult();
assert.strictEqual(r.months, 0, 'already reached');

// validation errors
setVals({ target: '', rate: '500', saved: '0', ret: '' });
r = m.buildResult();
assert.ok(r.error, 'missing target -> error');

setVals({ target: '5000', rate: '0', saved: '0', ret: '' });
r = m.buildResult();
assert.ok(r.error, 'zero rate -> error');

console.log('ersparnis-ziel-rechner: ALL TESTS GREEN (' + (16) + ' assertions)');
